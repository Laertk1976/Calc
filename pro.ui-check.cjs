const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve('.pro-web-check');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(8097, '127.0.0.1', resolve));
  const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
    '--remote-debugging-port=9237', `--user-data-dir=${path.resolve('.pro-browser-test')}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    let page;
    for (let i = 0; i < 60; i++) {
      try { page = (await (await fetch('http://127.0.0.1:9237/json')).json()).find(p => p.type === 'page'); if (page) break; } catch {}
      await delay(250);
    }
    assert(page, 'test browser starts');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let id = 0; const pending = new Map(); const errors = [];
    socket.addEventListener('message', event => {
      const value = JSON.parse(event.data);
      if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails);
      if (pending.has(value.id)) { const { resolve, reject } = pending.get(value.id); pending.delete(value.id); value.error ? reject(value.error) : resolve(value.result); }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async expression => { for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await delay(100); } throw new Error(`Timed out: ${expression}`); };
    const click = async selector => { assert(await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.click();return true;})()`), selector); await delay(150); };
    const clickText = async (text, scope = 'body') => {
      assert(await evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(scope)});const el=[...root.querySelectorAll('*')].find(e=>!e.children.length && e.textContent.trim()===${JSON.stringify(text)});if(!el)return false;el.click();return true;})()`), text);
      await delay(150);
    };
    const paywall = async () => {
      await waitFor(`document.body.innerText.includes('Unlock Calc Pro')`);
      assert(await evaluate(`document.body.innerText.includes('One-time purchase. No subscription.')`));
      await clickText('Close');
    };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Yerevan' });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:8097' });
    await waitFor(`!!document.querySelector('[data-testid="desktop-workspace"]')`);
    await evaluate(`(()=>{
      localStorage.clear(); localStorage.setItem('calculator.language','en'); localStorage.setItem('calculator.soundEnabled','false');
      const today=new Date(); const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1);
      localStorage.setItem('calculatorCalculations',JSON.stringify([
        {id:'today',title:'TODAY DEBT',type:'Cred',cred:'25',value:'25',savedAt:today.toISOString(),createdAt:today.toISOString()},
        {id:'old',title:'HIDDEN OLD DEBT',type:'Cred',cred:'50',value:'50',savedAt:yesterday.toISOString(),createdAt:yesterday.toISOString()},
        {id:'invoice',title:'TODAY INVOICE',type:'Fact',fact:'30',value:'30',savedAt:today.toISOString(),createdAt:today.toISOString()}
      ]));
    })()`);
    await send('Page.reload');
    await waitFor(`document.body.innerText.includes('TODAY DEBT')`);
    assert.equal(await evaluate(`document.body.innerText.includes('HIDDEN OLD DEBT')`), false);
    await click('[aria-label="Search saved calculations"]'); await paywall();
    await click('[aria-label^="Choose date range"]'); await paywall();
    await clickText('Table'); await paywall();
    assert.equal(await evaluate(`!!document.querySelector('[data-testid="desktop-panel-table"]')`), false);
    await clickText('Debts');
    assert.equal(await evaluate(`document.querySelector('[data-testid="desktop-panel-debts"]').innerText.includes('HIDDEN OLD DEBT')`), false);
    await clickText('All dates', '[data-testid="desktop-panel-debts"]'); await paywall();
    await click('[aria-label="Search names..."]'); await paywall();
    for (const action of ['Pay off', 'Delete', 'Edit']) { await clickText(action, '[data-testid="desktop-panel-debts"]'); await paywall(); }
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('calculatorCalculations')).length`), 3);
    await clickText('Invoices');
    await waitFor(`document.querySelector('[data-testid="desktop-panel-invoices"]').innerText.includes('TODAY INVOICE')`);
    await clickText('Pay off', '[data-testid="desktop-panel-invoices"]'); await paywall();
    await click('[data-testid="open-settings"]');
    await waitFor(`document.querySelector('[data-testid="settings-drawer"]').getBoundingClientRect().right <= innerWidth + 1`);
    assert(await evaluate(`document.querySelector('[data-testid="settings-drawer"]').innerText.includes('Synchronization')`));
    await click('[data-testid="language-menu"]');
    assert.equal(await evaluate(`document.querySelectorAll('[data-testid="drawer-languages"] [role="radio"]').length`), 6);
    await click('[data-testid="drawer-languages"] [role="radio"]:nth-child(3)');
    await waitFor(`document.querySelector('[data-testid="settings-drawer"]').innerText.includes('Синхронизация')`);
    await click('[data-testid="language-menu"]');
    await click('[data-testid="drawer-languages"] [role="radio"]:nth-child(2)');
    await click('[role="switch"][aria-label="Sound"]');
    await waitFor(`localStorage.getItem('calculator.soundEnabled') === 'true'`);
    await click('[role="switch"][aria-label="Sound"]');
    await click('[data-testid="settings-drawer"] [aria-label="Sign in"]');
    await waitFor(`!!document.querySelector('input[placeholder="Email"]')`);
    assert.equal(await evaluate(`!!document.querySelector('[data-testid="settings-drawer"]')`), false);
    await clickText('Cancel');
    await click('[data-testid="open-settings"]');
    await click('[data-testid="settings-drawer"] [aria-label="Unlock Pro"]');
    await waitFor(`document.body.innerText.includes('Unlock Calc Pro')`);
    const desktopShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('.pro-web-check/paywall-desktop.png', Buffer.from(desktopShot.data, 'base64'));
    await clickText('Close');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitFor(`!document.querySelector('[data-testid="desktop-workspace"]')`);
    await click('[data-testid="open-settings"]');
    await delay(300);
    const drawerBounds = await evaluate(`(()=>{const r=document.querySelector('[data-testid="settings-drawer"]').getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width};})()`);
    assert(drawerBounds.left > 0 && drawerBounds.right <= 391 && drawerBounds.width <= 366);
    await click('[data-testid="language-menu"]');
    const drawerShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('.pro-web-check/drawer-mobile.png', Buffer.from(drawerShot.data, 'base64'));
    await click('[aria-label="Close menu"]');
    await waitFor(`!document.querySelector('[data-testid="settings-drawer"]')`);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitFor(`!document.querySelector('[data-testid="desktop-workspace"]')`);
    await clickText('List');
    await waitFor(`document.body.innerText.includes('TODAY DEBT')`);
    assert.equal(await evaluate(`document.body.innerText.includes('HIDDEN OLD DEBT')`), false);
    await click('[aria-label^="Choose date range"]');
    await waitFor(`document.body.innerText.includes('Unlock Calc Pro')`);
    const mobileShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('.pro-web-check/paywall-mobile.png', Buffer.from(mobileShot.data, 'base64'));
    await clickText('Close');
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log('PASS: free-access gates; desktop/mobile right drawer; language selection; sound persistence; account/Pro navigation; backdrop close; records preserved.');
  } finally {
    socket?.close(); browser.kill(); server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
