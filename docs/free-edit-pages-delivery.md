# Free-edit landing pages delivery verification

检查时间：2026-10-20T15:59:28.142Z
来源：https://www.ovanto.ai
来源类型：production
请求策略：GET only；无 Cookie；无 API；无生成请求。
最终状态：PASS

## D 表

| # | 交付 | 证据 | 状态 |
| ---: | --- | --- | --- |
| 1 | FR 新页 | URL：https://www.ovanto.ai/fr/retouche-photo-gratuite/；Title：Retouche Photo Gratuite — Sans Inscription \| Ovanto（51）；H1：Retouche Photo Gratuite en Ligne；HTTP：200 | 通过 |
| 2 | NL 新页 | URL：https://www.ovanto.ai/nl/ai-foto-bewerken-gratis/；Title：AI Foto Bewerken Gratis — Zonder Registratie \| Ovanto（53）；H1：AI Foto Bewerken Gratis；HTTP：200 | 通过 |
| 3 | hreflang | 两页各 3 条，FR/NL/x-default 一致，未指向 /edit/ | 通过 |
| 4 | JSON-LD | 两页完整 WebApplication + FAQPage 原文见下 | 通过 |
| 5 | FAQ 一致性 | 页面 details.faq-item 与 FAQPage.mainEntity 逐条对照见下 | 通过 |
| 6 | 内链 | 四个来源页各新增 1 条 context-links 入链，原文见下 | 通过 |
| 7 | 自指锚 | 3 个主 CTA、edit-workbench id、active mode 自指证据见下 | 通过 |
| 8 | sitemap | 19 loc；新增 2 条 loc 原文见下 | 通过 |

## FR/NL 意图分工

| 页面 | 主词 | 页面定位 |
| --- | --- | --- |
| /fr/retouche-photo-gratuite/ | retouche photo gratuite | 免费修图、不注册、每日额度和限制；AI 只作为实现方式 |
| /nl/ai-foto-bewerken-gratis/ | ai foto bewerken gratis | 免费 AI 修图、不注册、每日额度和限制；现有 NL 页面正文与 TDK 冻结，仅增加本单指定回链 |
| /fr/retouche-photo-ia/ | retouche photo ia | AI 修图能力、模型与 prompt 方法 |
| /nl/foto-bewerken-ai/ | 现有页面定位 | 正文与 TDK 冻结，仅增加本单指定回链 |

## hreflang 原文

### FR

~~~html
<link rel="alternate" hrefLang="fr" href="https://www.ovanto.ai/fr/retouche-photo-gratuite/"/>
<link rel="alternate" hrefLang="nl" href="https://www.ovanto.ai/nl/ai-foto-bewerken-gratis/"/>
<link rel="alternate" hrefLang="x-default" href="https://www.ovanto.ai/fr/retouche-photo-gratuite/"/>
~~~

### NL

~~~html
<link rel="alternate" hrefLang="fr" href="https://www.ovanto.ai/fr/retouche-photo-gratuite/"/>
<link rel="alternate" hrefLang="nl" href="https://www.ovanto.ai/nl/ai-foto-bewerken-gratis/"/>
<link rel="alternate" hrefLang="x-default" href="https://www.ovanto.ai/fr/retouche-photo-gratuite/"/>
~~~

两页的 hreflang 集合均为 fr → https://www.ovanto.ai/fr/retouche-photo-gratuite/、nl → https://www.ovanto.ai/nl/ai-foto-bewerken-gratis/、x-default → https://www.ovanto.ai/fr/retouche-photo-gratuite/；没有指向 /edit/。

## JSON-LD 原文

### FR

~~~html
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"Retouche Photo Gratuite en Ligne","url":"https://www.ovanto.ai/fr/retouche-photo-gratuite/","applicationCategory":"MultimediaApplication","operatingSystem":"Web","browserRequirements":"Requires a modern web browser","isAccessibleForFree":true,"description":"Retouchez une photo gratuitement en ligne, sans inscription : téléversez un fichier, utilisez votre quota quotidien et téléchargez le résultat.","inLanguage":"fr"}</script>
~~~

~~~html
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","url":"https://www.ovanto.ai/fr/retouche-photo-gratuite/","mainEntity":[{"@type":"Question","name":"La retouche photo est-elle vraiment gratuite ?","acceptedAnswer":{"@type":"Answer","text":"Oui. Vous pouvez effectuer 1 retouche par jour et par IP sans inscription. Le quota se réinitialise à 00:00 UTC."}},{"@type":"Question","name":"Faut-il créer un compte pour retoucher une photo ?","acceptedAnswer":{"@type":"Answer","text":"Non. Téléversez une image JPEG, PNG, GIF ou WEBP de 10 Mo maximum, décrivez la retouche, puis comparez et téléchargez le résultat sans créer de compte."}},{"@type":"Question","name":"Quels fichiers et quelles limites s'appliquent ?","acceptedAnswer":{"@type":"Answer","text":"Les fichiers JPEG, PNG, GIF et WEBP jusqu'à 10 Mo sont acceptés. Le quota gratuit commun aux parcours de retouche est limité à 1 retouche par jour et par IP ; les retouches illimitées et par lots ne sont pas incluses."}}]}</script>
~~~

