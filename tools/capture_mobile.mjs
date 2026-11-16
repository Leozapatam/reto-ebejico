import { spawn } from 'child_process';
import fs from 'fs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9233',
    '--disable-gpu',
    '--window-size=390,844',
    'http://127.0.0.1:5173/',
  ]);
  await sleep(2500);

  try {
    const res = await fetch('http://127.0.0.1:9233/json');
    const tabs = await res.json();
    const gameTab = tabs.find((t) => t.url.includes('5173'));
    const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

    let id = 1;
    const callbacks = new Map();
    ws.onmessage = (evt) => {
      const d = JSON.parse(evt.data);
      if (d.id && callbacks.has(d.id)) {
        callbacks.get(d.id)(d);
        callbacks.delete(d.id);
      }
    };
    const send = (m, p = {}) =>
      new Promise((resolve) => {
        const cur = id++;
        callbacks.set(cur, resolve);
        ws.send(JSON.stringify({ id: cur, method: m, params: p }));
      });

    await new Promise((r) => (ws.onopen = r));
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(1500);

    // Start game
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('[data-el="btnStart"]')?.click();
      `,
    });
    await sleep(1200);

    // Wait past countdown (3-2-1-Ya!)
    await sleep(3500);

    // Dispatch pointerdown on gas button
    await send('Runtime.evaluate', {
      expression: `
        const gas = document.querySelector('[data-touch="gas"]');
        if (gas) {
          gas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
        }
      `,
    });
    await sleep(1500);

    const speedCheck = await send('Runtime.evaluate', {
      expression: `
        document.querySelector('[data-el="speedoVal"]')?.textContent
      `,
      returnByValue: true,
    });
    console.log('Speed with touch gas active:', speedCheck.result.result?.value);

    // Release gas
    await send('Runtime.evaluate', {
      expression: `
        const gas = document.querySelector('[data-touch="gas"]');
        if (gas) {
          gas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
        }
      `,
    });
    const info = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const tc = document.querySelector('.touch-controls');
          const gas = document.querySelector('[data-touch="gas"]');
          const brake = document.querySelector('[data-touch="brake"]');
          const left = document.querySelector('[data-touch="left"]');
          const right = document.querySelector('[data-touch="right"]');
          const respawn = document.querySelector('[data-touch="respawn"]');
          const drift = document.querySelector('[data-touch="drift"]');
          return {
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            tcDisplay: tc ? getComputedStyle(tc).display : null,
            gas: gas ? { rect: gas.getBoundingClientRect(), text: gas.innerText.trim() } : null,
            brake: brake ? { rect: brake.getBoundingClientRect(), text: brake.innerText.trim() } : null,
            left: left ? { rect: left.getBoundingClientRect() } : null,
            right: right ? { rect: right.getBoundingClientRect() } : null,
            respawn: respawn ? { rect: respawn.getBoundingClientRect(), text: respawn.innerText.trim() } : null,
            drift: drift ? { rect: drift.getBoundingClientRect(), text: drift.innerText.trim() } : null,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Mobile info 390x844:', JSON.stringify(info.result.result.value, null, 2));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      'C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/shots/mobile_controls_after_390.png',
      Buffer.from(shot.result.data, 'base64')
    );
    console.log('Saved mobile_controls_after_390.png');

    // Test narrow mobile (360 x 740)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 740,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(500);

    const shotNarrow = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      'C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/shots/mobile_controls_after_360.png',
      Buffer.from(shotNarrow.result.data, 'base64')
    );
    console.log('Saved mobile_controls_after_360.png');

    // Test landscape (844 x 390)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 844,
      height: 390,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(500);

    const shotLand = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(
      'C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/shots/mobile_controls_after_landscape.png',
      Buffer.from(shotLand.result.data, 'base64')
    );
    console.log('Saved mobile_controls_after_landscape.png');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edge.kill();
  }
}

run();
