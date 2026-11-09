const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9277',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9277/json');
  const tabs = await res.json();
  const gameTab = tabs.find(t => t.url.includes('5173'));
  if (!gameTab) {
    console.error('No se encontró pestaña de juego en 5173');
    edge.kill();
    process.exit(1);
  }

  const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
    ws.send(JSON.stringify({ id: 3, method: 'Page.reload' }));

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

      // 2. Esperar fin del conteo y capturar salida con barandas
      setTimeout(() => {
        console.log('--- TEST 1: Estado inicial y barandas ---');
        ws.send(JSON.stringify({
          id: 20,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              const app = window.gameApp;
              const pts = app.simulation.track.points;
              const withLeft = pts.filter(p => p.hasGuardrailLeft).length;
              const withRight = pts.filter(p => p.hasGuardrailRight).length;
              JSON.stringify({
                totalPoints: pts.length,
                guardrailLeftCount: withLeft,
                guardrailRightCount: withRight,
                phase: app.simulation.phase
              });
            `,
            returnByValue: true
          }
        }));

        // 3. Capturar captura con barandas visibles
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 25,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));

          // 4. TEST 2: Intento de salto de curva (teletransporte a través de la horquilla)
          setTimeout(() => {
            console.log('--- TEST 2: Intentar salto ilegal de curva ---');
            ws.send(JSON.stringify({
              id: 30,
              method: 'Runtime.evaluate',
              params: {
                expression: `(() => {
                  const app = window.gameApp;
                  // Simulamos que el jugador estaba en el índice 15 y aterriza en el índice 45
                  app.simulation.lastValidOnRoadIndex = 15;
                  const targetPt = app.simulation.track.points[45];
                  app.simulation.vehicle.state.x = targetPt.x;
                  app.simulation.vehicle.state.y = targetPt.y;
                  app.simulation.vehicle.state.speed = 100;
                  
                  // Ejecutar un tick de simulación
                  const snap = app.simulation.step({ steer: 0, throttle: 1, brake: 0, handbrake: false }, 0.016);
                  return JSON.stringify({
                    notice: app.simulation.recentNotice,
                    penaltyMs: app.simulation.timer.penaltyTimeMs,
                    vehicleX: Math.round(app.simulation.vehicle.state.x),
                    vehicleY: Math.round(app.simulation.vehicle.state.y)
                  });
                })()`,
                returnByValue: true
              }
            }));

            // 5. TEST 3: Intento de caída al barranco (> 28px fuera de calzada)
            setTimeout(() => {
              console.log('--- TEST 3: Caída al barranco (> 28px de la calzada) ---');
              ws.send(JSON.stringify({
                id: 40,
                method: 'Runtime.evaluate',
                params: {
                  expression: `(() => {
                    const app = window.gameApp;
                    const p = app.simulation.track.points[20];
                    // Colocar el vehículo a 80px lateralmente (más allá del borde + 28px)
                    app.simulation.vehicle.state.x = p.x + 80;
                    app.simulation.vehicle.state.y = p.y;
                    
                    const snap = app.simulation.step({ steer: 0, throttle: 1, brake: 0, handbrake: false }, 0.016);
                    return JSON.stringify({
                      notice: app.simulation.recentNotice,
                      penaltyMs: app.simulation.timer.penaltyTimeMs
                    });
                  })()`,
                  returnByValue: true
                }
              }));

              // 6. Tomar captura en una curva cerrada mostrando barandas reflectivas
              setTimeout(() => {
                ws.send(JSON.stringify({
                  id: 50,
                  method: 'Runtime.evaluate',
                  params: {
                    expression: `
                      const app = window.gameApp;
                      // Buscar una horquilla pronunciada con barandas
                      const curveIdx = 210;
                      const cp = app.simulation.track.points[curveIdx];
                      const cpNext = app.simulation.track.points[curveIdx + 1];
                      const ang = Math.atan2(cpNext.y - cp.y, cpNext.x - cp.x);
                      app.simulation.vehicle.reset(cp.x, cp.y, ang, cp.z, cp.elevationMeters);
                      'CAMERA_CENTERED_ON_CURVE';
                    `,
                    returnByValue: true
                  }
                }));

                setTimeout(() => {
                  ws.send(JSON.stringify({
                    id: 60,
                    method: 'Page.captureScreenshot',
                    params: { format: 'png' }
                  }));

                  setTimeout(() => {
                    ws.close();
                    edge.kill();
                  }, 1000);
                }, 1000);
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1500);
      }, 3500);
    }, 1500);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id === 20) {
      console.log('Result Guardrails:', data.result?.result?.value || data.result);
    }
    if (data.id === 25 && data.result?.data) {
      fs.writeFileSync('C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_inicio_barandas.png', Buffer.from(data.result.data, 'base64'));
      console.log('Saved captura_inicio_barandas.png');
    }
    if (data.id === 30) {
      console.log('Result Anti-Cheat Shortcut Jump:', data.result?.result?.value || JSON.stringify(data.result));
    }
    if (data.id === 40) {
      console.log('Result Cliff Fall Detection:', data.result?.result?.value || JSON.stringify(data.result));
    }
    if (data.id === 60 && data.result?.data) {
      fs.writeFileSync('C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_curva_barandas.png', Buffer.from(data.result.data, 'base64'));
      console.log('Saved captura_curva_barandas.png');
    }
  };
}

main().catch(console.error);
