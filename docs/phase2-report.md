# Ovanto v3 · Phase 2 执行与验收记录

本阶段按 `docs/ovanto-brief-v3.txt` 执行。v2 及此前 flux-2 / Veo / Kling v3 的冲突配置已弃用。当前是本地可审查实现，**尚未完成 Phase 2 外部验收**，没有部署或进入 Phase 3。

## 1. 改动文件

- 前端：`components/Generator.tsx`、`components/ToolPreview.tsx`、`components/PageShell.tsx`、`app/globals.css`、`lib/content.ts`。
- SEO：`lib/seo.ts`、`scripts/verify-seo.mjs`、`scripts/verify-v3.mjs`。
- API：`app/api/quota/route.ts`、`app/api/generations/route.ts`、`app/api/generations/[id]/route.ts`。
- 服务端：`lib/generation/config.ts`、`errors.ts`、`http.ts`、`identity.ts`、`provider.ts`、`redis.ts`、`scripts.ts`、`store.ts`、`turnstile.ts`、`validation.ts`。
- 示例素材：`public/examples/avatar.webp`、`sneaker.webp`、`landscape.webp`。这些是示意插画，未冒充真实供应商生成结果。
- 测试及配置：`tests/generation.test.ts`、`tests/lua-reservation.test.cjs`、`scripts/test-runner.mjs`、`package.json`、`package-lock.json`、`.env.example`、`.gitignore`。
- 文档与证据：`README.md`、`docs/ovanto-brief-v3.txt`、本报告、`docs/validation/*`。

工具具备请求、轮询、结果预览及下载流程。服务端固定免费图片为 Replicate flux-schnell 单张 WebP；免费视频为 FAL Wan 2.5、5 秒、480p。客户端不能指定模型、分辨率、秒数或付费身份。Turnstile 服务端校验先于配额预留及供应商调用。可信平台 IP 与地区、匿名任务所有权、幂等提交、共享 Redis Lua 原子预留一并实施。

## 2. 七页 SEO

生产构建后用任务书原文逐项比较。下面各页 Title、Description、H1/H2、canonical、5 个 hreflang、HTML lang、OG/Twitter 及内链矩阵均通过。无 keywords，未加入语言自动跳转。FAQ 每页 3 条，JSON-LD 与可见内容一致。

| URL | lang | HTTP | 出链 | 正文词数 | 检查 |
|---|---|---:|---:|---:|---|
| `/` | en | 200 | 8 | 973 | 通过 |
| `/it/` | it | 200 | 8 | 887 | 通过 |
| `/fr/` | fr | 200 | 10 | 927 | 通过 |
| `/fr/photo-ia-gratuit` | fr | 200 | 9 | 918 | 通过 |
| `/fr/modifier-photo-ia` | fr | 200 | 9 | 879 | 通过 |
| `/nl/` | nl | 200 | 9 | 843 | 通过 |
| `/nl/afbeeldingen-maken-met-ai` | nl | 200 | 9 | 833 | 通过 |

机器记录：`docs/validation/seo-v3.json`。本地可访问 7 页不表示已上线。robots/sitemap 按 Phase 6 保留未实现。

`npm run build` 通过，构建记录在 `docs/validation/build.txt`。词数按 main 中可见文字的 Unicode 单词计数，不计脚本和页眉页脚。每页含首屏 3 张示例及使用场景 3 张配图；法语、荷语首页的最新页面位复用原有内链，英、意语暂无内页，保留隐藏插槽。

## 3. 移动端截图

![意语页 375×667 首屏](validation/mobile-it-375x667.jpg)

375×667、scrollY=0 下，意语输入框底边 537.44px，生成按钮底边 597.05px，均在首屏；法语首页结果相同。无水平溢出。1440px 桌面意语 H1 为 2 行。浏览器检查没有 error/warn 日志；当前缺凭据时工具显示生成暂不可用。截图不是成功生成证明。

## 4. 限流与成本熔断记录

`npm test`：15/15 通过。测试实际执行服务端 Lua 文本，Redis 命令由 Fengari 测试模拟器提供；**不是生产 Redis 实测**。详细输出在 `docs/validation/tests.txt`。

| 触发场景 | 结果 |
|---|---|
| 单 IP 图片并发 100 次 | 3 次预留成功，97 次被 LIMIT 拒绝 |
| 图片池，每张 $0.003 | 1,666 次共 $4.998；下一次会超过 $5，BUDGET 拒绝 |
| 视频池，每条 $0.25 | 20 次共 $5；第 21 次 BUDGET 拒绝 |
| 单 IP 视频 | 每个 UTC 日最多 1 次 |
| IN / RU、未知地区 | 不授予免费额度 |
| 相同幂等键及内容 | 返回已有任务，不再预留或调用上游 |
| 相同幂等键不同内容 | 冲突拒绝 |
| 明确的供应商提交 4xx | 仅释放一次配额及成本预留 |
| 不确定的超时/5xx | 保留预留，避免漏记潜在计费 |
| 新 UTC 日 | 使用新的配额与成本键 |

图片与视频分别使用 $5 池，包含在途请求；IP 日额度与全站成本在同一原子脚本中判定。缺少配置时 `/api/quota` 返回 503，未调用上游。

## 5. 真实计费复核及阻塞

**尚未执行任何真实生成，实际账单复核结果为空。** 当前缺 Replicate、FAL、Turnstile 与 Upstash 配置，不能把模拟测试当作真实触发证据。

需在本机 `.env.local` 按 `.env.example` 配置服务凭据及公共 Turnstile site key，不要把密钥发在聊天里。当前实现选用 Vercel 可信请求头与 Upstash REST；没有创建外部账户或资源。正式验收仍需真实 Turnstile、Redis 并发及供应商生成/下载/费用核对。

付费图片 flux-dev、付费视频 Kling 2.5 Turbo Pro 的型号与成本已配置，但支付、权益验证与付费调用未实现，需确定免注册支付方案及售价。当前免费耗尽后有额度提示，没有可完成的购买流程。

修图页的指定服务只有文生图能力；任务书又限制工具控件为输入、生成及结果。未擅自把文生图称为修图，也未擅自加入上传和新的修图供应商，需要确定原图输入方式与模型。

LCP <2.5s / CLS <0.1 尚无正式部署性能测量。Phase 3 仅部署 `/it/`，必须在本阶段验收和用户确认后再执行。