### NL

~~~html
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"AI Foto Bewerken Gratis","url":"https://www.ovanto.ai/nl/ai-foto-bewerken-gratis/","applicationCategory":"MultimediaApplication","operatingSystem":"Web","browserRequirements":"Requires a modern web browser","isAccessibleForFree":true,"description":"Bewerk gratis een foto met AI zonder registratie. Upload een bestand, gebruik je dagelijkse gratis bewerking en download het resultaat online.","inLanguage":"nl"}</script>
~~~

~~~html
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","url":"https://www.ovanto.ai/nl/ai-foto-bewerken-gratis/","mainEntity":[{"@type":"Question","name":"Kan ik gratis een foto bewerken met AI?","acceptedAnswer":{"@type":"Answer","text":"Ja. Je kunt zonder account 1 foto per dag per IP bewerken. Het gratis quotum wordt om 00:00 UTC vernieuwd."}},{"@type":"Question","name":"Heb ik registratie nodig om een foto te bewerken?","acceptedAnswer":{"@type":"Answer","text":"Nee. Upload een JPEG-, PNG-, GIF- of WEBP-afbeelding van maximaal 10 MB, beschrijf de bewerking en bekijk en download het resultaat zonder account."}},{"@type":"Question","name":"Welke bestanden en beperkingen gelden er?","acceptedAnswer":{"@type":"Answer","text":"JPEG-, PNG-, GIF- en WEBP-bestanden tot 10 MB worden ondersteund. Het gedeelde gratis quotum voor bewerkingsroutes is 1 bewerking per dag per IP; onbeperkt en batchmatig bewerken is niet inbegrepen."}}]}</script>
~~~

## FAQ 逐条对照

| 页面/条目 | 页面问题 | 页面答案 | JSON-LD 问题 | JSON-LD 答案 | 比对 |
| --- | --- | --- | --- | --- | --- |
| FR 1 | La retouche photo est-elle vraiment gratuite ? | Oui. Vous pouvez effectuer 1 retouche par jour et par IP sans inscription. Le quota se réinitialise à 00:00 UTC. | La retouche photo est-elle vraiment gratuite ? | Oui. Vous pouvez effectuer 1 retouche par jour et par IP sans inscription. Le quota se réinitialise à 00:00 UTC. | 一致 |
| FR 2 | Faut-il créer un compte pour retoucher une photo ? | Non. Téléversez une image JPEG, PNG, GIF ou WEBP de 10 Mo maximum, décrivez la retouche, puis comparez et téléchargez le résultat sans créer de compte. | Faut-il créer un compte pour retoucher une photo ? | Non. Téléversez une image JPEG, PNG, GIF ou WEBP de 10 Mo maximum, décrivez la retouche, puis comparez et téléchargez le résultat sans créer de compte. | 一致 |
| FR 3 | Quels fichiers et quelles limites s'appliquent ? | Les fichiers JPEG, PNG, GIF et WEBP jusqu'à 10 Mo sont acceptés. Le quota gratuit commun aux parcours de retouche est limité à 1 retouche par jour et par IP ; les retouches illimitées et par lots ne sont pas incluses. | Quels fichiers et quelles limites s'appliquent ? | Les fichiers JPEG, PNG, GIF et WEBP jusqu'à 10 Mo sont acceptés. Le quota gratuit commun aux parcours de retouche est limité à 1 retouche par jour et par IP ; les retouches illimitées et par lots ne sont pas incluses. | 一致 |
| NL 1 | Kan ik gratis een foto bewerken met AI? | Ja. Je kunt zonder account 1 foto per dag per IP bewerken. Het gratis quotum wordt om 00:00 UTC vernieuwd. | Kan ik gratis een foto bewerken met AI? | Ja. Je kunt zonder account 1 foto per dag per IP bewerken. Het gratis quotum wordt om 00:00 UTC vernieuwd. | 一致 |
| NL 2 | Heb ik registratie nodig om een foto te bewerken? | Nee. Upload een JPEG-, PNG-, GIF- of WEBP-afbeelding van maximaal 10 MB, beschrijf de bewerking en bekijk en download het resultaat zonder account. | Heb ik registratie nodig om een foto te bewerken? | Nee. Upload een JPEG-, PNG-, GIF- of WEBP-afbeelding van maximaal 10 MB, beschrijf de bewerking en bekijk en download het resultaat zonder account. | 一致 |
| NL 3 | Welke bestanden en beperkingen gelden er? | JPEG-, PNG-, GIF- en WEBP-bestanden tot 10 MB worden ondersteund. Het gedeelde gratis quotum voor bewerkingsroutes is 1 bewerking per dag per IP; onbeperkt en batchmatig bewerken is niet inbegrepen. | Welke bestanden en beperkingen gelden er? | JPEG-, PNG-, GIF- en WEBP-bestanden tot 10 MB worden ondersteund. Het gedeelde gratis quotum voor bewerkingsroutes is 1 bewerking per dag per IP; onbeperkt en batchmatig bewerken is niet inbegrepen. | 一致 |

