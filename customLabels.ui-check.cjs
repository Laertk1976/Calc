const assert = require('node:assert/strict');

(async () => {
  const pages = await (await fetch('http://127.0.0.1:9231/json')).json();
  const socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
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
    const id = ++sequence; pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 300));
  const element = selector => `document.querySelector(${JSON.stringify(selector)})`;
  const waitFor = async selector => {
    for (let i = 0; i < 100; i++) { if (await evaluate(`!!${element(selector)}`)) return; await pause(); }
    throw new Error('Missing ' + selector);
  };
  const click = async selector => {
    await waitFor(selector); await evaluate(`${element(selector)}.click()`); await pause();
  };
  const custom = async () => { await click('[aria-label^="Language:"]'); await click('[aria-label="Custom"]'); };
  const enterLabel = async (selector, text) => {
    await click(selector);
    await waitFor('input[aria-label^="Custom label:"]');
    await send('Input.insertText', { text });
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await pause();
    assert.equal(await evaluate(`!!${element('input[aria-label^="Custom label:"]')}`), false);
    assert.equal(await evaluate(`!!${element('[aria-label="Save calculation"]')}`), false, 'Enter only confirms the label');
  };
  try {
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:8081' });
    await waitFor('[data-testid="desktop-workspace"]');
    await evaluate("localStorage.setItem('calculator.language','en'); localStorage.removeItem('calculator.customLabels')");
    await send('Page.reload'); await pause(); await waitFor('[aria-label^="Language:"]');
    await custom();
    for (const [original, label] of [['Debt', 'Credit'], ['Invoice', 'Bank'], ['Cash Invoice', 'Cash']]) {
      const selector = `[role="button"][aria-label="Edit label: ${original}"]`;
      await waitFor(selector);
      assert.equal(await evaluate(`${element(selector)}.textContent.trim()`), '', 'new label starts blank');
      await enterLabel(selector, label);
    }
    await click('[role="tab"]:nth-child(2)');
    const table = await evaluate(`${element('[data-testid="desktop-panel-table"]')}.innerText`);
    for (const label of ['Credit', 'Bank', 'Cash']) assert(table.includes(label), label + ' table heading');
    assert.equal(await evaluate(`${element('[data-testid="desktop-calculator"]')}.getBoundingClientRect().width`), 380);
    await custom();
    assert.equal(await evaluate(`${element('[role="button"][aria-label="Edit label: Credit"]')}.textContent.trim()`), 'Credit');
    await enterLabel('[role="button"][aria-label="Edit label: Credit"]', 'Loan');
    await send('Page.reload'); await pause(); await waitFor('[role="button"][aria-label="Loan"]');
    await click('[aria-label^="Language:"]');
    await evaluate("[...document.querySelectorAll('[role=radio]')].find(e=>e.textContent.includes('English')).click()"); await pause();
    await waitFor('[role="button"][aria-label="Debt"]');
    await custom(); await waitFor('[role="button"][aria-label="Edit label: Loan"]');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await pause();
    await enterLabel('[role="button"][aria-label="Edit label: Loan"]', 'Mobile credit');
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'no mobile overflow');
    console.log('PASS: blank labels, Enter confirmation, table headings, editing, persistence, language reset, and mobile layout.');
  } finally { socket.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
