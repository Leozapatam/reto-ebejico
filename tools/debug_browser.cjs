const { spawn } = require('child_process');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9225',
    '--disable-gpu',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await fetch('http://127.0.0.1:9225/json');
    const tabs = await res.json();
    const gameTab = tabs.find(t => t.url.includes('5173'));
    if (!gameTab) {
      console.log('Game tab not found! Available tabs:', tabs.map(t => t.url));
      edge.kill();
      return;
    }

    console.log('Found game tab:', gameTab.url);
    const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 10,
          method: 'Runtime.evaluate',
          params: {
            expression: `({
              canvas: {
                w: document.getElementById('game-canvas')?.width,
                h: document.getElementById('game-canvas')?.height,
                styleW: document.getElementById('game-canvas')?.offsetWidth,
                styleH: document.getElementById('game-canvas')?.offsetHeight,
              },
              bodyBg: getComputedStyle(document.body).backgroundColor,
              canvasBg: getComputedStyle(document.getElementById('game-canvas')).backgroundColor,
              hudCount: document.querySelectorAll('.hud-top').length
            })`,
            returnByValue: true
          }
        }));
      }, 1000);
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
        console.log('DOM INSPECT:', JSON.stringify(msg.result.result.value, null, 2));
      }
    };

    await new Promise(r => setTimeout(r, 4000));
    ws.close();
  } catch (e) {
    console.error('Error:', e);
  } finally {
    edge.kill();
  }
}

main();
