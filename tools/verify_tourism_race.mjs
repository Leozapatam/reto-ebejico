import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/shots/polish_verification';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9236',
    '--disable-gpu',
    '--window-size=390,844',
    'http://127.0.0.1:5173/',
  ]);
  await sleep(2500);

  try {
    const res = await fetch('http://127.0.0.1:9236/json');
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

    // Select Turismo mode and start
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('[data-el="optTour"]')?.click();
        document.querySelector('[data-el="btnStart"]')?.click();
      `,
    });
    await sleep(3500);

    const tourCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const pin = document.querySelector('[data-el="btnTourGuide"]');
          const tourCard = document.querySelector('[data-el="tourCard"]');
          return {
            pinHidden: pin?.hidden,
            tourCardHidden: tourCard?.hidden,
            tourCardTitle: document.querySelector('[data-el="tourCardTitle"]')?.textContent,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('Tour mode check:', JSON.stringify(tourCheck.result.result?.value, null, 2));

    const shotTour = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '05_tourism_mobile_race.png'), Buffer.from(shotTour.result.data, 'base64'));
    console.log('Saved 05_tourism_mobile_race.png');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    edge.kill();
  }
}

run();
