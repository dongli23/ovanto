# Ovanto Phase 5 交付自检

日期：2026-10-15。公开页面验收来源：`https://www.ovanto.ai`，检查时间：`2026-10-15T12:02:47.666Z`。以下公开页面结果来自生产站点。

Production 已部署并 promote：commit `04bcde372338011a858b2fc819d2f2de9d46f6d2`；deployment `dpl_Hf2JaTCs6MiqMHWsvCVxBNXK7Yan`；[部署 URL](https://ovanto-m55lskdwt-donglis-projects.vercel.app)。线上 verify-phase5：17/17 公开页面与页面检查通过，0 个失败，0 个 mutation request；来源 [https://www.ovanto.ai](https://www.ovanto.ai)，检查时间 `2026-10-15T12:02:47.666Z`。

| # | 交付 | 可复核证据 |
| ---: | --- | --- |
| 1 | A1 新页 | [URL](https://www.ovanto.ai/fr/retouche-photo-ia/)；Title：Retouche Photo IA — Améliorez Vos Photos \| Ovanto（49 字符）；H1：Retouche Photo IA : Améliorez Vos Photos。WebApplication + FAQPage 齐全。A1 单独增加后 16 条，A2 加入后最终 **17 条 sitemap**。五条 hreflang 见下表。 |
| 2 | A2 AUP | [URL](https://www.ovanto.ai/aup/)；内容标准、审核说明、举报渠道 hello@ovanto.ai、违规处理四块齐全。四语页脚分别为 Acceptable use / Uso accettabile / Utilisation acceptable / Aanvaardbaar gebruik，均指向 /aup/。 |
| 3 | A3 内链 | 下表逐页列出原有/补齐。原12工具页现在均有 tools-summary 三链和至少两条同语跨工具 context-links；法语增加新修饰页链接，未引入跨语种工具链。 |
| 4 | B1 TTFB | 同一 Node fetch 脚本、同一 https://www.ovanto.ai/、5 次无 Cookie GET：中位数 **367.97 ms → 175.69 ms**，改善 **192.28 ms（52.25%）**；首次 **1060.59 ms → 1558.66 ms**，增加 **498.07 ms，未改善**。优化后第一次响应为 PRERENDER，后 4 次为 HIT；这些测量不把首请求差异归因于冷启动。[优化前](validation/phase5/ttfb-before.json) / [优化后](validation/phase5/ttfb-after.json)。 |
| 5 | B2 Title | 原：Free AI Image Generator, No Sign Up — Create in Seconds \| Ovanto（64）；新：Free AI Image Generator, No Sign Up \| Ovanto（44）。关键词 free ai image generator / no sign up 均保留；og:title 同步为新标题。 |
| 6 | C1 筛查 | 实际 HTTP **403**；`{"error":{"code":"CONTENT_SAFETY_REVIEW","message":"This prompt requires additional review before generation."}}`；Waffo review 由应用以 HTTP 403 CONTENT_SAFETY_REVIEW 拦截；命中类别：adult_nsfw, csam_minor；额度 **3/3 → 3/3**；正常 prompt 放行：true。额度是该受保护 Vercel 暂存构建出口对应的 Production 匿名配额读数，不代表其他浏览器或 IP；私钥留在 Vercel，未导出。验证环境及原始日志见 [证据](validation/phase5/prompt-screening-real.json)。 |
| 7 | C2 条款 | 保留原16节、7天未使用退款承诺及§14法定权利；§6增加指回§14。仅补内容筛查、Waffo卖方/退款流程两组四语段落，原文附后。隐私政策仅补用户另行授权的筛查用途/接收方/日志披露。 |

## A1 hreflang

| hreflang | URL |
| --- | --- |
| fr | https://www.ovanto.ai/fr/retouche-photo-ia/ |
| en | https://www.ovanto.ai/edit/ |
| it | https://www.ovanto.ai/it/modifica-foto-ai/ |
| nl | https://www.ovanto.ai/nl/foto-bewerken-ai/ |
| x-default | https://www.ovanto.ai/edit/ |

新页主要讨论已有照片的光线、色彩、质感和细节改善；旧 /fr/modifier-photo-ia/ 保留按描述改变照片内容、对象和背景的定位。两页使用相同编辑能力，但主体文案与新页专用平台介绍不重复；不承诺无损恢复或专用超分算法。原12页的语言对应关系未改。

## A3 逐页清单

| 页面 | tools-summary 原状态 | context-links 原状态/处理 | 交付状态 |
| --- | --- | --- | --- |
| `/` | 已有三链 | 本次补齐（原无模块） | 三链及同语跨工具链齐全 |
| `/video/` | 已有三链 | 已有 | 三链及同语跨工具链齐全 |
| `/edit/` | 已有三链 | 已有 | 三链及同语跨工具链齐全 |
| `/it/immagini-ai/` | 已有三链 | 已有 | 三链及同语跨工具链齐全 |
| `/it/` | 已有三链 | 本次补齐（原无模块） | 三链及同语跨工具链齐全 |
| `/it/modifica-foto-ai/` | 已有三链 | 已有 | 三链及同语跨工具链齐全 |
| `/fr/photo-ia-gratuit/` | 已有三链 | 本次补齐（原模块缺跨工具链） | 三链及同语跨工具链齐全 |
| `/fr/` | 已有三链 | 已有 | 三链及同语跨工具链齐全 |
| `/fr/modifier-photo-ia/` | 已有三链 | 本次补齐（原模块缺跨工具链） | 三链及同语跨工具链齐全 |
| `/nl/` | 已有三链 | 本次补齐（原无模块） | 三链及同语跨工具链齐全 |
| `/nl/ai-video-maken/` | 已有三链 | 已有 | 三链及同语跨工具链齐全 |
| `/nl/foto-bewerken-ai/` | 已有三链 | 已有 | 三链及同语跨工具链齐全 |

原始基线：[12页生产抓取](validation/phase5/internal-links-before.json)。最终：[公开页面自检](validation/phase5/after-public.json)。

## B1 测量边界

旧版根布局读取 headers()，首页每次动态渲染且返回 private/no-store，5次均为 CDN MISS。首请求还包含连接建立等开销；没有细分服务端计时证据，不能把工单中的2433ms或首次较慢断言成纯SSR耗时或已确认冷启动。只将公共英语首页标记 force-static，利用其既有 en/root 默认值；其他语言与 API 保持动态。HTML 不含个人额度或余额，这些仍通过 no-store 客户端请求加载。优化后实测中位数由 367.97 ms 降至 175.69 ms（改善 192.28 ms，52.25%）；首次由 1060.59 ms 变为 1558.66 ms，未改善。第一次响应标记为 PRERENDER，后 4 次为 HIT；这些响应和缓存标记不足以把差异归因于冷启动。

## C1 验证边界

官方 SDK 扫描使用 semantic=enforce，仅 allow 放行，block/review 阻断，异常/超时失效关闭。免费路径在原 Turnstile/区域检查后、Redis额度预占前；付费路径在账号/输入校验后、余额预占前。日志仅含时间、UI语种、官方类别、是否放行与安全枚举原因，不含 prompt、IP、Token 或 Secret。SDK语言枚举不包含IT/FR/NL，因此不伪造该字段，独立记录真实界面语言；不声称自动检测覆盖所有政策违规，原有 provider 检查和人工举报复核保留。

真实 Waffo 验证在受保护的 Vercel 暂存 Production 构建中，通过 build-time loopback HTTP 安全门执行同一应用审核函数；私钥仅由 Vercel 构建环境读取，未导出。违规样例的 Waffo action 是 review，Waffo review 由应用以 HTTP 403 CONTENT_SAFETY_REVIEW 拦截，这不是 provider block；命中类别为 adult_nsfw, csam_minor。生产额度仅做前后 GET，读数是该构建出口对应的匿名配额，不代表其他用户或 IP；它不向 Production 生成接口发 POST，也不调用 Replicate/fal。当前检查不是 Production 生成 POST E2E。另有真实 free/paid POST 路由的隔离集成测试，证明拒绝时 reservation/provider/credit 操作次数均为0，免费3、付费2不变；这些测试使用 fixture，不冒充生产余额。

## C2 两段四语原文

下面原文由已渲染页面提取，不是四份完整条款翻译。

### EN

[内容筛查原文](https://www.ovanto.ai/terms/#content-safety-en)

> Generation prompts are screened by Waffo's content-safety service before a request reserves a free allowance or paid credit or is sent to an AI provider. Only an allow verdict proceeds; block, review or unavailable screening stops the request without a generation debit. Audit logs record the time, interface language, reported categories and whether the request was allowed, without recording prompt text. Provider checks vary by model; the free Wan video path also requests the provider safety checker. Screening and manual report review cannot guarantee detection of every violation. See our Acceptable Use Policy .

[Waffo / 退款流程原文](https://www.ovanto.ai/terms/#refund-process-en)

> Email hello@ovanto.ai from the email associated with your account and include the order ID and a short explanation. Do not send card numbers, security codes, passwords, or other payment secrets. We aim to acknowledge requests within 2 business days. For purchases through Waffo Pancake, Waffo is the merchant of record and seller identified at checkout; monetary refunds follow Waffo's refund request, review and processing procedure and the applicable checkout terms and law. Ovanto helps with product and order information and coordinates the request; it does not replace Waffo's approval or processing. Bank posting times may vary.

### IT

[内容筛查原文](https://www.ovanto.ai/terms/#content-safety-it)

> Italiano: I prompt sono controllati dal servizio di sicurezza dei contenuti di Waffo prima di riservare una quota gratuita o un credito a pagamento e prima dell'invio al provider AI. Solo l'esito allow prosegue; block, review o servizio non disponibile fermano la richiesta senza addebito di generazione. I log registrano data e ora, lingua dell'interfaccia, categorie segnalate ed esito, senza il testo del prompt. I controlli dei provider variano per modello; il video gratuito Wan richiede anche il controllo del provider. Nessun controllo automatico o manuale garantisce di rilevare tutte le violazioni. Consulta la politica di utilizzo accettabile .

[Waffo / 退款流程原文](https://www.ovanto.ai/terms/#refund-process-it)

> Italiano: Per gli acquisti tramite Waffo Pancake, Waffo è il venditore e merchant of record indicato al checkout. I rimborsi monetari seguono la sua procedura di richiesta, verifica ed elaborazione, le condizioni del checkout e la legge applicabile. Scrivi a hello@ovanto.ai con l'ID dell'ordine: Ovanto aiuta a raccogliere le informazioni e a coordinare la richiesta, senza sostituire l'approvazione di Waffo. La promessa di rimborso entro 7 giorni per crediti interamente inutilizzati non limita i diritti inderogabili della sezione 14.

### FR

[内容筛查原文](https://www.ovanto.ai/terms/#content-safety-fr)

> Français : Les prompts sont examinés par le service de sécurité des contenus de Waffo avant toute réservation de quota gratuit ou de crédit payant et tout envoi au fournisseur IA. Seul le verdict allow permet de continuer ; block, review ou une vérification indisponible arrêtent la demande sans débit de génération. Les journaux indiquent l'heure, la langue de l'interface, les catégories signalées et la décision, sans le texte du prompt. Les contrôles du fournisseur varient selon le modèle ; la vidéo gratuite Wan demande aussi son contrôle de sécurité. Les contrôles automatiques et l'examen des signalements ne garantissent pas la détection de toute violation. Consultez la politique d'utilisation acceptable .

[Waffo / 退款流程原文](https://www.ovanto.ai/terms/#refund-process-fr)

> Français : Pour les achats via Waffo Pancake, Waffo est le vendeur et merchant of record indiqué au paiement. Les remboursements monétaires suivent sa procédure de demande, d'examen et de traitement, les conditions du paiement et la loi applicable. Écrivez à hello@ovanto.ai avec l'identifiant de commande : Ovanto aide à réunir les informations et à coordonner la demande, sans se substituer à l'approbation de Waffo. La promesse de remboursement sous 7 jours pour des crédits entièrement inutilisés ne limite pas les droits impératifs de la section 14.

### NL

[内容筛查原文](https://www.ovanto.ai/terms/#content-safety-nl)

> Nederlands: Prompts worden door de inhoudsveiligheidsdienst van Waffo gecontroleerd voordat een gratis tegoed of betaald credit wordt gereserveerd en voordat een verzoek naar de AI-provider gaat. Alleen allow gaat door; block, review of een onbeschikbare controle stopt het verzoek zonder generatiedebet. Auditlogs bevatten tijdstip, interfacetaal, gemelde categorieën en besluit, zonder prompttekst. Providercontroles verschillen per model; de gratis Wan-videoroute vraagt ook de veiligheidscontrole van de provider aan. Automatische controles en handmatige beoordeling van meldingen kunnen niet elke overtreding ontdekken. Zie het beleid voor aanvaardbaar gebruik .

[Waffo / 退款流程原文](https://www.ovanto.ai/terms/#refund-process-nl)

> Nederlands: Bij aankopen via Waffo Pancake is Waffo de verkoper en merchant of record die bij het afrekenen wordt vermeld. Geldelijke terugbetalingen volgen de aanvraag-, beoordelings- en verwerkingsprocedure van Waffo, de betaalvoorwaarden en het toepasselijke recht. Mail hello@ovanto.ai met het bestelnummer: Ovanto helpt met informatie en afstemming, maar vervangt de goedkeuring van Waffo niet. De terugbetalingsbelofte van 7 dagen voor volledig ongebruikte credits beperkt de dwingende rechten in sectie 14 niet.

## 验证与范围

- npm test：165 项通过；npm run typecheck：通过；npm run build：通过。
- 浏览器：原51项通过；最终Phase5套件5项通过（含新增C1拒绝回归），API均为隔离fixture；客户端 Secret 检查通过。
- 无新语种，无原有URL重构，无支付/checkout/webhook/定价/schema/额度规则/provider切换。生成路由仅增加C1指定的前置审核。
- 官方依据：[Waffo Scan Prompt 契约](https://github.com/waffo-com/waffo-pancake-sdk-go/blob/main/content_safety.go)、[Waffo 对 MoR 卖方及退款流程的说明](https://www.waffo.ai/blog/what-is-merchant-of-record)。
