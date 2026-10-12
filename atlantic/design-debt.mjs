// "Schedule Debt" weekly card for the Atlantic Division, same visual system as the Sens card.
import { logoUrl } from '../build.mjs';
import { SHORT_NAMES } from './arenas.mjs';
import { WEIGHTS } from './schedule-debt.mjs';
import { fmtDate, img, baseCSS, header, saveBlock } from './shared.mjs';
const one = (n) => n.toFixed(1);
const km = (n) => Math.round(n).toLocaleString('en-CA');
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function tableRows(rows) {
  const max = Math.max(...rows.map((r) => r.debtSoFar + r.debtAhead), 1);
  return rows
    .map((r, i) => {
      const paid = (r.debtSoFar / max) * 100;
      const owed = (r.debtAhead / max) * 100;
      return `<div class="row">
      <span class="rk">${i + 1}</span>
      ${img(logoUrl(r.team), r.team, 'logo')}
      <span class="nm">${SHORT_NAMES[r.team] ?? r.team}</span>
      <span class="bar"><i class="paid" style="width:${paid.toFixed(1)}%"></i><i class="owed" style="width:${owed.toFixed(1)}%"></i></span>
      <span class="debt">${one(r.debtSoFar)}</span>
      <span class="c">${km(r.kmSoFar)}</span>
      <span class="c">${r.b2bPlayed}<small> of ${r.b2bTotal}</small></span>
      <span class="c edge ${r.restEdge > 0 ? 'good' : r.restEdge < 0 ? 'bad' : ''}">${signed(r.restEdge)}</span>
      <span class="c">${one(r.next7).replace('-', '−')}<small> ${r.next7Games} ${r.next7Games === 1 ? 'game' : 'games'}</small></span>
    </div>`;
    })
    .join('');
}

function sparkCells(rows) {
  const W = 206;
  const H = 140;
  const games = Math.max(...rows.map((r) => r.cumulative.length), 1);
  const top = Math.max(...rows.map((r) => r.cumulative.at(-1) ?? 0), 1);
  const x = (i) => ((i + 1) / games) * W;
  const y = (v) => H - (v / top) * (H - 6);
  const path = (vals, from, to) =>
    vals
      .slice(from, to)
      .map((v, k) => `${k ? 'L' : 'M'}${x(from + k).toFixed(1)},${y(v).toFixed(1)}`)
      .join('');
  // division average by game number
  const avg = Array.from({ length: games }, (_, i) => {
    const vals = rows.map((r) => r.cumulative[i]).filter((v) => v != null);
    return vals.reduce((s, v) => s + v, 0) / Math.max(vals.length, 1);
  });
  const order = [...rows].sort((a, b) => (SHORT_NAMES[a.team] ?? a.team).localeCompare(SHORT_NAMES[b.team] ?? b.team));
  return order
    .map((r) => {
      const gp = r.gamesPlayed;
      return `<div class="cell">
      <div class="ct">${img(logoUrl(r.team), r.team, 'clogo')}<span class="cn">${SHORT_NAMES[r.team] ?? r.team}</span><span class="cv">${one(r.cumulative.at(-1) ?? 0)}</span></div>
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        <line x1="0" x2="${W}" y1="${H}" y2="${H}" class="base"/>
        <path d="${path(avg, 0, games)}" class="avg"/>
        <path d="${path(r.cumulative, Math.max(gp - 1, 0), r.cumulative.length)}" class="ahead"/>
        <path d="${path(r.cumulative, 0, gp)}" class="paidline"/>
        ${gp ? `<circle cx="${x(gp - 1).toFixed(1)}" cy="${y(r.cumulative[gp - 1]).toFixed(1)}" r="4" class="dot"/>` : ''}
      </svg>
    </div>`;
    })
    .join('');
}

