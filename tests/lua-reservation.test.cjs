const test = require("node:test");
const assert = require("node:assert/strict");
const lua = require("fengari/src/lua.js");
const lauxlib = require("fengari/src/lauxlib.js");
const lualib = require("fengari/src/lualib.js");
const { to_luastring } = require("fengari/src/fengaricore.js");
const { RESERVE_SCRIPT, RELEASE_SCRIPT, UPLOAD_RESERVE_SCRIPT } = require("../lib/generation/scripts.ts");
const { FREE_COST_MICRO_USD, FREE_DAILY_BUDGET_MICRO_USD, FREE_LIMITS, FREE_OVERALL_DAILY_BUDGET_MICRO_USD } = require("../lib/generation/config.ts");

class RedisCommandShim {
  constructor() { this.values = new Map(); this.expirations = new Map(); }
  get(key) {
    const expiry = this.expirations.get(key);
    if (expiry !== undefined && expiry <= Date.now()) { this.values.delete(key); this.expirations.delete(key); return null; }
    return this.values.has(key) ? this.values.get(key) : null;
  }
  set(key, value, ttlSeconds) { this.values.set(key, String(value)); if (ttlSeconds) this.expirations.set(key, Date.now() + Number(ttlSeconds) * 1000); return "OK"; }
  call(command, args) {
    const name = command.toUpperCase();
    if (name === "GET") return this.get(args[0]);
    if (name === "SET") { const ttlIndex = args.findIndex((arg) => String(arg).toUpperCase() === "EX"); return this.set(args[0], args[1], ttlIndex >= 0 ? args[ttlIndex + 1] : undefined); }
    if (name === "INCR") return this.incr(args[0], 1);
    if (name === "INCRBY") return this.incr(args[0], Number(args[1]));
    if (name === "DECR") return this.incr(args[0], -1);
    if (name === "DECRBY") return this.incr(args[0], -Number(args[1]));
    if (name === "EXPIRE") { if (this.get(args[0]) === null) return 0; this.expirations.set(args[0], Date.now() + Number(args[1]) * 1000); return 1; }
    throw new Error(`unsupported Redis command ${name}`);
  }
  incr(key, amount) { const next = Number(this.get(key) || "0") + amount; this.values.set(key, String(next)); return next; }
}

function createLuaRunner(redis) {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  lua.lua_newtable(L);
  lua.lua_pushjsfunction(L, (state) => {
    const command = lua.lua_tojsstring(state, 1);
    const args = [];
    for (let index = 2; index <= lua.lua_gettop(state); index += 1) args.push(lua.lua_tojsstring(state, index));
    const result = redis.call(command, args);
    if (result === null || result === undefined) lua.lua_pushnil(state);
    else if (typeof result === "number") lua.lua_pushinteger(state, result);
    else lua.lua_pushstring(state, to_luastring(String(result)));
    return 1;
  });
  lua.lua_setfield(L, -2, to_luastring("call"));
  lua.lua_setglobal(L, to_luastring("redis"));
  return (script, keys, args) => {
    lua.lua_settop(L, 0); pushArray(L, "KEYS", keys); pushArray(L, "ARGV", args);
    assert.equal(lauxlib.luaL_loadstring(L, to_luastring(script)), lua.LUA_OK);
    assert.equal(lua.lua_pcall(L, 0, 1, 0), lua.LUA_OK);
    assert.equal(lua.lua_istable(L, -1), true);
    const result = [];
    for (let index = 1; ; index += 1) { lua.lua_rawgeti(L, -1, index); if (lua.lua_isnil(L, -1)) { lua.lua_pop(L, 1); break; } result.push(lua.lua_tojsstring(L, -1)); lua.lua_pop(L, 1); }
    return result;
  };
}

function pushArray(L, name, values) {
  lua.lua_newtable(L);
  values.forEach((value, index) => { lua.lua_pushstring(L, to_luastring(String(value))); lua.lua_rawseti(L, -2, index + 1); });
  lua.lua_setglobal(L, to_luastring(name));
}

function keys(day, ip, kind, id, idempotencyKey = id) {
  return [`quota:${day}:${ip}:${kind}`, `budget:${day}:${kind}`, `budget:${day}:overall`, `idem:owner:${idempotencyKey}`, `job:${id}`, `reservation:${id}`, `audit:${id}:reserved`];
}
function args({ id, hash, limit, cost, budget, overallBudget = FREE_OVERALL_DAILY_BUDGET_MICRO_USD, job = `{"id":"${id}"}` }) {
  return [String(limit), String(cost), String(budget), String(overallBudget), job, id, hash, "172800", "86400", "job:", `{"jobId":"${id}","disposition":"reserved"}`, "2592000"];
}
function reserve(run, kind, id, ip = id, day = "2026-09-30", overrides = {}) {
  return run(RESERVE_SCRIPT, keys(day, ip, kind, id, overrides.idempotencyKey ?? id), args({ id, hash: overrides.hash ?? id, limit: overrides.limit ?? FREE_LIMITS[kind], cost: overrides.cost ?? FREE_COST_MICRO_USD[kind], budget: overrides.budget ?? FREE_DAILY_BUDGET_MICRO_USD[kind], overallBudget: overrides.overallBudget }));
}

