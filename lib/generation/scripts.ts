/**
 * All reservation mutations happen in Redis EVAL scripts. The counters include
 * in-flight reservations, so concurrent requests cannot burst through either a
 * per-IP allowance or a daily pool.
 */
export const RESERVE_SCRIPT = String.raw`
local existing = redis.call('GET', KEYS[4])
if existing then
  local separator = string.find(existing, '|', 1, true)
  if not separator then return {'STALE_IDEMPOTENCY'} end
  local existingJobId = string.sub(existing, 1, separator - 1)
  local existingHash = string.sub(existing, separator + 1)
  if existingHash ~= ARGV[7] then return {'CONFLICT'} end
  local existingJob = redis.call('GET', ARGV[10] .. existingJobId)
  if not existingJob then return {'STALE_IDEMPOTENCY'} end
  return {'EXISTING', existingJob}
end

local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local spent = tonumber(redis.call('GET', KEYS[2]) or '0')
local overallSpent = tonumber(redis.call('GET', KEYS[3]) or '0')
local limit = tonumber(ARGV[1])
local cost = tonumber(ARGV[2])
local budget = tonumber(ARGV[3])
local overallBudget = tonumber(ARGV[4])
if used >= limit then return {'LIMIT'} end
if spent + cost > budget then return {'BUDGET'} end
if overallSpent + cost > overallBudget then return {'OVERALL_BUDGET'} end

redis.call('INCR', KEYS[1])
redis.call('INCRBY', KEYS[2], cost)
redis.call('INCRBY', KEYS[3], cost)
redis.call('EXPIRE', KEYS[1], ARGV[8])
redis.call('EXPIRE', KEYS[2], ARGV[8])
redis.call('EXPIRE', KEYS[3], ARGV[8])
redis.call('SET', KEYS[4], ARGV[6] .. '|' .. ARGV[7], 'EX', ARGV[8])
redis.call('SET', KEYS[5], ARGV[5], 'EX', ARGV[9])
redis.call('SET', KEYS[6], 'active', 'EX', ARGV[9])
redis.call('SET', KEYS[7], ARGV[11], 'EX', ARGV[12], 'NX')
return {'RESERVED', ARGV[5], tostring(limit - used - 1)}
`;

export const RELEASE_SCRIPT = String.raw`
local marker = redis.call('GET', KEYS[2])
if marker ~= 'active' then return {'ALREADY_RELEASED'} end
local used = tonumber(redis.call('GET', KEYS[3]) or '0')
local spent = tonumber(redis.call('GET', KEYS[4]) or '0')
local overallSpent = tonumber(redis.call('GET', KEYS[5]) or '0')
local cost = tonumber(ARGV[1])
if used > 0 then redis.call('DECR', KEYS[3]) end
if spent >= cost then redis.call('DECRBY', KEYS[4], cost) end
if overallSpent >= cost then redis.call('DECRBY', KEYS[5], cost) end
redis.call('SET', KEYS[2], 'released', 'EX', ARGV[2])
return {'RELEASED'}
`;

/** Separate short-window upload protection. It never touches generation quotas. */
export const UPLOAD_RESERVE_SCRIPT = String.raw`
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
local bytes = tonumber(redis.call('GET', KEYS[2]) or '0')
local maxCount = tonumber(ARGV[1])
local maxBytes = tonumber(ARGV[2])
local size = tonumber(ARGV[3])
if count >= maxCount or bytes + size > maxBytes then return {'LIMIT'} end
redis.call('INCR', KEYS[1])
redis.call('INCRBY', KEYS[2], size)
redis.call('EXPIRE', KEYS[1], ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return {'RESERVED', tostring(maxCount - count - 1), tostring(maxBytes - bytes - size)}
`;

export const UPDATE_JOB_SCRIPT = String.raw`
local current = redis.call('GET', KEYS[1])
if not current then return {'NOT_FOUND'} end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return {'UPDATED'}
`;

