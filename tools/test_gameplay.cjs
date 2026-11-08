const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9231',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const res = await fetch('http://127.0.0.1:9231/json');
    const tabs = await res.json();
    const gameTab = tabs.find(t => t.url.includes('5173'));
    if (!gameTab) {
      console.log('No game tab');
      edge.kill();
      return;
    }

    const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

      // Reload page cleanly
      ws.send(JSON.stringify({ id: 3, method: 'Page.reload' }));

      // Wait 1.5s for load, click "INICIAR RECORRIDO"
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 10,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              const btn = document.getElementById('btn-start-game');
              if (btn) {
                btn.click();
                'CLICKED';
              } else {
                'BUTTON_NOT_FOUND';
              }
            `,
            returnByValue: true
          }
        }));

        // Wait 1.5s during countdown and 3D rendering
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 20,
            method: 'Runtime.evaluate',
            params: {
              expression: `(() => {
                const canvas = document.getElementById('game-canvas');
                return {
                  webgl: !!canvas.getContext('webgl2') || !!canvas.getContext('webgl'),
                  canvasW: canvas.width,
                  canvasH: canvas.height,
                  bigCountdownVisible: document.getElementById('hud-big-countdown')?.style.display !== 'none',
                  bigCountdownNum: document.getElementById('big-countdown-num')?.textContent,
                  locationText: document.getElementById('hud-location-name')?.textContent,
                  elevationText: document.getElementById('hud-elevation-val')?.textContent,
                  speedText: document.getElementById('hud-speed-val')?.textContent,
                };
              })()`,
              returnByValue: true
            }
          }));

          ws.send(JSON.stringify({
            id: 30,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 1600);
      }, 1500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('PAGE EXCEPTION:', JSON.stringify(msg.params.exceptionDetails, null, 2));
      }
      if (msg.id === 10) {
        console.log('CLICK RESULT:', msg.result.result.value);
      }
      if (msg.id === 20) {
        console.log('3D ENVIRONMENT STATE:', JSON.stringify(msg.result.result.value, null, 2));
      }
      if (msg.id === 30) {
        const base64 = msg.result.data;
        fs.writeFileSync('test_3d_gameplay.png', Buffer.from(base64, 'base64'));
        console.log('Saved test_3d_gameplay.png successfully!');
      }
    };

    await new Promise(r => setTimeout(r, 7000));
    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edge.kill();
  }
}

main();
