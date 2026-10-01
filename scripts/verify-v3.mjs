import { readFile, writeFile, mkdir } from 'node:fs/promises';
const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const brief = (await readFile(new URL('../docs/ovanto-brief-v3.txt', import.meta.url), 'utf8')).replace(/\r/g, '');
const decode = (s) => s.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, dec) => String.fromCodePoint(parseInt(hex || dec, hex ? 16 : 10))).replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const text = (s) => decode(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const failures = [], rows = [], pages = new Map();
const check = (ok, label) => { if (!ok) failures.push(label); };
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1] || '');
const alternates = { en:'https://ovanto.ai/', it:'https://ovanto.ai/it/', fr:'https://ovanto.ai/fr/', nl:'https://ovanto.ai/nl/', 'x-default':'https://ovanto.ai/' };
for (const block of brief.split(/^### /m).slice(1,8)) {
  const field = (name) => block.match(new RegExp(`^- ${name}: (.+)$`, 'm'))?.[1];
  const url = field('URL'), path = new URL(url).pathname;
  const locale = path.startsWith('/it') ? 'it' : path.startsWith('/fr') ? 'fr' : path.startsWith('/nl') ? 'nl' : 'en';
  const res = await fetch(base+path,{redirect:'manual',headers:{'x-ovanto-locale':'ru'}});
  const html = await res.text(); pages.set(path,html);
  const body = html.match(/<body\b[\s\S]*<\/body>/)?.[0] || '';
  const visible = text(body.replace(/<script\b[\s\S]*?<\/script>/g,''));
  const desc = block.match(/^- Description: ([\s\S]*?)\n- H1:/m)?.[1].replace(/\n\s+/g,' ').trim();
  const h2 = [...block.slice(block.indexOf('- H2:')).matchAll(/^  \d\. (.+)$/gm)].slice(0,4).map(m=>m[1]);
  const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map(m=>m[0]);
  const meta = (name) => metas.find(t=>attr(t,'name')===name || attr(t,'property')===name) || '';
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]);
  const canonical = links.filter(t=>attr(t,'rel')==='canonical'), alternate = links.filter(t=>attr(t,'rel')==='alternate');
  const c=(ok,label)=>check(ok,path+': '+label);
  const mainCopy = text((body.match(/<main\b[\s\S]*?<\/main>/)?.[0] || '').replace(/<script\b[\s\S]*?<\/script>/g,''));
  const words = (mainCopy.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
  c(words >= 800 && words <= 1500,'main content 800–1500 words');
  c(res.status===200,'HTTP 200 without redirect');
  c(attr(html.match(/<html\b[^>]*>/)?.[0]||'','lang')===locale,'server lang / spoof prevention');
  c(text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]||'')===field('Title'),'exact Title');
  c(attr(meta('description'),'content')===desc,'exact Description');
  const h1=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  c(h1.length===1 && text(h1[0][1])===field('H1'),'exact H1');
  c(JSON.stringify([...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(m=>text(m[1])))===JSON.stringify(h2),'exact H2 order');
  c(canonical.length===1 && attr(canonical[0],'href')===url,'one exact canonical');
  c(alternate.length===5,'exactly five hreflangs');
  for(const [lang,href] of Object.entries(alternates)) c(alternate.some(t=>attr(t,'hreflang')===lang && attr(t,'href')===href),'hreflang '+lang);
  c(!meta('keywords'),'no keywords');
  for(const [key,val] of Object.entries({'og:title':field('Title'),'og:description':desc,'og:url':url,'og:type':'website','twitter:card':'summary_large_image','twitter:title':field('Title'),'twitter:description':desc})) c(attr(meta(key),'content')===val,key);
  c(attr(meta('og:image'),'content').startsWith('https://ovanto.ai/'),'absolute OG image');
  const schemas=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const faq=schemas.find(s=>s['@type']==='FAQPage'), h3=[...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map(m=>text(m[1]));
  c(faq?.mainEntity.length===3,'three FAQ questions');
  for(const q of faq?.mainEntity||[]) { c(h3.includes(q.name),'FAQ H3: '+q.name); c(visible.includes(q.acceptedAnswer.text),'FAQ answer visible'); }
  c(schemas.filter(s=>s['@type']==='WebApplication').length===Number(['/', '/it/', '/fr/', '/nl/'].includes(path)),'WebApplication scope');
  const app = schemas.find(s=>s['@type']==='WebApplication');
  if(app) c(app.isAccessibleForFree===true,'WebApplication reflects free video allowance');
  const expectedTrust = brief.match(new RegExp(`^  ${locale}: (.+)$`,'m'))?.[1].split(' · ');
  const actualTrust = [...body.matchAll(/<div class="trust-point"[^>]*>([\s\S]*?)<\/div>/g)].map(m=>text(m[1].replace(/<span class="trust-icon"[^>]*>[\s\S]*?<\/span>/g,'')));
  c(JSON.stringify(actualTrust)===JSON.stringify(expectedTrust),'exact v3 trust points');
  const anchors=[...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m=>({href:attr(m[1],'href'),text:text(m[2])}));
  c(anchors.length<=10,'at most ten body links'); c(anchors.every(a=>a.href.startsWith('/')),'absolute path links');
  c(!/Phase\s*[12]|Anteprima|segnaposto|non ancora collegata|100%\s*(free|gratis|gratuit)|unlimited|placeholder/i.test(visible),'no development / unlimited copy');
  c(!/<(?:button|textarea)\b[^>]*\bdisabled(?:=|\s|>)/i.test(body),'no disabled initial controls');
  const imgs=[...body.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]);
  c(imgs.length>=3 && imgs.every(t=>attr(t,'alt') && attr(t,'width') && attr(t,'height')),'three dimensioned accessible examples');
  rows.push({path,locale,status:res.status,links:anchors.length,faq:faq?.mainEntity.length,examples:imgs.length,words});
}
for(const line of brief.split('## 6.')[1].split('## 7.')[0].split('\n').filter(l=>l.startsWith('| /'))) {
  const [from,to,label]=line.split('|').slice(1,4).map(s=>s.trim()), path=from.replace(' 页脚','');
  const html=pages.get(path), scoped=from.includes('页脚') ? html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0]||'' : html;
  check([...scoped.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].some(m=>attr(m[1],'href')===to && text(m[2])===label),path+': exact matrix anchor '+label);
}
for(const path of ['/robots.txt','/sitemap.xml']) check((await fetch(base+path,{redirect:'manual'})).status===404,path+': held for Phase 6');
const og=await fetch(base+'/opengraph-image');check(og.status===200 && og.headers.get('content-type')?.startsWith('image/'),'OG image response');
await mkdir(new URL('../docs/validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../docs/validation/seo-v3.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),base,source:'docs/ovanto-brief-v3.txt',passed:!failures.length,pages:rows,failures},null,2)+'\n');
if(failures.length) {console.error(failures.map(s=>'FAIL '+s).join('\n'));process.exitCode=1;} else {console.table(rows);console.log('v3 SEO, FAQ, metadata, link matrix and initial UI checks passed for seven routes.');}
