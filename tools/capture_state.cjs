const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9227',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const res = await fetch('http://127.0.0.1:9227/json');
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

      // Reload page cleanly to catch everything from the start
      ws.send(JSON.stringify({ id: 3, method: 'Page.reload' }));

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
              hudTop: !!document.querySelector('.hud-top'),
              startScreen: !!document.getElementById('start-screen'),
              startScreenDisplay: getComputedStyle(document.getElementById('start-screen')).display,
              startScreenOpacity: getComputedStyle(document.getElementById('start-screen')).opacity,
              minimapCanvas: !!document.getElementById('minimap-canvas'),
              minimapW: document.getElementById('minimap-canvas')?.width,
              minimapH: document.getElementById('minimap-canvas')?.height,
            })`,
            returnByValue: true
          }
        }));

        // Take a screenshot via CDP
        ws.send(JSON.stringify({
          id: 20,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));
      }, 2500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('EXCEPTION:', JSON.stringify(msg.params.exceptionDetails, null, 2));
      }
      if (msg.id === 10) {
        console.log('DOM STATE:', JSON.stringify(msg.result.result.value, null, 2));
      }
      if (msg.id === 20) {
        const base64 = msg.result.data;
        fs.writeFileSync('test_edge_cdp.png', Buffer.from(base64, 'base64'));
        console.log('Saved test_edge_cdp.png successfully!');
      }
    };

    await new Promise(r => setTimeout(r, 6000));
    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    edge.kill();
  }
}

main();
