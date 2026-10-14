// Season at a Glance — pulls live NHL data, writes dist/index.html, then screenshots it to dist/season-at-a-glance.png
// Run: node build.mjs        (set TEAM=TOR etc. to change the home page's club)
// Also writes dist/team/XXX/ for every club, unless ALL_TEAMS=false.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEAMS } from './teams.mjs';

const TEAM = process.env.TEAM ?? 'OTT';
const TZ = 'America/Toronto';
const API = 'https://api-web.nhle.com/v1';
const OUT = process.env.OUT_DIR ?? 'dist';

const DIVISION_ORDER = ['Atlantic', 'Pacific', 'Metropolitan', 'Central'];
// Fallback only — live standings decide divisions and order when available.
const DIVISIONS = {
  Atlantic: ['BOS', 'BUF', 'DET', 'FLA', 'MTL', 'OTT', 'TBL', 'TOR'],
  Metropolitan: ['CAR', 'CBJ', 'NJD', 'NYI', 'NYR', 'PHI', 'PIT', 'WSH'],
  Central: ['CHI', 'COL', 'DAL', 'MIN', 'NSH', 'STL', 'UTA', 'WPG'],
  Pacific: ['ANA', 'CGY', 'EDM', 'LAK', 'SEA', 'SJS', 'VAN', 'VGK'],
};
const FINAL_STATES = new Set(['OFF', 'FINAL']);
const logoUrl = (abbr) => `https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg`;

// ---------- data ----------
export async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'season-at-a-glance' } });
  if (!res.ok) throw new Error(`NHL API returned ${res.status} for ${url}`);
  return res.json();
}

