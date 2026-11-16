import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const OUT_DIR = 'C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/shots/audit_final';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9244',
    '--disable-gpu',
    '--window-size=1280,800',
    'http://127.0.0.1:5173/',
  ]);
  await sleep(2500);

  try {
    const res = await fetch('http://127.0.0.1:9244/json');
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

    // 1. Desktop Cover
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(2000);
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '01_desktop_cover.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 01_desktop_cover.png');

    // 2. Mobile Cover
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(1500);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '02_mobile_cover.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 02_mobile_cover.png');

    // 3. Practice Track (desktop)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    // Click practice button and start
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btnTest = document.querySelector('[data-el="optTest"]');
        if (btnTest) btnTest.click();
        const btnStart = document.querySelector('[data-el="btnStart"]');
        if (btnStart) btnStart.click();
      })()`,
    });
    await sleep(2500);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '03_practice_smooth.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 03_practice_smooth.png');

    // Return to menu
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
      })()`,
    });
    await sleep(500);
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btnMenu = document.querySelector('[data-el="btnPauseMenu"]');
        if (btnMenu) btnMenu.click();
      })()`,
    });
    await sleep(1000);

    // 4. Contrarreloj (Competitive) Mode (Desktop)
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btnReal = document.querySelector('[data-el="optReal"]');
        if (btnReal) btnReal.click();
        const btnStart = document.querySelector('[data-el="btnStart"]');
        if (btnStart) btnStart.click();
      })()`,
    });
    await sleep(3500);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '04_contrarrelloj_lane.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 04_contrarrelloj_lane.png');

    // 5. Mobile Race HUD with clamped signs
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(2000);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '05_mobile_race_signs.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 05_mobile_race_signs.png');

    ws.close();
  } catch (err) {
    console.error('Error in capture:', err);
  } finally {
    edge.kill();
  }
}

run();
