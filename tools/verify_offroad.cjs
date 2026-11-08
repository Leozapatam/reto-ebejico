const { spawn } = require('child_process');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9235',
    '--disable-gpu',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await fetch('http://127.0.0.1:9235/json');
    const tabs = await res.json();
    const gameTab = tabs.find(t => t.url.includes('5173'));
    const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Page.reload' }));

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 10,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              document.getElementById('btn-start-game').click();
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
              'DRIVING';
            `,
            returnByValue: true
          }
        }));

        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 20,
            method: 'Runtime.evaluate',
            params: {
              expression: `({
                offroadDisplay: document.getElementById('hud-offroad-alert')?.style.display,
                offroadText: document.getElementById('hud-offroad-text')?.textContent,
                elevation: document.getElementById('hud-elevation-val')?.textContent,
                speed: document.getElementById('hud-speed-val')?.textContent,
              })`,
              returnByValue: true
            }
          }));
        }, 2200);
      }, 1500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 20) {
        console.log('OFFROAD SENSOR CHECK:', JSON.stringify(msg.result.result.value, null, 2));
      }
    };

    await new Promise(r => setTimeout(r, 6500));
    ws.close();
  } finally {
    edge.kill();
  }
}

main();