// Standings as they stood the morning after each game we've played, for the playoff-line history.
// The cache is shared across teams so each day's league standings are fetched once per build.
const standingsCache = new Map();
async function standingsHistory(schedule) {
  const days = [
    ...new Set(
      schedule.games
        .filter((g) => g.gameType === 2 && FINAL_STATES.has(g.gameState))
        .map((g) => g.gameDate)
    ),
  ];
  const nextDay = (d) => new Date(Date.parse(d + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
  const out = {};
  for (let i = 0; i < days.length; i += 6) {
    await Promise.all(
      days.slice(i, i + 6).map(async (d) => {
        if (!standingsCache.has(d)) {
          // a missing day just leaves a gap in the line
          standingsCache.set(d, getJSON(`${API}/standings/${nextDay(d)}`).then((r) => r.standings, () => null));
        }
        const day = await standingsCache.get(d);
        if (day) out[d] = day;
      })
    );
  }
  return out;
}

export async function loadData(team = TEAM, shared = {}) {
  if (process.env.FIXTURE_DIR) {
    const read = (f) => readFile(path.join(process.env.FIXTURE_DIR, f), 'utf8').then(JSON.parse);
    const standings = await read('standings.json');
    const schedule = await read('schedule.json');
    const history = await read('history.json').catch(() => ({}));
    const leaders = await read('leaders.json').catch(() => null);
    return { schedule, standings, history, leaders };
  }
  const [schedule, standings] = await Promise.all([
    getJSON(`${API}/club-schedule-season/${team}/now`),
    shared.standings ?? getJSON(`${API}/standings/now`),
  ]);
  const leaders = await getJSON(`${API}/club-stats/${team}/now`).catch(() => null);
  return { schedule, standings, history: await standingsHistory(schedule), leaders };
}

// Points above (+) or below (−) the playoff line, NHL format: top 3 in each division + 2 wild cards.
// In a playoff spot: compared with the first team out. Outside: compared with the last wild card.
function splitConference(rows, team) {
  const me = rows.find((r) => r.teamAbbrev.default === team);
  if (!me) return null;
  const conf = rows.filter((r) => r.conferenceName === me.conferenceName);
  const byPoints = (a, b) => b.points - a.points || a.gamesPlayed - b.gamesPlayed || (b.regulationWins ?? 0) - (a.regulationWins ?? 0);
  const divisionTop = new Set();
  for (const div of new Set(conf.map((r) => r.divisionName))) {
    conf
      .filter((r) => r.divisionName === div)
      .sort((a, b) => (a.divisionSequence ?? 99) - (b.divisionSequence ?? 99) || byPoints(a, b))
      .slice(0, 3)
      .forEach((r) => divisionTop.add(r));
  }
  const race = conf
    .filter((r) => !divisionTop.has(r))
    .sort((a, b) => (a.wildcardSequence || 99) - (b.wildcardSequence || 99) || byPoints(a, b));
  return { me, divisionTop, race };
}

export function playoffGap(rows, team) {
  const split = splitConference(rows, team);
  if (!split) return null;
  const { me, divisionTop, race } = split;
  const inPlayoffs = divisionTop.has(me) || race.indexOf(me) < 2;
  const rival = inPlayoffs ? race[2] : race[1];
  return rival ? me.points - rival.points : null;
}

// Our division's top three, then the two wild cards and the chasers, for the table.
// Our team is appended if it sits further back in the wild card race.
export function wildCardRace(rows, team, shown = 5) {
  const split = splitConference(rows, team);
  if (!split) return null;
  const { me, divisionTop, race } = split;
  const row = (r, tag = '', cut = false) => ({
    abbr: r.teamAbbrev.default,
    logo: logoUrl(r.teamAbbrev.default),
    gp: r.gamesPlayed,
    pts: r.points,
    tag,
    me: r === me,
    cut,
  });
  const letter = (me.divisionName ?? '?').charAt(0);
  const division = [...divisionTop]
    .filter((r) => r.divisionName === me.divisionName)
    .sort((a, b) => (a.divisionSequence ?? 99) - (b.divisionSequence ?? 99))
    .map((r, i) => row(r, `${letter}${i + 1}`));
  const idx = race.indexOf(me);
  return {
    divisionName: me.divisionName,
    division,
    rows: race.slice(0, shown).map((r, i) => row(r, i < 2 ? `WC${i + 1}` : '', i === 1)),
    extra: idx >= shown ? row(me) : null,
  };
}

// Points leader, shots leader and save-percentage leader.
export function teamLeaders(stats, teamGames = 0) {
  if (!stats) return [];
  const skaters = stats.skaters ?? [];
  const goalies = stats.goalies ?? [];
  const top = (list, key) => [...list].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))[0];
  const person = (p) => ({
    name: `${(p.firstName?.default ?? '').charAt(0)}. ${p.lastName?.default ?? ''}`,
    headshot: p.headshot,
    initials: `${(p.firstName?.default ?? '').charAt(0)}${(p.lastName?.default ?? '').charAt(0)}`,
  });
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const out = [];
  const pts = top(skaters, 'points');
  if (pts) {
    out.push({ ...person(pts), label: 'Points', value: pts.points, detail: `${plural(pts.goals, 'goal')}, ${plural(pts.assists, 'assist')}` });
  }
  // Shots leader is shown even when it's the points leader again: it's the real leader, not a fallback.
  const sog = top(skaters, 'shots');
  if (sog?.shots) {
    const pct = sog.shootingPctg != null ? `, ${(sog.shootingPctg * 100).toFixed(1)}% shooting` : '';
    out.push({ ...person(sog), label: 'Shots on goal', value: sog.shots, detail: `${plural(sog.goals, 'goal')}${pct}` });
  }
  // Best save percentage among goalies who've played at least a quarter of the team's games,
  // so one good relief appearance can't top the list. Falls back to the busiest goalie.
  const minGames = Math.max(1, Math.ceil(teamGames / 4));
  const qualified = goalies.filter((p) => (p.gamesPlayed ?? 0) >= minGames && p.savePercentage != null);
  const g = qualified.length ? top(qualified, 'savePercentage') : top(goalies, 'gamesPlayed');
  if (g) {
    const gaa = g.goalsAgainstAverage != null ? `, ${g.goalsAgainstAverage.toFixed(2)} GAA` : '';
    out.push({
      ...person(g),
      label: 'Save percentage',
      value: (g.savePercentage ?? 0).toFixed(3).replace(/^0/, ''),
      detail: `${plural(g.gamesPlayed ?? 0, 'game')}${gaa}`,
    });
  }
  return out;
}

