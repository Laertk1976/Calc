const assert = require('node:assert/strict');

(async () => {
  const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
  const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
    else callback.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 600));
  const click = async label => {
    assert(await evaluate(`(()=>{const el=[...document.querySelectorAll('*')].find(e=>!e.children.length && !e.closest('[aria-hidden="true"]') && getComputedStyle(e).pointerEvents!=='none' && e.textContent===${JSON.stringify(label)});if(!el)return false;el.click();return true;})()`), `Missing ${label}`);
    await pause();
  };
  const checkBounds = async label => {
    const result = await evaluate(`(()=>{const els=[...document.querySelectorAll('input, [role="button"]')].filter(e=>e.getBoundingClientRect().width && !e.closest('[aria-hidden="true"]'));return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth, outside:els.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(e=>e.textContent||e.placeholder)}})()`);
    assert(!result.overflow, `${label}: page overflow`);
    assert.deepEqual(result.outside, [], `${label}: controls outside viewport`);
  };
  try {
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:8081' });
    for (let attempt = 0; attempt < 90; attempt++) {
      if (await evaluate(`document.body.innerText.includes('CALCULATOR')`)) break;
      await pause();
    }
    for (const [width, height] of [[330,640],[375,667],[430,932],[768,1024],[1100,800]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await pause();
      await checkBounds(`${width} calculator`);
      await click('Add');
      await checkBounds(`${width} save`);
      await click('Cancel');
      await click('List');
      await checkBounds(`${width} list`);
      await evaluate(`document.querySelector('[role="button"][aria-label="Search saved calculations"]').click()`);
      await pause();
      await evaluate(`document.querySelector('input[placeholder="Search saved calculations..."]').focus()`);
      await send('Input.insertText', { text: 'no-matching-calculation-938174' });
      await pause();
      assert(await evaluate(`document.body.innerText.includes('No matching calculations.')`), `${width}: list search filters entries`);
      await click('Close');
      await click('CALCULATOR');
      // Table cells deliberately scroll horizontally; its footer must stay on-screen.
      const footer = await evaluate(`['+ Add Row','Save PDF','Save CSV','Drive PDF','Drive CSV','Close'].map(t=>{const e=[...document.querySelectorAll('*')].find(e=>!e.children.length&&e.textContent===t);const r=e?.getBoundingClientRect();return {label:t,ok:!!r&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}})`);
      assert(footer.every(item=>item.ok), `${width} table footer: ${JSON.stringify(footer)}`);
      await click('Close');
      console.log(`PASS ${width}x${height}: calculator, save dialog, list, table footer`);
    }
    await click('CALCULATOR');
    await click('+ Add Row');
    await click('Comment...');
    await send('Emulation.setDeviceMetricsOverride', { width: 330, height: 320, deviceScaleFactor: 1, mobile: false });
    await pause();
    const commentActions = await evaluate(`['Cancel','Save'].map(t=>{const e=[...document.querySelectorAll('*')].find(e=>!e.children.length&&e.textContent===t);const r=e?.getBoundingClientRect();return {label:t,ok:!!r&&r.top>=0&&r.bottom<=innerHeight}})`);
    assert(commentActions.every(item=>item.ok), `Comments with reduced keyboard space: ${JSON.stringify(commentActions)}`);
    await click('Cancel');
    await send('Emulation.setDeviceMetricsOverride', { width: 330, height: 640, deviceScaleFactor: 1, mobile: false });
    await pause();
    await click('Close');
    console.log('PASS comments: Save and Cancel visible in a 330x320 viewport');
  } finally {
    socket.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
