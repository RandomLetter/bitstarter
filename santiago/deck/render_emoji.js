// Render the emoji used by the deck to transparent PNGs (assets/icons/).
// Requires the globally installed playwright + chromium.
// Usage: node render_emoji.js
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const OUT = path.join(__dirname, 'assets', 'icons');
const EMOJI = {
  banana: '🍌', sugar: '🎋', potato: '🥔', bean: '🫘', pepper: '🌶️',
  water: '💧', desert: '🏜️', planter: '👤', money: '💰', overseer: '👷',
  coin: '🪙', sun: '☀️', handshake: '🤝', seedling: '🌱', trophy: '🏆',
  cards: '🃏', email: '📧', think: '🤔', timer: '⏳',
};
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
  for (const [name, ch] of Object.entries(EMOJI)) {
    await page.setContent(
      `<div id="e" style="font-size:220px;line-height:280px;width:280px;height:280px;
        display:flex;align-items:center;justify-content:center;
        font-family:'Noto Color Emoji',sans-serif">${ch}</div>`);
    await page.waitForTimeout(60);
    const el = await page.$('#e');
    await el.screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
  }
  await browser.close();
  console.log('rendered', Object.keys(EMOJI).length, 'emoji to', OUT);
})();