export function renderDebt({ rows, now, saveScript = '' }, fontFaces = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1080">
<title>Atlantic schedule debt — week of ${fmtDate(now)}</title>
<style>
${baseCSS(fontFaces)}
.grid { display: grid; grid-template-columns: 34px 56px 116px 1fr 84px 92px 84px 66px 116px; align-items: center; column-gap: 10px; }
.cols { height: 28px; font: 600 15px var(--cond); color: var(--mute); }
.cols span:nth-child(n+5) { text-align: right; }
.row { height: 60px; border-bottom: 1px solid #1c1c1c; }
.rk { font: 700 24px var(--cond); color: var(--mute); }
.logo { width: 52px; height: 42px; object-fit: contain; }
.logo.ph { width: 42px; height: 42px; }
.nm { font: 700 23px var(--cond); white-space: nowrap; }
.bar { display: flex; height: 18px; background: #0f0f0f; border-radius: 3px; overflow: hidden; }
.bar i { display: block; height: 100%; }
.paid { background: var(--atl); }
.owed { background: repeating-linear-gradient(-45deg, #3a3a3a 0 4px, #222 4px 8px); }
.debt { text-align: right; font: 700 36px/1 var(--cond); }
.c { text-align: right; font: 600 22px var(--cond); white-space: nowrap; }
.c small { font: 500 15px var(--cond); color: var(--mute); }
.edge.good { color: var(--green); } .edge.bad { color: var(--red); }
.key { display: flex; gap: 20px; margin-top: 10px; font: 500 16px var(--cond); color: var(--mute); }
.key i { display: inline-block; width: 22px; height: 10px; margin-right: 6px; vertical-align: 0; border-radius: 2px; }

.cells { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px 16px; margin-top: 10px; }
.cell { background: var(--coal); border-radius: 6px; padding: 10px 12px 10px; min-width: 0; }
.cell svg { display: block; width: 100%; height: auto; }
.ct { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.clogo { width: 34px; height: 28px; object-fit: contain; }
.clogo.ph { width: 28px; height: 28px; }
.cn { font: 700 20px var(--cond); }
.cv { margin-left: auto; font: 700 24px var(--cond); color: var(--atl-hi); }
.base { stroke: #333; }
.avg { fill: none; stroke: var(--atl-hi); stroke-width: 1.2; stroke-dasharray: 3 4; opacity: .7; }
.ahead { fill: none; stroke: #666; stroke-width: 2; stroke-dasharray: 5 4; }
.paidline { fill: none; stroke: var(--white); stroke-width: 2.6; }
.dot { fill: var(--white); }
</style></head><body>
<main class="canvas">
  ${header('Schedule debt', 'Fatigue points from back-to-backs, travel and rest gaps, ranked by debt paid so far', now)}

  <section style="top:150px">
    <h2><span>Who the schedule has worn down</span><small>debt paid so far vs still to come</small></h2>
    <div class="grid cols"><span></span><span></span><span></span><span></span><span>Debt</span><span>Km so far</span><span>Back-to-backs</span><span>Rest edge</span><span>Next 7 days</span></div>
    ${tableRows(rows).replaceAll('class="row"', 'class="grid row"')}
    <div class="key"><span><i style="background:var(--atl)"></i>Paid so far</span><span><i style="background:repeating-linear-gradient(-45deg,#3a3a3a 0 4px,#222 4px 8px)"></i>Still to come</span><span>Rest edge = times the schedule gave them the rested team minus times it gave the opponent</span></div>
  </section>

  <section style="top:768px">
    <h2><span>Debt over the full season</span><small>solid = played, dashed = to come, dotted = division average, blue number = full-season debt</small></h2>
    <div class="cells">${sparkCells(rows)}</div>
  </section>

  <p class="method">How it's scored: +${WEIGHTS.backToBack} second night of a back-to-back, +${WEIGHTS.threeInFour} third game in four nights, +${WEIGHTS.per1000km} per 1,000 km travelled, ${WEIGHTS.perTimeZone ? `+${WEIGHTS.perTimeZone} per time zone crossed, ` : ''}±${WEIGHTS.restMismatch} when one team is on a back-to-back and the other is rested. Weights tested on 3,854 games from 2023 to 2026.</p>
</main>
${saveBlock(saveScript, `atlantic-schedule-debt-${now.toISOString().slice(0, 10)}.png`)}
</body></html>`;
}
