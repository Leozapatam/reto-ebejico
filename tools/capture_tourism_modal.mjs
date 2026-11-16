import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/shots/tourism_photos';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function capture() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9228',
    '--disable-gpu',
    '--window-size=1280,800',
    'http://127.0.0.1:5173/',
  ]);

  await sleep(2500);

  try {
    const res = await fetch('http://127.0.0.1:9228/json');
    const tabs = await res.json();
    const gameTab = tabs.find((t) => t.url.includes('5173'));
    if (!gameTab) {
      console.error('No tab found');
      edge.kill();
      return;
    }

    const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

    let msgId = 1;
    const callbacks = new Map();
    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data);
        callbacks.delete(data.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    await send('Runtime.enable');
    await send('Page.enable');

    // Wait for game load
    await sleep(1500);

    // Click optTour then btnTourGuide
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('[data-el="optTour"]')?.click();
        document.querySelector('[data-el="btnTourGuide"]')?.click();
      `,
    });

    await sleep(800);

    // Screenshot 1: Tunel de Occidente
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '01_modal_tunel_occidente.png'), Buffer.from(shot1.result.data, 'base64'));
    console.log('Saved 01_modal_tunel_occidente.png');

    // Toggle guide list, click on Ebéjico Parque
    await send('Runtime.evaluate', {
      expression: `
        document.querySelector('[data-el="btnToggleGuideList"]')?.click();
      `,
    });
    await sleep(400);

    // Click on parque-ebejico
    await send('Runtime.evaluate', {
      expression: `
        const item = document.querySelector('[data-spot-id="parque-ebejico"]');
        if (item) item.click();
      `,
    });
    await sleep(800);

    // Screenshot 2: Ebéjico Parque
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '02_modal_parque_ebejico.png'), Buffer.from(shot2.result.data, 'base64'));
    console.log('Saved 02_modal_parque_ebejico.png');

    // Click on puente-la-negra from the open list
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const list = document.querySelector('[data-el="tourGuideList"]');
          const items = Array.from(document.querySelectorAll('[data-spot-id]')).map(x => x.dataset.spotId);
          const item = document.querySelector('[data-spot-id="puente-la-negra"]');
          if (item) {
            item.scrollIntoView();
            item.click();
            return { found: true, listHidden: list?.hidden, itemsCount: items.length };
          }
          return { found: false, listHidden: list?.hidden, items };
        })()
      `,
      returnByValue: true,
    });
    console.log('Puente la negra click result:', evalRes.result.value);
    await sleep(1000);

    // Screenshot 3: Puente La Negra
    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '03_modal_puente_la_negra.png'), Buffer.from(shot3.result.data, 'base64'));
    console.log('Saved 03_modal_puente_la_negra.png');

    // Click on vereda-la-renta
    const r4 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const item = document.querySelector('[data-spot-id="vereda-la-renta"]');
          if (item) {
            item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return { clicked: true };
          }
          return { clicked: false, all: Array.from(document.querySelectorAll('[data-spot-id]')).map(x => x.dataset.spotId) };
        })()
      `,
      returnByValue: true,
    });
    console.log('Vereda la renta click result:', r4.result?.result?.value || r4.result);
    await sleep(1000);

    // Screenshot 4: Vereda La Renta
    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, '04_modal_vereda_la_renta.png'), Buffer.from(shot4.result.data, 'base64'));
    console.log('Saved 04_modal_vereda_la_renta.png');

    ws.close();
  } catch (err) {
    console.error('Error in capture:', err);
  } finally {
    edge.kill();
  }
}

capture();
