const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9242',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2200));

  try {
    const res = await fetch('http://127.0.0.1:9242/json');
    const tabs = await res.json();
    const gameTab = tabs.find(t => t.url.includes('5173'));
    const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.reload' }));

      // 1. Iniciar carrera
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

        // Captura durante el conteo inicial (Salida del Túnel en Vista Adelante)
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 20,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));

          // Acelerar y bajar la montaña
          setTimeout(() => {
            ws.send(JSON.stringify({
              id: 30,
              method: 'Runtime.evaluate',
              params: {
                expression: `
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
                  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
                  'ACCELERATING';
                `,
                returnByValue: true
              }
            }));

            // Captura en marcha bajando hacia el puente con caídas y chispas
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 40,
                method: 'Page.captureScreenshot',
                params: { format: 'png' }
              }));
            }, 3200);
          }, 2400);
        }, 1200);
      }, 1500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 20) {
        fs.writeFileSync(
          'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_diseno_salida.png',
          Buffer.from(msg.result.data, 'base64')
        );
        console.log('Saved captura_diseno_salida.png');
      }
      if (msg.id === 40) {
        fs.writeFileSync(
          'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_diseno_en_marcha.png',
          Buffer.from(msg.result.data, 'base64')
        );
        console.log('Saved captura_diseno_en_marcha.png');
      }
    };

    await new Promise(r => setTimeout(r, 10000));
    ws.close();
  } finally {
    edge.kill();
  }
}

main();
