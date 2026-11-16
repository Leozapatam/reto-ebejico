import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/shots/polish_verification';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9235',
    '--disable-gpu',
    '--window-size=1280,800',
    'http://127.0.0.1:5173/',
  ]);
  await sleep(2500);

  try {
    const res = await fetch('http://127.0.0.1:9235/json');
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
    await sleep(1500);

    // 1. Cover / Menu screenshot (desktop)
    const shotMenu = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '01_cover_menu.png'), Buffer.from(shotMenu.result.data, 'base64'));
    console.log('Saved 01_cover_menu.png');

    // 2. Cover / Menu screenshot (mobile portrait 390x844)
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(500);
    const shotMenuMobile = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '02_cover_menu_mobile.png'), Buffer.from(shotMenuMobile.result.data, 'base64'));
    console.log('Saved 02_cover_menu_mobile.png');

    // 3. Competitive mode in mobile race: start race
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('[data-el="optReal"]')?.click();
        document.querySelector('[data-el="btnStart"]')?.click();
      `,
    });
    await sleep(3500);

    // Check visibility of btnTourGuide in competitive mode
    const compCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pin = document.querySelector('[data-el="btnTourGuide"]');
          const pause = document.querySelector('[data-el="btnPause"]');
          const tourCard = document.querySelector('[data-el="tourCard"]');
          return {
            pinHidden: pin?.hidden,
            tourCardHidden: tourCard?.hidden,
            pauseRect: pause?.getBoundingClientRect(),
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Competitive check:', JSON.stringify(compCheck.result.result?.value, null, 2));

    const shotComp = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '03_competitive_mobile_race.png'), Buffer.from(shotComp.result.data, 'base64'));
    console.log('Saved 03_competitive_mobile_race.png');

    // Tap pause button
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('[data-el="btnPause"]')?.click();
      `,
    });
    await sleep(800);

    const shotPause = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '04_pause_mobile.png'), Buffer.from(shotPause.result.data, 'base64'));
    console.log('Saved 04_pause_mobile.png');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edge.kill();
  }
}

run();
