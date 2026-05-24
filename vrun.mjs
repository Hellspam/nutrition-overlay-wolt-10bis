import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const code = readFileSync('/tmp/verify.js','utf8')
const b = await chromium.launch({ headless:true })
const p = await (await b.newContext({ locale:'he-IL', viewport:{width:1300,height:900}, deviceScaleFactor:2 })).newPage()
try {
  await p.goto('https://wolt.com/en/isr/petah-tikva/restaurant/lechem-bait',{waitUntil:'domcontentloaded',timeout:60000})
  await p.waitForSelector('[data-test-id="horizontal-item-card-button"]',{timeout:30000})
  let ok=false
  for(let i=0;i<6&&!ok;i++){
    await p.locator('[data-test-id="horizontal-item-card-button"]').nth(i).click({timeout:5000}).catch(()=>{})
    ok=await p.waitForFunction(()=>document.querySelector('[data-test-id="product-options-form"]'),{timeout:6000}).then(()=>1).catch(()=>0)
    if(!ok){await p.keyboard.press('Escape').catch(()=>{});await p.waitForTimeout(400)}
  }
  if(!ok){console.log('could not open a populated modal');await b.close();process.exit(0)}
  await p.evaluate(code)
  const wired = await p.evaluate(()=>window.__wire())
  await p.evaluate(()=>document.querySelector('.nutrition-overlay-badge-btn')?.click())
  await p.waitForTimeout(500)
  const info = await p.evaluate(()=>{
    const host=document.querySelector('.nutrition-overlay-badge-host')
    const form=document.querySelector('[data-test-id="product-options-form"]')
    const card=document.querySelector('.nutrition-overlay-badge-total')
    return { hostExists:!!host, cardText: card?card.textContent.replace(/\s+/g,' ').trim().slice(0,50):null,
      hostBeforeOptions: !!(host&&form&&(host.compareDocumentPosition(form)&Node.DOCUMENT_POSITION_FOLLOWING)) }
  })
  console.log(JSON.stringify({wired,...info},null,2))
  // screenshot the modal
  const modal = await p.$('[data-test-id="product-modal-container"]')
  if(modal) await modal.screenshot({ path:'/tmp/wolt-inflow.png' })
  console.log('screenshot saved')
} catch(e){ console.log('ERROR:',e.message) } finally{ await b.close() }