test("Redis reservation EVAL enforces idempotency, conflict, and per-kind limits", () => {
  const redis = new RedisCommandShim(); const run = createLuaRunner(redis);
  assert.equal(reserve(run, "image", "job-1", "ip-a", "2026-09-30", { idempotencyKey: "same", hash: "h1" })[0], "RESERVED");
  assert.ok(redis.get("audit:job-1:reserved"));
  assert.equal(reserve(run, "image", "job-2", "ip-a", "2026-09-30", { idempotencyKey: "same", hash: "h1" })[0], "EXISTING");
  assert.equal(reserve(run, "image", "job-3", "ip-a", "2026-09-30", { idempotencyKey: "same", hash: "h2" })[0], "CONFLICT");
  reserve(run, "image", "job-4", "ip-a"); reserve(run, "image", "job-5", "ip-a");
  assert.equal(reserve(run, "image", "job-6", "ip-a")[0], "LIMIT");
  assert.ok(redis.expirations.has("quota:2026-09-30:ip-a:image"));
});

test("exact v4 isolated budgets: image 1000, edit 86, video 20", () => {
  const run = createLuaRunner(new RedisCommandShim());
  for (let i = 0; i < 1000; i += 1) assert.equal(reserve(run, "image", `image-${i}`, `image-ip-${i}`)[0], "RESERVED");
  assert.equal(reserve(run, "image", "image-overflow", "image-ip-overflow")[0], "BUDGET");
  for (let i = 0; i < 86; i += 1) assert.equal(reserve(run, "edit", `edit-${i}`, `edit-ip-${i}`)[0], "RESERVED");
  assert.equal(reserve(run, "edit", "edit-overflow", "edit-ip-overflow")[0], "BUDGET");
  for (let i = 0; i < 20; i += 1) assert.equal(reserve(run, "video", `video-${i}`, `video-ip-${i}`)[0], "RESERVED");
  assert.equal(reserve(run, "video", "video-overflow", "video-ip-overflow")[0], "BUDGET");
});

test("separate pools can be used together, but the overall 10 dollar cap is atomic", () => {
  const run = createLuaRunner(new RedisCommandShim());
  for (let i = 0; i < 3; i += 1) assert.equal(reserve(run, "image", `combined-image-${i}`, `combined-image-${i}`)[0], "RESERVED");
  assert.equal(reserve(run, "video", "combined-video", "combined-video")[0], "RESERVED");
  assert.equal(reserve(run, "image", "synthetic-overall-block", "synthetic-overall-block", "2026-09-30", { overallBudget: 0 })[0], "OVERALL_BUDGET");
});

test("overall budget boundary blocks a request even when its kind pool has room", () => {
  const redis = new RedisCommandShim(); const run = createLuaRunner(redis);
  redis.values.set("budget:2026-09-30:overall", String(FREE_OVERALL_DAILY_BUDGET_MICRO_USD - FREE_COST_MICRO_USD.image + 1));
  const result = reserve(run, "image", "overall-floor", "overall-floor", "2026-09-30", { budget: FREE_DAILY_BUDGET_MICRO_USD.image, limit: 100 });
  assert.equal(result[0], "OVERALL_BUDGET");
});

test("UTC day reset starts fresh counters and same-IP burst remains bounded", async () => {
  const redis = new RedisCommandShim(); const run = createLuaRunner(redis);
  const nextDay = reserve(run, "image", "next-day", "same-ip", "2026-10-01");
  assert.equal(nextDay[0], "RESERVED");
  const attempts = await Promise.all(Array.from({ length: 100 }, (_, index) => Promise.resolve().then(() => reserve(run, "image", `burst-${index}`, "ip-burst")[0])));
  assert.equal(attempts.filter((state) => state === "RESERVED").length, 3);
  assert.equal(attempts.filter((state) => state === "LIMIT").length, 97);
});

test("release EVAL refunds kind and overall reservation once", () => {
  const redis = new RedisCommandShim(); const run = createLuaRunner(redis);
  const reservationKeys = keys("2026-09-30", "ip-release", "image", "release-job");
  assert.equal(run(RESERVE_SCRIPT, reservationKeys, args({ id: "release-job", hash: "release-hash", limit: FREE_LIMITS.image, cost: FREE_COST_MICRO_USD.image, budget: FREE_DAILY_BUDGET_MICRO_USD.image }))[0], "RESERVED");
  const releaseKeys = [reservationKeys[4], reservationKeys[5], reservationKeys[0], reservationKeys[1], reservationKeys[2]];
  assert.equal(run(RELEASE_SCRIPT, releaseKeys, [String(FREE_COST_MICRO_USD.image), "86400"])[0], "RELEASED");
  assert.equal(run(RELEASE_SCRIPT, releaseKeys, [String(FREE_COST_MICRO_USD.image), "86400"])[0], "ALREADY_RELEASED");
});

test("upload abuse guard is atomic and independent from generation counters", () => {
  const redis = new RedisCommandShim(); const run = createLuaRunner(redis);
  const keys = ["upload:count:ip-a", "upload:bytes:ip-a"];
  assert.equal(run(UPLOAD_RESERVE_SCRIPT, keys, ["2", "100", "60", "600"])[0], "RESERVED");
  assert.equal(run(UPLOAD_RESERVE_SCRIPT, keys, ["2", "100", "60", "600"])[0], "LIMIT");
  assert.equal(redis.get("quota:2026-09-30:ip-a:image"), null);
});
