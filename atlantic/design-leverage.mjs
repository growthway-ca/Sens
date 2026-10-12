// "Leverage games" weekly card: playoff odds for each Atlantic team and the upcoming games
// that swing those odds the most.
import { logoUrl } from '../build.mjs';
import { SHORT_NAMES } from './arenas.mjs';
import { img, baseCSS, header, saveBlock } from './shared.mjs';

const fmt = (opts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', ...opts });
const wkday = (iso) => fmt({ weekday: 'short' }).format(new Date(iso + 'T17:00:00Z')).replace('.', '');
const dayNum = (iso) => String(Number(iso.slice(8, 10)));
const pct = (p) => (p >= 0.995 && p < 1 ? '>99' : p > 0 && p < 0.005 ? '<1' : `${Math.round(p * 100)}`);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function oddsRows(teams) {
  return teams
    .map((t) => {
      const change = t.change == null ? '<span class="c muted">—</span>' : `<span class="c ${t.change > 0 ? 'up' : t.change < 0 ? 'down' : ''}">${signed(t.change)}</span>`;
      const big = t.bigGame
        ? `<span class="big">${t.bigGame.home ? 'vs' : '@'} ${img(logoUrl(t.bigGame.opp), t.bigGame.opp, 'blogo')}<span class="bd">${wkday(t.bigGame.date)} ${dayNum(t.bigGame.date)}</span><span class="bs">${pct(t.bigGame.swing)}<small>%</small></span></span>`
        : '<span class="big muted">No games</span>';
      return `<div class="grid row">
      ${img(logoUrl(t.team), t.team, 'logo')}
      <span class="nm">${SHORT_NAMES[t.team] ?? t.team}</span>
      <span class="c">${t.points}</span>
      <span class="c">${t.gp}</span>
      <span class="obar"><i style="width:${(t.odds * 100).toFixed(1)}%"></i></span>
      <span class="odds">${pct(t.odds)}<small>%</small></span>
      ${change}
      ${big}
    </div>`;
    })
    .join('');
}

function tickets(games) {
  if (!games.length) return '<p class="empty">No Atlantic games in the next two weeks.</p>';
  const side = (abbr, swing, atl, prefix) => `<div class="side${atl ? '' : ' other'}">
      <span class="at">${prefix}</span>${img(logoUrl(abbr), abbr, 'tlogo')}<span class="ta">${abbr}</span>
      <span class="sw">${pct(swing)}<small>%</small></span></div>`;
  return games
    .map(
      (g) => `<div class="ticket">
      <div class="stub"><span class="wd">${wkday(g.date)}</span><span class="dn">${dayNum(g.date)}</span></div>
      <div class="sides">${side(g.away, g.awaySwing, g.awayAtl, '')}${side(g.home, g.homeSwing, g.homeAtl, '@')}</div>
    </div>`
    )
    .join('');
}

export function renderLeverage({ teams, games, gamesWindow, now, saveScript = '', settings }, fontFaces = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1080">
<title>Atlantic leverage games</title>
<style>
${baseCSS(fontFaces)}
.grid { display: grid; grid-template-columns: 56px 116px 46px 46px 1fr 86px 60px 214px; align-items: center; column-gap: 12px; }
.cols { height: 28px; font: 600 15px var(--cond); color: var(--mute); }
.cols span:nth-child(3), .cols span:nth-child(4), .cols span:nth-child(6), .cols span:nth-child(7) { text-align: right; }
.row { height: 58px; border-bottom: 1px solid #1c1c1c; }
.logo { width: 52px; height: 42px; object-fit: contain; }
.logo.ph { width: 42px; height: 42px; }
.nm { font: 700 23px var(--cond); white-space: nowrap; }
.c { text-align: right; font: 600 22px var(--cond); }
.c.up { color: var(--green); } .c.down { color: var(--red); } .muted { color: var(--mute); }
.obar { height: 18px; background: #0f0f0f; border-radius: 3px; overflow: hidden; position: relative; }
.obar i { display: block; height: 100%; background: var(--atl); }
.odds { text-align: right; font: 700 36px/1 var(--cond); }
.odds small, .bs small, .sw small { font-size: .55em; color: var(--mute); margin-left: 1px; }
.big { display: flex; align-items: center; gap: 8px; font: 600 18px var(--cond); color: var(--mute); }
.blogo { width: 34px; height: 28px; object-fit: contain; }
.blogo.ph { width: 28px; height: 28px; }
.bd { color: var(--white); }
.bs { margin-left: auto; font: 700 24px var(--cond); color: var(--atl-hi); }

.tickets { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; margin-top: 12px; }
.ticket { display: grid; grid-template-columns: 86px 1fr; height: 108px; background: var(--coal); border-radius: 6px; overflow: hidden; }
.stub { background: var(--atl); display: grid; grid-template-columns: 24px 1fr; align-items: center; border-right: 2px dashed #000; }
.wd { writing-mode: vertical-rl; transform: rotate(180deg); justify-self: center; font: 700 15px/1 var(--cond); letter-spacing: 1px; text-transform: uppercase; }
.dn { justify-self: center; padding-right: 4px; font: 700 40px/1 var(--cond); }
.sides { display: grid; align-content: center; gap: 4px; padding: 0 16px 0 10px; }
.side { display: flex; align-items: center; gap: 10px; height: 46px; }
.at { width: 18px; font: 600 18px var(--cond); color: var(--mute); }
.tlogo { width: 50px; height: 40px; object-fit: contain; }
.tlogo.ph { width: 40px; height: 40px; }
.ta { font: 700 24px var(--cond); }
.sw { margin-left: auto; font: 700 30px var(--cond); color: var(--white); }
.side.other .ta, .side.other .sw { color: var(--mute); }
.empty { font: 500 20px var(--cond); color: var(--mute); padding: 16px 0; }
</style></head><body>
<main class="canvas">
  ${header('Leverage games', 'Playoff odds, and the games that move them most', now)}

  <section style="top:150px">
    <h2><span>Playoff odds</span><small>${settings.sims.toLocaleString('en-CA')} simulated seasons</small></h2>
    <div class="grid cols"><span></span><span></span><span>PTS</span><span>GP</span><span></span><span>Odds</span><span>Week</span><span>Biggest game, next 2 weeks</span></div>
    ${oddsRows(teams)}
  </section>

  <section style="top:716px">
    <h2><span>Biggest games, next ${gamesWindow} days</span><small>% = playoff-odds swing between winning and not winning</small></h2>
    <div class="tickets">${tickets(games)}</div>
  </section>

  <p class="method">How it works: the rest of the season is simulated ${settings.sims.toLocaleString('en-CA')} times from current standings. Team strength comes from goal differential, pulled toward average early in the season, with home ice and overtime built in. A game's swing is a team's playoff odds if it wins minus its odds if it doesn't.</p>
</main>
${saveBlock(saveScript, `atlantic-leverage-${now.toISOString().slice(0, 10)}.png`)}
</body></html>`;
}
