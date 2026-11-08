const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9241',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2200));

  try {
    const res = await fetch('http://127.0.0.1:9241/json');
    const tabs = await res.json();
    const gameTab = tabs.find(t => t.url.includes('5173'));
    const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.reload' }));

      // Captura inicial con el Túnel de Occidente y el Carro de Rodillos listo
      setTimeout(() => {
        // Clic en iniciar para ver el arco y el conteo
        ws.send(JSON.stringify({
          id: 10,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              document.getElementById('btn-start-game').click();
              'CLICKED';
            `,
            returnByValue: true
          }
        }));

        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 20,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 1200);
      }, 1500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 20) {
        fs.writeFileSync(
          'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_diorama_salida_tunel.png',
          Buffer.from(msg.result.data, 'base64')
        );
        console.log('Saved captura_diorama_salida_tunel.png');
      }
    };

    await new Promise(r => setTimeout(r, 6000));
    ws.close();
  } finally {
    edge.kill();
  }
}

main();
