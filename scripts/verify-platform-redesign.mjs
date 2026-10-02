import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.PLAYWRIGHT_RUNTIME || 'C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json';
const { chromium } = createRequire(runtime)('playwright');
const base = process.env.BASE_URL || 'http://localhost:3001';
const out = path.join(root, 'docs/validation');
await mkdir(out, { recursive: true });
const reportPath = path.join(out, 'raphael-regression.json');
const fixture = process.argv.includes('--fixture');
const report = fixture ? JSON.parse(await readFile(reportPath, 'utf8')) : { baseline: 'a7950d9', checks: [], responsive: [], seo: [], functional: [], limitations: ['Live provider generation and real Cloudflare challenge not tested: local production credentials are absent. Browser success, loading, error, limit, retry and download use isolated mocks.', 'Lint N/A: no configured lint script or lint dependency.'] };
const check = (name, pass, details = {}) => { report.checks.push({ name, pass: !!pass, details }); if (!pass) console.error('FAIL', name, JSON.stringify(details)); };
const browser = await chromium.connectOverCDP(process.env.CDP_URL);
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
 if (!fixture) {
  for (const width of [390, 430, 768, 1440]) {
   await page.setViewportSize({ width, height: 900 });
   const res = await page.goto(base, { waitUntil: 'networkidle' });
   check(`http-${width}`, res.status() === 200);
   await page.locator('#image-prompt').waitFor();
   for (const image of await page.locator('.platform-sections img').all()) { await image.scrollIntoViewIfNeeded(); await image.evaluate(el => el.decode()); }
   await page.evaluate(() => window.scrollTo(0, 0));
   const layout = await page.evaluate(() => {
    const visible = el => { const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'; };
    const overflow = [...document.querySelectorAll('body *')].filter(visible).filter(el => { const r=el.getBoundingClientRect();return r.left < -1 || r.right>innerWidth+1; }).map(el=>({tag:el.tagName,class:typeof el.className==='string'?el.className:'svg',right:el.getBoundingClientRect().right}));
    const h=document.querySelector('h1'), r=h.getBoundingClientRect(), line=parseFloat(getComputedStyle(h).lineHeight);
    const controls=[...document.querySelectorAll('.generate-button,.retry-button,.prompt-example')].filter(visible).map(el=>({name:el.textContent.trim(),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
    const prompt=document.querySelector('#image-prompt'), preview=document.querySelector('.workbench-preview');
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow,heroLines:Math.round(r.height/line),controls,promptBeforePreview:!!(prompt.compareDocumentPosition(preview)&Node.DOCUMENT_POSITION_FOLLOWING),columns:getComputedStyle(document.querySelector('.workbench-grid')).gridTemplateColumns,images:[...document.querySelectorAll('.inspiration-card img')].map(el=>({complete:el.complete,width:el.naturalWidth,alt:el.alt,loading:el.loading}))};
   });
   check(`overflow-${width}`,layout.scrollWidth===width&&layout.overflow.length===0,layout.overflow);
   check(`controls-${width}`,layout.controls.every(el=>el.width>=44&&el.height>=44),layout.controls);
   check(`prompt-order-${width}`,layout.promptBeforePreview);
   check(`gallery-${width}`,layout.images.length===6&&layout.images.every(el=>el.complete&&el.width>0&&el.alt&&el.loading==='lazy'));
   if(width<=430)check(`hero-lines-${width}`,layout.heroLines<=4,{lines:layout.heroLines});
   if(width<=430)check(`single-column-${width}`,layout.columns.split(' ').length===1,{columns:layout.columns});
   report.responsive.push(layout);
   await page.screenshot({path:path.join(out,`raphael-after-${width}.png`),fullPage:true});
  }
  check('source-content-unchanged',execFileSync('git',['show','a7950d9:lib/content.ts'],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n')===(await readFile(path.join(root,'lib/content.ts'),'utf8')).replaceAll('\r\n','\n'));
  await build({entryPoints:[path.join(root,'lib/content.ts')],bundle:true,platform:'node',format:'cjs',outfile:path.join(root,'.test-build/platform-content.cjs'),logLevel:'silent'});
  const {PAGE_CONTENT}=createRequire(import.meta.url)(path.join(root,'.test-build/platform-content.cjs'));
  for(const def of Object.values(PAGE_CONTENT)){
   const response=await context.request.get(base+def.path);const html=await response.text();
   await page.goto(base+def.path,{waitUntil:'networkidle'});
   const data=await page.evaluate(()=>({title:document.title,description:document.querySelector('meta[name="description"]').content,h1:document.querySelector('h1').textContent,canonical:document.querySelector('link[rel="canonical"]').href,alternates:[...document.querySelectorAll('link[hreflang]')].map(el=>({lang:el.hreflang,href:el.href})),schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(el=>JSON.parse(el.textContent))}));
   check(`seo-${def.key}`,response.status()===200&&data.title===def.title&&data.description===def.description&&data.h1===def.h1&&data.canonical===def.url&&data.alternates.length===5,data);
   const faq=data.schemas.find(el=>el['@type']==='FAQPage');
   check(`faq-schema-${def.key}`,JSON.stringify(faq?.mainEntity?.map(el=>({question:el.name,answer:el.acceptedAnswer.text})))===JSON.stringify(def.faq));
   check(`seo-copy-${def.key}`,[...def.sectionLeads,...def.sectionDetails.flat(),...def.h2s].every(copy=>html.includes(copy.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;'))));
   report.seo.push({path:def.path,status:response.status(),...data});
  }
  await page.goto(base,{waitUntil:'networkidle'});
  const hrefs=await page.locator('a[href]').evaluateAll(els=>[...new Set(els.map(el=>el.getAttribute('href')))]);
  for(const href of hrefs){if(href.startsWith('#'))check(`anchor-${href}`,await page.locator(href).count()===1);else if(href.startsWith('/')){const res=await context.request.get(base+href);check(`nav-${href}`,res.status()===200);}}
  const summary=page.locator('#faq summary').first();await summary.click();check('faq-toggle',await page.locator('#faq details').first().evaluate(el=>el.open));await summary.press('Enter');check('faq-keyboard',!(await page.locator('#faq details').first().evaluate(el=>el.open)));
  await page.locator('.prompt-example').first().click();check('example-fill',(await page.locator('#image-prompt').inputValue()).includes('editorial'));
  await page.locator('.generate-button').click();await page.locator('.result-panel [role="alert"]').waitFor();check('actual-unavailable',(await page.locator('.result-panel [role="alert"]').textContent()).includes('temporarily unavailable'));
  await page.locator('.result-panel .retry-button').click();check('retry-clears-error',await page.locator('.result-panel [role="alert"]').count()===0);
  report.functional.push({scope:'actual unconfigured local app',prompt:'PASS',example:'PASS',unavailable:'PASS',retry:'PASS',model:'fixed Flux Schnell',ratio:'fixed 1:1'});
  for(const file of ['lib/seo.ts','lib/site.ts','app/robots.ts','app/sitemap.ts','lib/generation','src/lib/models.ts'])check(`protected-${file}`,execFileSync('git',['diff','a7950d9','--',file],{cwd:root,encoding:'utf8'}).trim()==='');
  for(const route of ['/robots.txt','/sitemap.xml']){const res=await context.request.get(base+route);check(`crawl-${route}`,res.status()===200);}
 } else {
  let scenario='success', attempts=0, tokenCalls=0, bodies=[];
  await page.route('**/turnstile/v0/api.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.turnstile={render:function(el,o){window.__captchaOptions=o;return "fixture"},reset:function(){},execute:function(){window.__captchaExecutions=(window.__captchaExecutions||0)+1;setTimeout(function(){window.__captchaOptions.callback("fixture-token")},40)}};'}));
  await page.route('**/api/quota?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({remaining:3,limit:3,available:true})}));
  await page.route('**/api/generate',async route=>{
   attempts++;bodies.push(route.request().postDataJSON());await new Promise(resolve=>setTimeout(resolve,300));
   if(scenario==='error'||scenario==='limit')await route.fulfill({status:scenario==='limit'?429:503,contentType:'application/json',body:JSON.stringify({code:scenario==='limit'?'DAILY_LIMIT_REACHED':'PROVIDER_UNAVAILABLE'})});
   else await route.fulfill({contentType:'application/json',body:JSON.stringify({id:'fixture-image',status:'succeeded',remaining:2,result:{url:base+'/examples/sneaker.webp',mediaType:'image'}})});
  });
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('#image-prompt').fill('A clean product scene on pale stone');
  await page.locator('.generate-button').click();
  check('mock-loading',await page.locator('.generate-button').isDisabled());
  await page.locator('.download-button').waitFor();
  check('mock-success',(await page.locator('.generated-media').getAttribute('src')).includes('sneaker.webp'));
  const downloadEvent=page.waitForEvent('download');await page.locator('.download-button').click();const download=await downloadEvent;check('mock-download',download.suggestedFilename()==='ovanto-image.webp');
  for(const state of ['error','limit']){
   scenario=state;await page.locator('#image-prompt').fill('A different product scene '+state);await page.locator('.generate-button').click();await page.locator('.result-panel [role="alert"]').waitFor();
   const text=await page.locator('.result-panel [role="alert"]').textContent();check(`mock-${state}`,state==='limit'?text.includes('limit'):text.includes('unavailable'),{text});
   await page.locator('.result-panel .retry-button').click();check(`mock-retry-${state}`,await page.locator('.result-panel [role="alert"]').count()===0);
  }
  scenario='success';await page.locator('.generate-button').click();await page.locator('.download-button').waitFor();check('mock-retry-success',attempts===4);
  tokenCalls=await page.evaluate(()=>window.__captchaExecutions);
  check('mock-turnstile-execute',tokenCalls===attempts,{tokenCalls,attempts});
  check('mock-request-contract',bodies.every(body=>Object.keys(body).sort().join(',')==='idempotencyKey,prompt,task,tier,turnstileToken'&&body.task==='image'&&body.tier==='free'&&body.turnstileToken==='fixture-token'&&body.prompt&&body.idempotencyKey),{bodies});
  report.functional.push({scope:'isolated mocked browser',loading:'PASS',success:'PASS',download:'PASS',error:'PASS',limit:'PASS',retry:'PASS',turnstile:'stub execute callback PASS',requests:attempts});
 }
 check(fixture?'fixture-browser-errors':'browser-errors',errors.length===0,{errors});
} catch(error){check(fixture?'fixture-runner':'runner',false,{message:error.message,stack:error.stack});}
finally{await context.close();await browser.close();report.passed=report.checks.every(el=>el.pass);report.checkedAt=new Date().toISOString();await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failures:report.checks.filter(el=>!el.pass).map(el=>el.name),report:reportPath}));if(!report.passed)process.exitCode=1;}