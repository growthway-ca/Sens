// "Season ribbon" design: the whole 82-game season as one strip, a playoff-pace line under it,
// head-to-head by division, and the next five games as ticket stubs.
import { TZ, logoUrl } from './build.mjs';

const W = 948; // chart width, shared by the ribbon and the pace line so games line up vertically
const fmt = (opts) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, ...opts });
const longDate = (d) => fmt({ weekday: 'long', month: 'long', day: 'numeric' }).format(d);
const dayNum = (d) => fmt({ day: 'numeric' }).format(d);
const mon = (d) => fmt({ month: 'short' }).format(d).replace('.', '');
const wkday = (d) => fmt({ weekday: 'short' }).format(d).replace('.', '');
const time = (d) =>
  fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(d).replace(/\s?([ap])\.?m\.?/i, '$1m').toLowerCase();
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]);

const img = (src, abbr, cls) =>
  `<img class="${cls}" src="${src}" alt="${abbr}" onerror="this.replaceWith(Object.assign(document.createElement('b'),{className:'${cls} ph',textContent:'${abbr}'}))">`;

const HOUSE = '<path d="M2.5 22V10.4L12 2l9.5 8.4V22h-6.6v-7.6H9.1V22z"/>';
const PLANE =
  '<path transform="rotate(90 12 12)" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>';
const cls = (g) => (g.done ? g.result.toLowerCase() : 'tbd');

