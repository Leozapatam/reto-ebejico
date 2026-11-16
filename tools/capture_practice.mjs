import { launch, sleep } from 'file:///C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/scratch/cdp.mjs';

const b = await launch({ port: 9380, width: 1200, height: 800 });
try {
  await b.navigate('http://127.0.0.1:5173/');
  await sleep(2000);
  await b.evaluate(`(() => {
    const app = window.gameApp;
    document.querySelector('[data-el="optTest"]')?.click();
    document.querySelector('[data-el="btnStart"]')?.click();

    // Override visibleRuns
    app.renderer.visibleRuns = function(track, radius) {
      const pts = track.points;
      const r2 = radius * radius;
      const runs = [];
      let start = -1;
      for (let i = 0; i <= pts.length; i++) {
        let inside = false;
        if (i < pts.length) {
          const dx = pts[i].x - this.cameraX;
          const dy = pts[i].y - this.cameraY;
          inside = dx * dx + dy * dy < r2;
        }
        if (inside && start < 0) start = i;
        if (!inside && start >= 0) {
          const a = Math.max(0, start - 1);
          const b = Math.min(pts.length - 1, i);
          let s = a;
          for (let k = a + 1; k <= b; k++) {
            if (k === b || Math.abs(pts[k].width - pts[s].width) >= 8) {
              runs.push({ a: s, b: k, w: pts[s].width });
              s = k;
            }
          }
          start = -1;
        }
      }
      return runs;
    };
  })()`);
  await sleep(1500);
  await b.screenshot('C:/Users/Leonardo/.gemini/antigravity/brain/956752b8-8ce9-4240-b159-b4dcd30a96e0/shots/final_verification/practice_mode_smooth.png');
  console.log('Saved practice_mode_smooth.png');
} finally {
  await b.close();
}
