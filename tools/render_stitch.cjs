const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9251',
    '--disable-gpu',
    'http://127.0.0.1:5173/stitch.html'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9251/json');
  const tabs = await res.json();
  const gameTab = tabs.find(t => t.url.includes('stitch.html'));
  const ws = new WebSocket(gameTab.webSocketDebuggerUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));

    const check = setInterval(() => {
      ws.send(JSON.stringify({
        id: 10,
        method: 'Runtime.evaluate',
        params: {
          expression: 'window.STITCH_DONE',
          returnByValue: true
        }
      }));
    }, 500);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 10 && msg.result?.value) {
        clearInterval(check);
        const data = msg.result.value.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(
          'C:\\Users\\Leonardo\\.gemini\\antigravity\\brain\\956752b8-8ce9-4240-b159-b4dcd30a96e0\\stitched_tunnel.png',
          Buffer.from(data, 'base64')
        );
        console.log('Saved stitched_tunnel.png');
        edge.kill();
        process.exit(0);
      }
    };
  };
}
main();