function normaliseGame(g, team) {
  const home = g.homeTeam.abbrev === team;
  const us = home ? g.homeTeam : g.awayTeam;
  const them = home ? g.awayTeam : g.homeTeam;
  const done = FINAL_STATES.has(g.gameState);
  const period = g.gameOutcome?.lastPeriodType ?? 'REG';
  let result = null;
  if (done) result = us.score > them.score ? 'W' : period === 'REG' ? 'L' : 'OTL';
  return {
    start: new Date(g.startTimeUTC),
    home,
    opp: them.abbrev,
    oppLogo: them.darkLogo ?? logoUrl(them.abbrev),
    usScore: us.score,
    themScore: them.score,
    done,
    result,
    period: done && period !== 'REG' ? period : '',
  };
}

function tally(games) {
  const r = { W: 0, L: 0, OTL: 0 };
  for (const g of games) if (g.result) r[g.result]++;
  return `${r.W}-${r.L}-${r.OTL}`;
}

export function buildModel({ schedule, standings, history = {}, leaders = null }, now = new Date(), team = TEAM) {
  const games = schedule.games
    .filter((g) => g.gameType === 2) // regular season only
    .map((g) => ({ ...normaliseGame(g, team), gameDate: g.gameDate }))
    .sort((a, b) => a.start - b.start);

  const rows = standings?.standings ?? [];
  const byAbbr = new Map(rows.map((r) => [r.teamAbbrev.default, r]));
  const rank = (abbr) => byAbbr.get(abbr)?.divisionSequence ?? 99;

  const divisions = DIVISION_ORDER.map((name) => {
    const live = rows.filter((r) => r.divisionName === name).map((r) => r.teamAbbrev.default);
    const teams = (live.length ? live : DIVISIONS[name])
      .filter((a) => a !== team)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    const vs = (abbr) => games.filter((g) => g.opp === abbr);
    return {
      name,
      record: tally(games.filter((g) => teams.includes(g.opp))),
      teams: teams.map((abbr) => ({ abbr, logo: vs(abbr)[0]?.oppLogo ?? logoUrl(abbr), games: vs(abbr) })),
    };
  });

  const me = byAbbr.get(team);
  const played = games.filter((g) => g.done);
  const lastGame = played.at(-1);

  const gapByGame = played.map((g) => (history[g.gameDate] ? playoffGap(history[g.gameDate], team) : null));
  const pts = played.reduce((p, g) => p + (g.result === 'W' ? 2 : g.result === 'OTL' ? 1 : 0), 0);
  let streak = 0;
  for (const g of [...played].reverse()) {
    if ((g.result === 'W') !== (played.at(-1).result === 'W')) break;
    streak++;
  }

  return {
    now,
    team,
    games,
    points: me?.points ?? pts,
    gapByGame,
    playoffGap: playoffGap(rows, team),
    wildCard: wildCardRace(rows, team),
    leaders: teamLeaders(leaders, played.length),
    divisionName: me?.divisionName,
    divisionRank: me?.divisionSequence,
    streak: played.length ? { won: played.at(-1).result === 'W', length: streak } : null,
    record: me ? `${me.wins}-${me.losses}-${me.otLosses}` : tally(games),
    divisions,
    next: games.filter((g) => !g.done && g.start > now - 5 * 3600e3).slice(0, 5),
    last: played.slice(-5).reverse(),
    playedRecently: !!lastGame && now - lastGame.start < 30 * 3600e3,
  };
}