// ---------- the ribbon: one bar per game, height = goal margin (capped at 5) ----------
const MID = 98; // axis position inside the ribbon svg
const UNIT = 18; // px per goal
function ribbon(games) {
  const slot = W / Math.max(games.length, 1);
  const grid = [-3, -2, -1, 1, 2, 3]
    .map((n) => {
      const y = MID - n * UNIT;
      return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="grid"/><text x="${W + 8}" y="${y + 5}" class="gl">${n > 0 ? '+' : '−'}${Math.abs(n)}</text>`;
    })
    .join('');
  const bars = games
    .map((g, i) => {
      const x = (i * slot + slot * 0.16).toFixed(1);
      const w = (slot * 0.68).toFixed(1);
      if (!g.done) return `<rect class="tbd" x="${x}" y="${MID - 3}" width="${w}" height="6" rx="1"/>`;
      const h = (g.result === 'OTL' ? 1 : Math.min(Math.abs(g.usScore - g.themScore), 5)) * UNIT;
      const y = g.result === 'W' ? MID - h : MID;
      return `<rect class="${cls(g)}" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>`;
    })
    .join('');
  const dots = games
    .map((g, i) => {
      const cx = (i * slot + slot / 2).toFixed(1);
      return g.home ? `<circle cx="${cx}" cy="200" r="3" class="dot"/>` : `<circle cx="${cx}" cy="200" r="2.5" class="ring"/>`;
    })
    .join('');
  let lastMonth = '';
  const months = games
    .map((g, i) => {
      const m = mon(g.start);
      if (m === lastMonth) return '';
      lastMonth = m;
      return `<text x="${(i * slot).toFixed(1)}" y="226" class="month">${m}</text>`;
    })
    .join('');
  const axis = `<line x1="0" x2="${W}" y1="${MID}" y2="${MID}" class="axis"/>`;
  return `<svg viewBox="0 0 ${W + 36} 232" width="${W + 36}" height="232">${grid}${axis}${bars}${dots}${months}</svg>`;
}

// ---------- playoff line: points above/below the cut after each game ----------
function playoffChart(m, total) {
  const slot = W / Math.max(total, 1);
  const H = 120;
  const mid = H / 2;
  const pts = m.gapByGame
    .map((d, i) => (d == null ? null : [+(i * slot + slot / 2).toFixed(1), d]))
    .filter(Boolean);
  const zero = `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" class="cut"/><text x="${W + 8}" y="${mid + 5}" class="gl gold">0</text>`;
  if (!pts.length) return `<svg viewBox="0 0 ${W + 36} ${H}" width="${W + 36}" height="${H}">${zero}</svg>`;
  const k = (mid - 10) / Math.max(4, ...pts.map((p) => Math.abs(p[1])));
  const xy = pts.map(([x, d]) => `${x},${(mid - d * k).toFixed(1)}`);
  const area = `${pts[0][0]},${mid} ${xy.join(' ')} ${pts.at(-1)[0]},${mid}`;
  const [lx] = pts.at(-1);
  const now = m.playoffGap ?? pts.at(-1)[1];
  const ly = mid - now * k;
  return `<svg viewBox="0 0 ${W + 36} ${H}" width="${W + 36}" height="${H}">
    <defs><clipPath id="above"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath>
    <clipPath id="below"><rect x="0" y="${mid}" width="${W}" height="${mid}"/></clipPath></defs>
    ${zero}
    <polygon points="${area}" class="up" clip-path="url(#above)"/>
    <polygon points="${area}" class="down" clip-path="url(#below)"/>
    <polyline points="${xy.join(' ')}" class="trace"/>
    <circle cx="${lx}" cy="${ly.toFixed(1)}" r="6" class="now"/>
  </svg>`;
}

const gapText = (g) => (g == null ? '' : g > 0 ? `+${g}` : g < 0 ? `−${Math.abs(g)}` : '0');
const gapWords = (g) =>
  g == null ? '' : g > 0 ? `${g} point${g === 1 ? '' : 's'} clear of the first team out` : g < 0 ? `${-g} point${g === -1 ? '' : 's'} back of the last wild card` : 'level with the playoff line';

function division(d) {
  return `<section class="div">
    <h3><span>${d.name}</span><span class="drec">${d.record}</span></h3>
    ${d.teams
      .map(
        (t) => `<div class="h2h">${img(t.logo, t.abbr, 'mini')}<span class="pips">${t.games
          .map((g) => `<svg viewBox="0 0 24 24" class="pip ${cls(g)}">${g.home ? HOUSE : PLANE}</svg>`)
          .join('')}</span></div>`
      )
      .join('')}
  </section>`;
}

function tickets(next) {
  if (!next.length) return '<p class="empty">Regular season complete</p>';
  return next
    .map(
      (g) => `<div class="ticket">
      <div class="stub"><span class="wd">${wkday(g.start)}</span><span class="dn">${dayNum(g.start)}</span></div>
      <div class="vs"><span class="where">${g.home ? 'vs' : '@'}</span>${img(g.oppLogo, g.opp, 'tlogo')}<span class="t">${time(g.start)}</span></div>
    </div>`
    )
    .join('');
}

function results(last) {
  if (!last.length) return '<p class="empty">No games played yet</p>';
  return last
    .map((g) => {
      const hi = Math.max(g.usScore, g.themScore);
      const lo = Math.min(g.usScore, g.themScore);
      return `<div class="res">${img(g.oppLogo, g.opp, 'rlogo')}<span class="wl ${cls(g)}">${g.result === 'W' ? 'W' : 'L'}</span><span class="sc">${hi}–${lo}</span><span class="ot">${g.period}</span></div>`;
    })
    .join('');
}

function wildCardTable(wc) {
  if (!wc) return '';
  const row = (r) => `<div class="wc-row${r.me ? ' me' : ''}${r.cut ? ' cut' : ''}">
      <span class="tag">${r.tag}</span>${img(r.logo, r.abbr, 'wlogo')}<span class="ab">${r.abbr}</span><span class="n">${r.gp}</span><span class="n pts">${r.pts}</span></div>`;
  return `<section class="wc"><h3>Playoff picture</h3>
    <div class="wc-row wc-head"><span class="grp">${wc.divisionName ?? ''}</span><span class="n">GP</span><span class="n">PTS</span></div>
    ${wc.division.map(row).join('')}
    <div class="wc-row wc-head wc-sub"><span class="grp">Wild card</span></div>
    ${wc.rows.map(row).join('')}
    ${wc.extra ? `<div class="wc-gap">…</div>${row(wc.extra)}` : ''}
  </section>`;
}

function leadersStrip(leaders) {
  if (!leaders.length) return '';
  return `<section class="leaders"><h3>Team leaders</h3>
    ${leaders
      .map(
        (p) => `<div class="leader">
        ${p.headshot ? `<img class="shot" src="${p.headshot}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('b'),{className:'shot ph',textContent:'${p.initials}'}))">` : `<b class="shot ph">${p.initials}</b>`}
        <span class="who"><span class="cat">${p.label}</span><span class="nm">${p.name}</span><span class="lb">${p.detail}</span></span>
        <span class="val">${p.value}</span></div>`
      )
      .join('')}
  </section>`;
}

export function renderRibbon(m, fontFaces = '') {
  const played = m.games.filter((g) => g.done).length;
  const streak = m.streak?.length > 1 ? `, ${m.streak.won ? 'won' : 'lost'} ${m.streak.length} straight` : '';
  const standing = m.divisionRank ? `${ordinal(m.divisionRank)} in the ${m.divisionName}` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1080">
<title>${m.team} season at a glance — ${longDate(m.now)}</title>
<style>
${fontFaces}
:root {
  --black: #000; --coal: #161616; --line: #2c2c2c; --mute: #8f8f8f;
  --red: #c8102e; --gold: #c2a26a; --white: #f4f4f4; --green: #2fbf3a;
  --w: var(--green); --l: var(--red); --otl: var(--gold); --tbd: #3a3a3a;
  --jersey: 'Graduate', 'Rockwell', serif;
  --cond: 'Barlow Condensed', 'Arial Narrow', sans-serif;
}
* { box-sizing: border-box; margin: 0; }
body { background: #000; display: flex; flex-direction: column; align-items: center; }
.canvas { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: var(--black); color: var(--white); font-family: var(--cond); }

/* compact header: crest on a slanted red plate, record as a jersey number */
.head { position: relative; height: 112px; }
.plate { position: absolute; left: -40px; top: 0; width: 250px; height: 112px; background: var(--red); transform: skewX(-14deg); }
.plate::after { content: ""; position: absolute; right: -16px; top: 0; width: 7px; height: 100%; background: var(--gold); }
.crest { position: absolute; left: 30px; top: 10px; width: 150px; height: 92px; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,.35)); }
.save { all: unset; position: absolute; left: 30px; top: 10px; width: 150px; height: 92px; display: block; cursor: pointer; z-index: 2; }
.save .crest { position: static; width: 100%; height: 100%; }
.save:focus-visible .crest { outline: 3px solid var(--gold); outline-offset: 4px; }
.saving { cursor: progress; }
.crest.ph { display: grid; place-items: center; font: 400 30px var(--jersey); }
.rec { position: absolute; left: 252px; top: 16px; font: 400 58px/1 var(--jersey); letter-spacing: -1px; }
.sub { position: absolute; left: 256px; top: 80px; font: 500 22px/1 var(--cond); color: #cfcfcf; }
.sub b { font-weight: 700; color: var(--white); }
.date { position: absolute; right: 48px; top: 20px; font: 600 20px var(--cond); color: var(--mute); }

/* season ribbon + playoff line share one x-axis */
.season { position: absolute; left: 48px; top: 128px; }
.label { display: flex; justify-content: space-between; align-items: baseline; width: ${W}px; font: 700 28px var(--cond); margin-bottom: 6px; }
.label small { font: 500 19px var(--cond); color: var(--mute); }
.gap { font: 400 26px var(--jersey); margin-left: 10px; color: var(--white); }
svg rect.w { fill: var(--w); } svg rect.l { fill: var(--l); } svg rect.otl { fill: var(--otl); } svg rect.tbd { fill: var(--tbd); }
.grid { stroke: #3d3d3d; stroke-width: 1; stroke-dasharray: 2 5; }
.gl { font: 600 14px var(--cond); fill: #6d6d6d; }
.gl.gold { fill: var(--gold); }
.axis { stroke: #6a6a6a; stroke-width: 1.2; }
.dot { fill: #9a9a9a; } .ring { fill: none; stroke: #6a6a6a; stroke-width: 1.3; }
.month { font: 600 17px var(--cond); fill: var(--mute); }
.pace-wrap { margin-top: 6px; }
.cut { stroke: var(--gold); stroke-dasharray: 6 5; stroke-width: 1.6; }
.up { fill: rgba(47,191,58,.28); } .down { fill: rgba(200,16,46,.38); }
.trace { fill: none; stroke: var(--white); stroke-width: 2.6; stroke-linejoin: round; }
.now { fill: var(--white); }

/* bottom: compact head-to-head | wild card + leaders | next 5 + last 5 */
.lower { position: absolute; left: 48px; top: 568px; width: 984px; display: grid; grid-template-columns: 400px 268px 268px; column-gap: 24px; }
.lower h3 { font: 700 25px var(--cond); padding-bottom: 6px; margin-bottom: 8px; border-bottom: 2px solid var(--line); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 20px; align-content: start; }
.div h3 { display: flex; justify-content: space-between; align-items: baseline; font-size: 21px; }
.drec { font: 400 17px var(--jersey); color: var(--gold); }
.h2h { display: flex; align-items: center; height: 32px; }
.mini { width: 34px; height: 26px; object-fit: contain; margin-right: 10px; flex: none; }
.ph { display: grid; place-items: center; font: 600 12px var(--cond); color: #ccc; border: 1.5px solid #444; border-radius: 50%; }
.mini.ph { width: 26px; height: 26px; margin-right: 18px; }
.pips { display: flex; gap: 5px; }
.pip { width: 23px; height: 23px; }
.pip.w { fill: var(--w); } .pip.l { fill: var(--l); } .pip.otl { fill: var(--otl); } .pip.tbd { fill: var(--tbd); }

.wc-row { display: grid; grid-template-columns: 40px 42px 1fr 40px 44px; align-items: center; height: 34px; padding: 0 6px; font: 600 21px var(--cond); }
.wc-head { height: 22px; font: 600 15px var(--cond); color: var(--mute); }
.tag { font: 600 15px var(--cond); color: var(--gold); }
.wlogo { width: 34px; height: 28px; object-fit: contain; }
.wlogo.ph { width: 28px; height: 28px; }
.n { text-align: right; }
.pts { font: 400 20px var(--jersey); }
.wc-row.cut { border-bottom: 2px dashed var(--gold); }
.wc-row.me { background: rgba(200,16,46,.35); border-radius: 4px; }
.wc-gap { text-align: center; color: var(--mute); line-height: 1; padding: 2px 0; }
.wc-head .grp { font: 600 15px var(--cond); color: var(--mute); text-transform: uppercase; letter-spacing: 1px; grid-column: 1 / 4; }
.wc-sub { margin-top: 6px; }
.leaders { margin-top: 22px; }
.leader { display: flex; align-items: center; gap: 12px; height: 74px; }
.shot { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; background: #1d1d1d; border: 2px solid var(--red); flex: none; }
.shot.ph { display: grid; place-items: center; font: 400 18px var(--jersey); color: var(--white); }
.who { display: grid; min-width: 0; }
.cat { font: 700 14px/1.1 var(--cond); color: var(--gold); text-transform: uppercase; letter-spacing: 1px; }
.nm { font: 700 22px/1.1 var(--cond); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb { font: 500 16px/1.2 var(--cond); color: var(--mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.val { margin-left: auto; font: 400 28px var(--jersey); }

.ticket { display: grid; grid-template-columns: 86px 1fr; height: 66px; margin-bottom: 8px; background: var(--coal); border-radius: 6px; overflow: hidden; }
.stub { background: var(--coal); display: grid; grid-template-columns: 24px 1fr; align-items: center; border: 2px solid var(--gold); border-right: 2px dashed var(--gold); border-radius: 6px 0 0 6px; }
.wd { writing-mode: vertical-rl; transform: rotate(180deg); justify-self: center; font: 700 15px/1 var(--cond); letter-spacing: 1px; text-transform: uppercase; color: var(--gold); }
.dn { justify-self: center; padding-right: 4px; font: 400 36px/1 var(--jersey); color: var(--red); }
.vs { display: flex; align-items: center; padding: 0 12px 0 10px; gap: 8px; }
.where { width: 20px; font: 600 20px var(--cond); color: var(--mute); }
.tlogo { width: 62px; height: 52px; object-fit: contain; }
.tlogo.ph { width: 48px; height: 48px; }
.t { margin-left: auto; font: 600 23px var(--cond); }
.results { margin-top: 16px; }
.res { display: flex; align-items: center; height: 46px; gap: 12px; }
.rlogo { width: 56px; height: 44px; object-fit: contain; }
.rlogo.ph { width: 42px; height: 42px; margin: 0 7px; }
.wl { width: 36px; height: 32px; display: grid; place-items: center; font: 400 19px var(--jersey); border-radius: 4px; }
.wl.w { background: var(--green); color: #000; } .wl.l { background: var(--red); } .wl.otl { background: var(--gold); color: #000; }
.sc { font: 600 27px var(--cond); }
.ot { font: 600 17px var(--cond); color: var(--gold); }
.empty { font: 500 20px var(--cond); color: var(--mute); padding: 12px 0; }
.legend { position: absolute; left: 48px; bottom: 18px; font: 500 17px var(--cond); color: var(--mute); display: flex; gap: 22px; align-items: center; }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
</style></head><body>

<main class="canvas">
  <header class="head">
    <div class="plate"></div>
    <button class="save" type="button" title="Save today's image" aria-label="Save today's image">${img(logoUrl(m.team), m.team, 'crest')}</button>
    <div class="rec">${m.record}</div>
    <div class="sub"><b>${m.points} points</b>${standing ? ', ' + standing : ''}${streak}</div>
    <div class="date">${longDate(m.now)}</div>
  </header>

  <section class="season">
    <div class="label"><span>The season, game by game</span><small>${played} of ${m.games.length} played, bar height = goal margin</small></div>
    ${ribbon(m.games)}
    <div class="pace-wrap">
      <div class="label"><span>Playoff line <b class="gap">${gapText(m.playoffGap)}</b></span><small>${gapWords(m.playoffGap)}</small></div>
      ${playoffChart(m, m.games.length)}
    </div>
  </section>

  <div class="lower">
    <div class="grid2">${m.divisions.map(division).join('')}</div>
    <div class="mid">${wildCardTable(m.wildCard)}${leadersStrip(m.leaders)}</div>
    <div class="side">
      <h3>Next 5</h3>
      ${tickets(m.next)}
      <div class="results"><h3>Last 5</h3>${results(m.last)}</div>
    </div>
  </div>

  <div class="legend">
    <span><i style="background:var(--w)"></i>Win</span>
    <span><i style="background:var(--l)"></i>Loss</span>
    <span><i style="background:var(--otl)"></i>OT/SO loss</span>
    <span><i style="background:var(--tbd)"></i>Still to play</span>
    <span>Filled dot or house = home, ring or plane = away</span>
  </div>
</main>
${m.saveScript ? `<script>${m.saveScript}</script>
<script>
document.querySelector('.save').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.classList.contains('saving')) return;
  btn.classList.add('saving');
  try {
    const canvas = document.querySelector('.canvas');
    const blob = await htmlToImage.toBlob(canvas, { width: 1080, height: 1350, pixelRatio: 1 });
    const name = 'sens-season-at-a-glance-${fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(m.now)}.png';
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] }); // phone: share sheet with "Save Image"
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  } catch (err) {
    if (err.name !== 'AbortError') alert('Could not save the image: ' + err.message);
  } finally {
    btn.classList.remove('saving');
  }
});
</script>` : ''}
</body></html>`;
}
