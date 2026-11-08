const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9252',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://127.0.0.1:5173/'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9252/json');
  const tabs = await res.json();
  const gameTab = tabs.find(t => t.url.includes('5173'));
  const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Page.reload' }));

    setTimeout(() => {
      // 1. Iniciar carrera
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

      // 2. Captura de salida en el túnel correcto
      setTimeout(() => {
        console.log('Capturando salida del túnel...');
        ws.send(JSON.stringify({
          id: 20,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));

        // 3. Teletransportar vehículo a la meta en Ebéjico
        setTimeout(() => {
          console.log('Teletransportando a la meta en Ebéjico...');
          ws.send(JSON.stringify({
            id: 30,
            method: 'Runtime.evaluate',
            params: {
              expression: `
                const app = window.gameApp;
                const pts = app.simulation.track.points;
                const finish = pts[pts.length - 2];
                const prev = pts[pts.length - 3];
                const angle = Math.atan2(finish.y - prev.y, finish.x - prev.x);
                app.simulation.vehicle.reset(finish.x, finish.y, angle, finish.z, finish.elevationMeters);
                'TELEPORT_DONE';
              `,
              returnByValue: true
            }
          }));

          // 4. Captura de llegada a Ebéjico sin nubes
          setTimeout(() => {
            console.log('Capturando llegada a Ebéjico sin nubes...');
            ws.send(JSON.stringify({
              id: 40,
              method: 'Page.captureScreenshot',
              params: { format: 'png' }
            }));
          }, 2000);
        }, 1200);
      }, 1500);
    }, 1500);
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === 20) {
      fs.writeFileSync(
        'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_satelital_salida.png',
        Buffer.from(msg.result.data, 'base64')
      );
      console.log('[OK] Guardada captura_satelital_salida.png');
    }
    if (msg.id === 40) {
      fs.writeFileSync(
        'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_ebejico_sin_nubes.png',
        Buffer.from(msg.result.data, 'base64')
      );
      console.log('[OK] Guardada captura_ebejico_sin_nubes.png');
      setTimeout(() => {
        edge.kill();
        process.exit(0);
      }, 500);
    }
  };
}
main();
