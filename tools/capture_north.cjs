const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9250',
    '--disable-gpu',
    '--window-size=1280,720',
    'http://127.0.0.1:5173/'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9250/json');
  const tabs = await res.json();
  const gameTab = tabs.find(t => t.url.includes('5173'));
  const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Page.reload' }));

    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 10,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            document.getElementById('btn-start-game').click();
            document.getElementById('hud-camera-toggle').click();
            'NORTH_MODE';
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
      }, 1500);
    }, 1500);
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === 20) {
      fs.writeFileSync(
        'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\captura_satelital_norte.png',
        Buffer.from(msg.result.data, 'base64')
      );
      console.log('Saved captura_satelital_norte.png');
      setTimeout(() => {
        edge.kill();
        process.exit(0);
      }, 500);
    }
  };
}
main();