// ---------- formatting ----------
export { TZ, logoUrl, FINAL_STATES, TEAM as HOME_TEAM };
const fmt = (opts) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, ...opts });
const headerDate = (d) =>
  fmt({ month: 'long', day: 'numeric', year: 'numeric' }).format(d).toUpperCase();
const shortDate = (d) => fmt({ weekday: 'short', month: 'short', day: 'numeric' }).format(d).replace('.', '');
const time = (d) =>
  fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(d).replace(/\s?([ap])\.?m\.?/i, '$1m').toLowerCase();

function resultLine(g) {
  const hi = Math.max(g.usScore, g.themScore);
  const lo = Math.min(g.usScore, g.themScore);
  return `${g.result === 'W' ? 'W' : 'L'} // ${hi}–${lo}${g.period ? ' ' + g.period : ''}`;
}

// ---------- render ----------
const HOUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 22V10.4L12 2l9.5 8.4V22h-6.6v-7.6H9.1V22z"/></svg>';
const PLANE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path transform="rotate(90 12 12)" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>';

const logoImg = (src, abbr, cls = 'logo') =>
  `<img class="${cls}" src="${src}" alt="${abbr}" onerror="this.replaceWith(Object.assign(document.createElement('b'),{className:'${cls} abbr',textContent:'${abbr}'}))">`;

const gameIcon = (g) =>
  `<span class="i ${g.done ? g.result.toLowerCase() : 'tbd'}" title="${shortDate(g.start)}">${g.home ? HOUSE : PLANE}</span>`;

function divisionPanel(d) {
  return `
  <section class="panel div div-${d.name.toLowerCase()}">
    <h2>${d.name} // ${d.record}</h2>
    ${d.teams.map((t) => `<div class="row">${logoImg(t.logo, t.abbr)}${t.games.map(gameIcon).join('')}</div>`).join('')}
  </section>`;
}

function nextPanel(next) {
  const rows = next.length
    ? next
        .map(
          (g) => `<div class="fixture">
        <span class="at">${g.home ? '' : '@'}</span>${logoImg(g.oppLogo, g.opp, 'logo lg')}
        <span class="when">${shortDate(g.start)}<br>${time(g.start)}</span></div>`
        )
        .join('')
    : '<p class="empty">Regular season complete</p>';
  return `<section class="panel side next"><h2>Next 5</h2>${rows}</section>`;
}

function lastPanel(last) {
  const rows = last.length
    ? last
        .map((g) => `<div class="fixture">${logoImg(g.oppLogo, g.opp, 'logo lg')}<span class="score">${resultLine(g)}</span></div>`)
        .join('')
    : '<p class="empty">No games played yet</p>';
  return `<section class="panel side last"><h2>Last 5</h2>${rows}</section>`;
}

