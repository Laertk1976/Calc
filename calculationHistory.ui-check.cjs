const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
  const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let seq = 0;
  const waiting = new Map();
  socket.addEventListener('message', ({ data }) => {
    const response = JSON.parse(data);
    if (!response.id) return;
    const callback = waiting.get(response.id);
    waiting.delete(response.id);
    if (response.error) callback.reject(new Error(JSON.stringify(response.error)));
    else callback.resolve(response.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 300));
  const waitFor = async (expression, label) => {
    for (let i = 0; i < 70; i++) { if (await evaluate(expression)) return; await pause(); }
    throw new Error('Timed out: ' + label + '\n' + await evaluate('document.body.innerText'));
  };
  const click = async text => {
    await waitFor(`Array.from(document.querySelectorAll('*')).some(e=>e.textContent===${JSON.stringify(text)} && e.children.length===0)`, text);
    await evaluate(`Array.from(document.querySelectorAll('*')).find(e=>e.textContent===${JSON.stringify(text)} && e.children.length===0).click()`);
    await pause();
  };
  try {
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
    const sample = [{ id: 'history-ui-sample', createdAt: '2026-09-16T12:00:00.000Z', title: 'History sample', expression: '2 + 3', value: '5', type: 'Add' }];
    const seedMarker = `historyTestSeed-${Date.now()}`;
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `if(location.origin==='http://127.0.0.1:8081'&&!localStorage.getItem(${JSON.stringify(seedMarker)})){localStorage.setItem('calculatorCalculations',${JSON.stringify(JSON.stringify(sample))});localStorage.setItem(${JSON.stringify(seedMarker)},'yes');}` });
    await send('Page.navigate', { url: 'http://127.0.0.1:8081' });
    await click('CALCULATOR');
    await waitFor(`!!document.querySelector('input[placeholder="Name"]')`, 'table row');
    await evaluate(`(()=>{const input=document.querySelector('input[placeholder="Name"]');input.focus();input.select();})()`);
    await send('Input.insertText', { text: 'Edited sample' });
    await pause();
    await evaluate(`document.querySelector('input[placeholder="Name"]').blur()`);
    await waitFor(`JSON.parse(localStorage.getItem('calculatorCalculations'))[0].title==='Edited sample'`, 'saved name');
    await click('History');
    await waitFor(`document.body.innerText.includes('Before: History sample') && document.body.innerText.includes('After: Edited sample')`, 'old and new names');
    await click('Undo this edit');
    await waitFor(`JSON.parse(localStorage.getItem('calculatorCalculations'))[0].title==='History sample'`, 'undo name');
    await click('Back to table');
    await click('✕');
    await click('Confirm Delete');
    await waitFor(`!!JSON.parse(localStorage.getItem('calculatorCalculations'))[0].deletedAt`, 'soft delete');
    await waitFor(`!document.querySelector('input[placeholder="Name"]')`, 'deleted row excluded');
    await send('Page.reload');
    await click('CALCULATOR');
    await click('History');
    await click('Deleted rows');
    await waitFor(`document.body.innerText.includes('History sample') && document.body.innerText.includes('Restore calculation')`, 'recovery after reload');
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('.history-ui-check.png', Buffer.from(screenshot.data, 'base64'));
    await click('Restore calculation');
    await waitFor(`!JSON.parse(localStorage.getItem('calculatorCalculations'))[0].deletedAt`, 'restore');
    await click('Back to table');
    await waitFor(`document.querySelector('input[placeholder="Name"]')?.value==='History sample'`, 'restored row visible');
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('calculatorCalculations'))[0].history.length`), 4);
    await evaluate(`document.querySelector('input[placeholder="Formula / Info"]').focus();document.querySelector('input[placeholder="Formula / Info"]').select()`);
    await send('Input.insertText', { text: '4 + 5 = 9' });
    await pause();
    await evaluate(`document.querySelector('input[placeholder="Formula / Info"]').blur()`);
    await click('Cancel');
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('calculatorCalculations'))[0].history.length`), 4);
    assert.equal(await evaluate(`document.querySelector('input[placeholder="Formula / Info"]').value`), '2 + 3 = 5');
    await evaluate(`document.querySelector('input[placeholder="Formula / Info"]').focus();document.querySelector('input[placeholder="Formula / Info"]').select()`);
    await send('Input.insertText', { text: '4 + 5 = 9' });
    await pause();
    await evaluate(`document.querySelector('input[placeholder="Formula / Info"]').blur()`);
    await click('Confirm');
    await waitFor(`JSON.parse(localStorage.getItem('calculatorCalculations'))[0].info==='4 + 5 = 9'`, 'confirmed info');
    await click('Undo edit');
    await waitFor(`JSON.parse(localStorage.getItem('calculatorCalculations'))[0].info==='2 + 3 = 5'`, 'undo confirmed info');
    console.log('PASS: edit before/after, undo, delete, reload, history recovery, restore, canceled and confirmed number edits on mobile-size web UI.');
  } finally { socket.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
