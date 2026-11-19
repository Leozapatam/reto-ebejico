import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const OUT_DIR = 'C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/shots/steer_modes';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9277',
    '--disable-gpu',
    '--window-size=1280,800',
    'http://127.0.0.1:5173/',
  ]);
  await sleep(2500);

  try {
    const res = await fetch('http://127.0.0.1:9277/json');
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

    // 1. Desktop Cover Menu with Steering Selector
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(1500);
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '01_desktop_cover_steer_selector.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 01_desktop_cover_steer_selector.png');

    // 2. Select Timón mode and start Contrarreloj (Desktop)
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btnWheel = document.querySelector('[data-el="optCtrlWheel"]');
        if (btnWheel) btnWheel.click();
        const btnStart = document.querySelector('[data-el="btnStart"]');
        if (btnStart) btnStart.click();
      })()`,
    });
    await sleep(2500);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '02_desktop_race_timon.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 02_desktop_race_timon.png');

    // 3. Toggle to Botones mode via HUD top button
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btnToggle = document.querySelector('[data-el="btnSteerToggle"]');
        if (btnToggle) btnToggle.click();
      })()`,
    });
    await sleep(1000);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '03_desktop_race_botones.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 03_desktop_race_botones.png');

    // 4. Mobile view: 390x844 with Botones
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(1500);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '04_mobile_race_botones.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 04_mobile_race_botones.png');

    // 5. Mobile view: Toggle to Timón
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btnToggle = document.querySelector('[data-el="btnSteerToggle"]');
        if (btnToggle) btnToggle.click();
      })()`,
    });
    await sleep(1000);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '05_mobile_race_timon.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 05_mobile_race_timon.png');

    // 6. Test dragging / steering the wheel
    await send('Runtime.evaluate', {
      expression: `(() => {
        const wheelBox = document.querySelector('[data-el="steerWheelBox"]');
        if (wheelBox) {
          const rect = wheelBox.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          wheelBox.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy - 20, pointerId: 1, bubbles: true }));
          wheelBox.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 45, clientY: cy - 20, pointerId: 1, bubbles: true }));
        }
      })()`,
    });
    await sleep(600);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '06_timon_turning_right.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 06_timon_turning_right.png');

    // 7. Test Pause Menu with Direction Control button
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btnPause = document.querySelector('[data-el="btnPause"]');
        if (btnPause) btnPause.click();
      })()`,
    });
    await sleep(1000);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '07_pause_menu_direction.png'), Buffer.from(shot.result.data, 'base64'));
    console.log('[OK] 07_pause_menu_direction.png');

    ws.close();
  } catch (err) {
    console.error('Error in capture:', err);
  } finally {
    edge.kill();
  }
}

run();
