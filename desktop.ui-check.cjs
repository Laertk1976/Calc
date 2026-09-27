const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9225/json')).json();
  const socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map(), errors = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (!message.id) return;
    const callback = pending.get(message.id); pending.delete(message.id);
    if (message.error) callback.reject(new Error(JSON.stringify(message.error))); else callback.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const pause = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
  const element = selector => `document.querySelector(${JSON.stringify(selector)})`;
  const click = async selector => { assert(await evaluate(`(()=>{const e=${element(selector)};if(!e)return false;e.click();return true;})()`), selector); await pause(); };
  const desktop = '[data-testid="desktop-workspace"]', calculator = '[data-testid="desktop-calculator"]';
  try {
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:8085' });
    for(let i=0;i<60;i++){if(await evaluate(`!!${element(desktop)}`))break;await pause();}
    assert(await evaluate(`!!${element(desktop)}`));
    await evaluate("localStorage.setItem('calculator.language','en')");
    const clickText = async (scope, text) => {
      assert(await evaluate('(()=>{const root='+element(scope)+';const e=[...root.querySelectorAll(\'*\')].find(e=>!e.children.length && e.textContent.trim()==='+JSON.stringify(text)+');if(!e)return false;e.click();return true;})()'), text);
      await pause();
    };
    await evaluate("localStorage.removeItem('calculatorCalculations')");
    await send('Page.reload'); await pause(1200);
    for(const key of ['AC','7','+','8','=']) await clickText(calculator,key);
    assert.equal(await evaluate(element('[aria-label="Edit calculation"]')+'.value'),'15');
    await clickText(calculator,'Debt');
    await evaluate(element('input[placeholder="Type a name or choose one below"]')+'.focus()');
    await send('Input.insertText',{text:'Desktop layout check'});
    await click('[aria-label="Save calculation"]');
    assert(await evaluate(element('[data-testid="desktop-panel-list"]')+'.innerText.includes("Desktop layout check")'),'saved row appears in list');
    await click('[aria-label="Search saved calculations"]');
    await evaluate(element('input[placeholder="Search saved calculations..."]')+'.focus()');
    await send('Input.insertText',{text:'Desktop layout check'});
    assert.equal(await evaluate('document.querySelectorAll(\'[role="tab"]\').length'),4);
    for (const name of ['table','debts','invoices','list']) {
      await click('[role="tab"]:nth-child('+({list:1,table:2,debts:3,invoices:4}[name])+')');
      assert(await evaluate(`${element('[data-testid="desktop-panel-'+name+'"]')}.getBoundingClientRect().height > 200`), name+' panel height');
      assert(await evaluate(`${element(calculator)}.getBoundingClientRect().width === 380`));
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), name+' page overflow');
    }
    assert.equal(await evaluate(element('input[placeholder="Search saved calculations..."]')+'.value'),'Desktop layout check','search persists across tabs');
    await click('[role="tab"]:nth-child(3)');
    assert(await evaluate(element('[data-testid="desktop-panel-debts"]')+'.innerText.includes("Desktop layout check")'),'saved debt appears');
    await click('[role="tab"]:nth-child(2)');
    await click('[aria-label="Expand table"]');
    assert.equal(await evaluate(`${element(calculator)}.getBoundingClientRect().width`),0);
    const tableScreenshot=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('desktop-table-preview.png',Buffer.from(tableScreenshot.data,'base64'));
    await click('[aria-label="Restore split view"]');
    await click('[role="tab"]:nth-child(1)');
    await click('[aria-label="Search saved calculations"]');
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('desktop-layout-preview.png',Buffer.from(screenshot.data,'base64'));
    for (const width of [1101,1100,768,390]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await pause();
      assert.equal(await evaluate(`!!${element(desktop)}`),width>1100,'breakpoint '+width);
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'overflow '+width);
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1101,height:800,deviceScaleFactor:1,mobile:false});
    await evaluate("localStorage.setItem('calculator.language','hy')");
    await send('Page.reload'); await pause(1500);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Armenian page overflow');
    assert(await evaluate(element(desktop)+'.getBoundingClientRect().width === 1101'),'Armenian desktop');
    const translated=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('desktop-armenian-preview.png',Buffer.from(translated.data,'base64'));
    await evaluate("localStorage.setItem('calculator.language','en')");
    assert.deepEqual(errors,[],'browser exceptions');
    console.log('PASS: desktop tabs, panel sizes, table expansion, 1100px breakpoint, mobile widths, no browser exceptions.');
  } finally { socket.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
