const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const port = 9245;
  console.log(`Launching headless Edge on port ${port}...`);
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--window-size=1280,720',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    const tabs = await res.json();
    const gameTab = tabs.find(t => t.url.includes('5173'));
    if (!gameTab) {
      console.error('No se encontró pestaña con Vite dev server');
      return;
    }
    const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      console.log('WebSocket CDP conectado. Habilitando Page y recargando...');
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.reload' }));

      // 1. Iniciar carrera
      setTimeout(() => {
        console.log('Iniciando partida...');
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

        // Esperar a que las ortofotos satelitales carguen
        setTimeout(() => {
          console.log('Tomando captura_satelital_salida.png...');
          ws.send(JSON.stringify({
            id: 20,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));

          // Acelerar para descender la montaña
          setTimeout(() => {
            console.log('Acelerando...');
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

            // Captura en marcha con ortofoto satelital, chispas y precipicio
            setTimeout(() => {
              console.log('Tomando captura_satelital_en_marcha.png...');
              ws.send(JSON.stringify({
                id: 40,
                method: 'Page.captureScreenshot',
                params: { format: 'png' }
              }));
            }, 3500);
          }, 1500);
        }, 3000);
      }, 1500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 20) {
        fs.writeFileSync(
          'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_satelital_salida.png',
          Buffer.from(msg.result.data, 'base64')
        );
        console.log('[OK] Guardada captura_satelital_salida.png');
      }
      if (msg.id === 40) {
        fs.writeFileSync(
          'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_satelital_en_marcha.png',
          Buffer.from(msg.result.data, 'base64')
        );
        console.log('[OK] Guardada captura_satelital_en_marcha.png');
      }
    };

    await new Promise(r => setTimeout(r, 13000));
    ws.close();
  } catch (err) {
    console.error('Error en captura CDP:', err);
  } finally {
    edge.kill();
    console.log('Edge finalizado.');
  }
}

main();
