// Pieces every Atlantic card shares: palette, fonts, header plate, tap-to-save.
// There's no official NHL colour for the division, so the brand colour is "Atlantic" ocean blue.

export const fmtDate = (d) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', month: 'long', day: 'numeric' }).format(d);

export const img = (src, abbr, cls) =>
  `<img class="${cls}" src="${src}" alt="${abbr}" onerror="this.replaceWith(Object.assign(document.createElement('b'),{className:'${cls} ph',textContent:'${abbr}'}))">`;

export const baseCSS = (fontFaces) => `
${fontFaces}
:root { --atl: #1c6e8c; --atl-hi: #5fb3d3; --coal: #161616; --line: #2c2c2c; --mute: #8f8f8f; --white: #f4f4f4;
  --green: #2fbf3a; --red: #e0324b;
  --jersey: 'Graduate', 'Rockwell', serif; --cond: 'Barlow Condensed', 'Arial Narrow', sans-serif; }
* { box-sizing: border-box; margin: 0; }
body { background: #000; display: flex; justify-content: center; }
.canvas { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #000; color: var(--white); font-family: var(--cond); }
.head { position: relative; height: 128px; }
.plate { all: unset; position: absolute; left: -40px; top: 0; width: 330px; height: 128px; background: var(--atl); transform: skewX(-14deg); cursor: pointer; }
.plate span { position: absolute; left: 76px; top: 36px; transform: skewX(14deg); font: 400 46px/1 var(--jersey); color: var(--white); }
.title { position: absolute; left: 330px; top: 22px; font: 700 60px/1 var(--cond); }
.sub { position: absolute; left: 332px; top: 88px; font: 500 22px var(--cond); color: #cfcfcf; }
.date { position: absolute; right: 48px; top: 26px; font: 600 20px var(--cond); color: var(--mute); }
section { position: absolute; left: 48px; width: 984px; }
h2 { display: flex; justify-content: space-between; align-items: baseline; font: 700 28px var(--cond); padding-bottom: 6px; border-bottom: 2px solid var(--line); margin-bottom: 4px; }
h2 small { font: 500 18px var(--cond); color: var(--mute); }
.ph { display: grid; place-items: center; font: 600 13px var(--cond); color: #ccc; border: 1.5px solid #444; border-radius: 50%; }
.num { font: 700 34px/1 var(--cond); }
.method { position: absolute; left: 48px; right: 48px; bottom: 20px; font: 500 16px/1.35 var(--cond); color: var(--mute); }
`;

export const header = (title, sub, now) => `<header class="head">
    <button class="plate save" type="button" title="Save this image" aria-label="Save this image"><span>Atlantic</span></button>
    <div class="title">${title}</div>
    <div class="sub">${sub}</div>
    <div class="date">Week of ${fmtDate(now)}</div>
  </header>`;

export const saveBlock = (saveScript, filename) =>
  saveScript
    ? `<script>${saveScript}</script>
<script>
document.querySelector('.save').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  try {
    const blob = await htmlToImage.toBlob(document.querySelector('.canvas'), { width: 1080, height: 1350, pixelRatio: 1 });
    const file = new File([blob], '${filename}', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: '${filename}' });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  } catch (err) {
    if (err.name !== 'AbortError') alert('Could not save the image: ' + err.message);
  } finally {
    delete btn.dataset.busy;
  }
});
</script>`
    : '';
