const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9237',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const res = await fetch('http://127.0.0.1:9237/json');
    const tabs = await res.json();
    const gameTab = tabs.find(t => t.url.includes('5173'));
    const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.reload' }));

      // Wait 1.5s, click start
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 10,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              document.getElementById('btn-start-game').click();
              'START_CLICKED';
            `,
            returnByValue: true
          }
        }));

        // Wait 3.2s for countdown to finish, then press throttle
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 20,
            method: 'Runtime.evaluate',
            params: {
              expression: `
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
                window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
                'THROTTLE_PRESSED';
              `,
              returnByValue: true
            }
          }));

          // Drive forward for 2.5 seconds, then capture
          setTimeout(() => {
            ws.send(JSON.stringify({
              id: 30,
              method: 'Page.captureScreenshot',
              params: { format: 'png' }
            }));
          }, 2500);
        }, 3200);
      }, 1500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 30) {
        fs.writeFileSync(
          'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_isometrica_en_marcha.png',
          Buffer.from(msg.result.data, 'base64')
        );
        console.log('Saved captura_isometrica_en_marcha.png successfully!');
      }
    };

    await new Promise(r => setTimeout(r, 9000));
    ws.close();
  } finally {
    edge.kill();
  }
}

main();