export function renderHTML(m, fontFaces = '') {
  const [atl, pac, met, cen] = m.divisions;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=1080">
<title>${m.team} season at a glance — ${headerDate(m.now)}</title>
<style>
${fontFaces}
  :root {
    --bg: #252525; --panel: #000; --rule: #e4e4e4;
    --red: #c8102e; --gold: #b79257;
    --win: #2fbf3a; --loss: #e8202a; --otl: #f5b800; --tbd: #6c6c6c;
    --display: 'Anton', Impact, 'Arial Narrow Bold', sans-serif;
    --body: 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; }
  body { background: #111; }
  .canvas { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: var(--bg); color: #fff; font-family: var(--body); }
  .canvas::before { /* big faded crest behind everything */
    content: ""; position: absolute; inset: -8%;
    background: url("${logoUrl(m.team)}") 50% 58% / 115% no-repeat;
    opacity: .13; filter: blur(3px) saturate(1.4);
  }
  .canvas::after { /* faceted shards */
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(115deg, transparent 0 28%, rgba(255,255,255,.035) 28% 46%, transparent 46%),
      linear-gradient(32deg, transparent 0 54%, rgba(0,0,0,.22) 54% 71%, transparent 71%),
      linear-gradient(158deg, rgba(255,255,255,.03) 0 20%, transparent 20% 61%, rgba(0,0,0,.18) 61% 79%, transparent 79%),
      linear-gradient(78deg, transparent 0 12%, rgba(0,0,0,.2) 12% 24%, transparent 24% 83%, rgba(255,255,255,.03) 83%);
  }
  .canvas > * { position: relative; z-index: 1; }

  .tag { position: absolute; top: 48px; width: 318px; height: 60px; background: #000; display: grid; place-items: center;
         font: italic 34px/1 var(--display); letter-spacing: .5px; }
  .tag.date { left: 34px; border: 3px solid var(--red); }
  .tag.rec  { right: 32px; border: 3px solid var(--gold); }
  .crest { position: absolute; top: 10px; left: 50%; width: 210px; height: 160px; object-fit: contain; transform: translateX(-50%); z-index: 3; }
  h1 { position: absolute; top: 122px; left: 0; right: 0; text-align: center; white-space: nowrap; font: italic 112px/1 var(--display); letter-spacing: -1px; z-index: 2; }

  .board { position: absolute; top: 236px; left: 0; right: 0; display: grid; justify-content: center;
           grid-template-columns: 344px 262px 236px; column-gap: 26px; row-gap: 22px; align-items: start; }
  .panel { background: var(--panel); border: 3px solid var(--rule); border-radius: 10px; padding: 12px 14px 10px; }
  .panel h2 { font: italic 27px/1 var(--display); text-transform: uppercase; letter-spacing: .3px; margin-bottom: 8px; }
  .row { display: flex; align-items: center; gap: 6px; height: 56px; }
  .logo { width: 54px; height: 50px; object-fit: contain; flex: none; margin-right: 8px; }
  .abbr { display: grid; place-items: center; font: 500 15px var(--body); border: 2px solid #555; border-radius: 50%; }
  .i { width: 50px; height: 46px; display: grid; place-items: center; flex: none; }
  .i svg { width: 46px; height: 46px; fill: currentColor; }
  .i.w { color: var(--win); } .i.l { color: var(--loss); } .i.otl { color: var(--otl); } .i.tbd { color: var(--tbd); }

  .side { align-self: center; padding: 14px 12px 16px; }
  .side h2 { text-align: center; font-size: 32px; margin-bottom: 12px; }
  .next { margin-top: 40px; }
  .fixture { display: flex; align-items: center; height: 72px; }
  .at { width: 26px; font: 500 24px var(--body); flex: none; }
  .logo.lg { width: 62px; height: 54px; margin-right: 8px; }
  .when, .score { font: 400 20px/1.18 var(--body); white-space: nowrap; }
  .last .fixture { padding-left: 6px; }
  .empty { text-align: center; font: 400 19px var(--body); color: #bbb; padding: 20px 0; }
</style>
</head>
<body>
<main class="canvas">
  <div class="tag date">${headerDate(m.now)}</div>
  <div class="tag rec">${m.record}</div>
  <img class="crest" src="${logoUrl(m.team)}" alt=""" onerror="this.remove()">
  <h1>SEASON AT A GLANCE</h1>
  <div class="board">
    ${divisionPanel(atl)}
    ${divisionPanel(pac)}
    ${nextPanel(m.next)}
    ${divisionPanel(met)}
    ${divisionPanel(cen)}
    ${lastPanel(m.last)}
  </div>
</main>
</body></html>`;
}

// Fonts are bundled from npm (@fontsource) and inlined, so the page never depends on a font CDN.
const FONTS = [
  ['Anton', 400, '@fontsource/anton/files/anton-latin-400-normal.woff2'],
  ['Roboto', 400, '@fontsource/roboto/files/roboto-latin-400-normal.woff2'],
  ['Roboto', 500, '@fontsource/roboto/files/roboto-latin-500-normal.woff2'],
  ['Graduate', 400, '@fontsource/graduate/files/graduate-latin-400-normal.woff2'],
  ['Barlow Condensed', 500, '@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2'],
  ['Barlow Condensed', 600, '@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2'],
  ['Barlow Condensed', 700, '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2'],
];
export async function fontFaceCSS() {
  const faces = await Promise.all(
    FONTS.map(async ([family, weight, file]) => {
      try {
        const b64 = (await readFile(path.join('node_modules', file))).toString('base64');
        return `@font-face { font-family: '${family}'; font-weight: ${weight}; font-display: block; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
      } catch {
        return ''; // falls back to system fonts if npm install was skipped
      }
    })
  );
  return faces.join('\n');
}

// Swap every NHL logo URL for an embedded copy, so the page works offline and
// the in-browser "save image" can draw them (remote images would block it).
const logoCache = new Map(); // url -> data URI (or null), shared across every page in a build
export async function inlineLogos(html) {
  const urls = [...new Set(html.match(/https:\/\/assets\.nhle\.com\/[^"')\s]+\.(?:svg|png|jpg)/g) ?? [])];
  const swaps = await Promise.all(
    urls.map(async (url) => {
      if (!logoCache.has(url)) logoCache.set(url, embed(url));
      const uri = await logoCache.get(url);
      return uri ? [url, uri] : null;
    })
  );
  for (const swap of swaps) if (swap) html = html.split(swap[0]).join(swap[1]);
  return html;
}
async function embed(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    const type = url.endsWith('.svg') ? 'image/svg+xml' : url.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${type};base64,${b64}`;
  } catch {
    return null; // keep the remote URL if a logo can't be fetched
  }
}

export async function screenshot(htmlFile, pngFile) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.goto('file://' + path.resolve(htmlFile), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.canvas').screenshot({ path: pngFile });
  await browser.close();
}

async function main() {
  const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
  const skipShot = process.env.SKIP_SCREENSHOT === 'true';
  const render = process.env.DESIGN === 'classic' ? renderHTML : (await import('./design-ribbon.mjs')).renderRibbon;
  const fonts = await fontFaceCSS();
  const saveScript = await readFile('node_modules/html-to-image/dist/html-to-image.js', 'utf8').catch(() => '');
  const page = async (model, dir) => {
    model.saveScript = saveScript;
    model.picker = Object.keys(TEAMS).sort();
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, 'index.html');
    await writeFile(file, await inlineLogos(render(model, fonts)));
    return file;
  };

  // Home page: the home club, plus the daily image and the details the Reddit post needs.
  const data = await loadData();
  const model = buildModel(data, now);
  const htmlFile = await page(model, OUT);
  const title = `Season at a Glance — ${headerDate(model.now)} (${model.record})`;
  await writeFile(
    path.join(OUT, 'meta.json'),
    JSON.stringify({ title, record: model.record, playedRecently: model.playedRecently }, null, 2)
  );
  if (!skipShot) await screenshot(htmlFile, path.join(OUT, 'season-at-a-glance.png'));
  console.log(`Built ${OUT}/ — ${title}`);

  // A page per club at /team/XXX/, sharing the league standings fetched above.
  if (process.env.ALL_TEAMS === 'false' || process.env.FIXTURE_DIR) return;
  let built = 0;
  for (const team of Object.keys(TEAMS).sort()) {
    try {
      const teamData = team === TEAM ? data : await loadData(team, { standings: data.standings });
      await page(buildModel(teamData, now, team), path.join(OUT, 'team', team));
      built++;
    } catch (err) {
      console.error(`Skipped ${team}: ${err.message}`); // one club's bad data shouldn't sink the whole site
    }
  }
  console.log(`Built ${built} team pages in ${OUT}/team/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