## 四个来源页新增入链

| 来源页 | 目标页 | 数量 |
| --- | --- | ---: |
| /fr/ | /fr/retouche-photo-gratuite/ | 1 |
| /fr/retouche-photo-ia/ | /fr/retouche-photo-gratuite/ | 1 |
| /nl/ | /nl/ai-foto-bewerken-gratis/ | 1 |
| /nl/foto-bewerken-ai/ | /nl/ai-foto-bewerken-gratis/ | 1 |

完整入链原始 HTML：

### /fr/

~~~html
<a class="context-link" href="/fr/retouche-photo-gratuite/">Retouche photo gratuite</a>
~~~

### /fr/retouche-photo-ia/

~~~html
<a class="context-link" href="/fr/retouche-photo-gratuite/">Retouche photo gratuite</a>
~~~

### /nl/

~~~html
<a class="context-link" href="/nl/ai-foto-bewerken-gratis/">AI foto bewerken gratis</a>
~~~

### /nl/foto-bewerken-ai/

~~~html
<a class="context-link" href="/nl/ai-foto-bewerken-gratis/">AI foto bewerken gratis</a>
~~~

## 自指 CTA 与 id 证据

| 页面 | 3 个 CTA href | edit-workbench id |
| --- | --- | --- |
| FR | `/fr/retouche-photo-gratuite/#edit-workbench`<br>`/fr/retouche-photo-gratuite/#edit-workbench`<br>`/fr/retouche-photo-gratuite/#edit-workbench` | `<div class="tool-wrap" id="edit-workbench">` |
| NL | `/nl/ai-foto-bewerken-gratis/#edit-workbench`<br>`/nl/ai-foto-bewerken-gratis/#edit-workbench`<br>`/nl/ai-foto-bewerken-gratis/#edit-workbench` | `<div class="tool-wrap" id="edit-workbench">` |

完整 CTA 与 id 原始 HTML：

### FR

~~~html
<a href="/fr/retouche-photo-gratuite/#edit-workbench">Ouvrir l&#x27;espace de retouche<!-- --> <span aria-hidden="true">→</span></a>
<a href="/fr/retouche-photo-gratuite/#edit-workbench">Essayer une retouche gratuite<!-- --> <span aria-hidden="true">→</span></a>
<a href="/fr/retouche-photo-gratuite/#edit-workbench">Commencer une retouche<!-- --> <span aria-hidden="true">→</span></a>
<div class="tool-wrap" id="edit-workbench">
~~~

### NL

~~~html
<a href="/nl/ai-foto-bewerken-gratis/#edit-workbench">Open de fotobewerker<!-- --> <span aria-hidden="true">→</span></a>
<a href="/nl/ai-foto-bewerken-gratis/#edit-workbench">Probeer gratis fotobewerking<!-- --> <span aria-hidden="true">→</span></a>
<a href="/nl/ai-foto-bewerken-gratis/#edit-workbench">Start een bewerking<!-- --> <span aria-hidden="true">→</span></a>
<div class="tool-wrap" id="edit-workbench">
~~~

active mode 原始 HTML：

### FR

~~~html
<a class="workbench-mode is-active" href="/fr/retouche-photo-gratuite/#edit-workbench" aria-current="page">Retouche</a>
~~~

### NL

~~~html
<a class="workbench-mode is-active" href="/nl/ai-foto-bewerken-gratis/#edit-workbench" aria-current="page">Bewerken</a>
~~~

## Sitemap

- 实际状态：200
- loc 数量：19（目标 19）
- 新增 loc：

~~~xml
<loc>https://www.ovanto.ai/fr/retouche-photo-gratuite/</loc>
<loc>https://www.ovanto.ai/nl/ai-foto-bewerken-gratis/</loc>
~~~

## 明确不做范围

| 事项 | 本轮处理 |
| --- | --- |
| 意语修图页 | 不做 |
| `foto bewerken met ai` 单独页 | 不做 |
| 修改 `/nl/foto-bewerken-ai/` Title | 不做 |
| 修改现有页面 TDK | 不做 |
| 新语种 | 不做 |
| 支付、生成、API、额度规则 | 不做 |

## 主 agent 验证标记

以下结果由主 agent 在共享工作树中确认，验收脚本本身没有执行这些命令：

- npm test：167/167 PASS
- npm run typecheck：PASS
- npm run build：PASS
- 冻结的旧页面 TDK 与 NL 正文证据：docs/validation/free-edit-pages/scope.json

## 验收记录

详细 JSON 证据：[validation/free-edit-pages/production.json](validation/free-edit-pages/production.json)

失败检查数：0

## 发布记录

- 生产代码 commit：`bca08183b54325ef8fb6a5a0003e5034a83f15e4`
- Deployment：`dpl_FR185Lia1p6ZcH72b3vYoDnhVxM8`，READY，已绑定 https://www.ovanto.ai
- 生产 HTML 检查：46 项，0 项失败。
- [发布证据](validation/free-edit-pages/deployment.json) · [冻结范围证据](validation/free-edit-pages/scope.json)
