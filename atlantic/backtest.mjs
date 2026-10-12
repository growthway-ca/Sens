// Phase 3: test the models on past seasons and write reports/backtest.md
//  1. Playoff-odds calibration: re-run the simulator from Dec/Jan/Feb/Mar standings of past seasons
//     and compare its odds with who actually made the playoffs. Tries several settings, keeps the best.
//  2. Schedule Debt: a logistic regression on every past game measuring what back-to-backs, compressed
//     stretches, travel and time zones actually cost, controlling for team quality.
// Run (needs internet): node atlantic/backtest.mjs     SEASONS=20232024,20242025,20252026
import { mkdir, writeFile } from 'node:fs/promises';
import { getJSON } from '../build.mjs';
import { ARENAS, ATLANTIC } from './arenas.mjs';
import { simulate, SIM_SETTINGS } from './simulate.mjs';
import { teamGames, scoreTeam, WEIGHTS } from './schedule-debt.mjs';

const API = 'https://api-web.nhle.com/v1';
const SEASONS = (process.env.SEASONS ?? '20232024,20242025,20252026').split(',');
const TEAMS = Object.keys(ARENAS);
const FINAL = new Set(['OFF', 'FINAL']);
const dayIndex = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 864e5);
const log = (...a) => console.log(...a);

async function seasonData(season) {
  const schedules = {};
  for (let i = 0; i < TEAMS.length; i += 8) {
    await Promise.all(
      TEAMS.slice(i, i + 8).map(async (t) => {
        // teams that didn't exist that season (e.g. UTA before 2024-25) simply return nothing
        schedules[t] = await getJSON(`${API}/club-schedule-season/${t}/${season}`).catch(() => null);
      })
    );
  }
  const games = new Map();
  for (const s of Object.values(schedules)) for (const g of s?.games ?? []) if (g.gameType === 2) games.set(g.id, g);
  const all = [...games.values()];
  // Final standings are rebuilt from the game results themselves (the standings endpoint can come back
  // empty after a season ends). Conference/division membership comes from mid-season standings.
  const y = Number(season.slice(0, 4));
  const meta = (await getJSON(`${API}/standings/${y + 1}-03-01`)).standings;
  return { schedules, all, finalStandings: finalTable(all, meta) };
}

function finalTable(all, meta) {
  const t = {};
  for (const r of meta) {
    t[r.teamAbbrev.default] = { teamAbbrev: { default: r.teamAbbrev.default }, conferenceName: r.conferenceName, divisionName: r.divisionName, points: 0, regulationWins: 0, wins: 0, gamesPlayed: 0 };
  }
  for (const g of all) {
    if (!FINAL.has(g.gameState) || g.homeTeam.score == null) continue;
    const h = t[g.homeTeam.abbrev];
    const a = t[g.awayTeam.abbrev];
    if (!h || !a) continue;
    const [w, l] = g.homeTeam.score > g.awayTeam.score ? [h, a] : [a, h];
    const extra = (g.gameOutcome?.lastPeriodType ?? 'REG') !== 'REG';
    w.points += 2;
    w.wins += 1;
    if (extra) l.points += 1;
    else w.regulationWins += 1;
    h.gamesPlayed += 1;
    a.gamesPlayed += 1;
  }
  for (const r of Object.values(t)) r.pointPctg = r.gamesPlayed ? r.points / (2 * r.gamesPlayed) : 0.5;
  return Object.values(t);
}

// Same playoff format as the simulator: top 3 per division + 2 wild cards, by points then regulation wins.
function qualifiers(rows) {
  const confs = {};
  for (const r of rows) ((confs[r.conferenceName] ??= {})[r.divisionName] ??= []).push(r);
  const key = (r) => r.points * 1000 + (r.regulationWins ?? r.wins ?? 0) - (r.gamesPlayed ?? 0) * 0.001;
  const made = new Set();
  for (const divs of Object.values(confs)) {
    const rest = [];
    for (const list of Object.values(divs)) {
      const sorted = [...list].sort((a, b) => key(b) - key(a));
      sorted.slice(0, 3).forEach((r) => made.add(r.teamAbbrev.default));
      rest.push(...sorted.slice(3));
    }
    rest.sort((a, b) => key(b) - key(a)).slice(0, 2).forEach((r) => made.add(r.teamAbbrev.default));
  }
  return made;
}

// ---------- 1. playoff-odds calibration ----------
const VARIANTS = [];
for (const regressGames of [10, 20, 30, 40]) for (const homeEdge of [0.02, 0.04]) VARIANTS.push({ regressGames, homeEdge });

async function calibrate(season, data) {
  const y = Number(season.slice(0, 4));
  const snapshots = [`${y}-12-01`, `${y + 1}-01-01`, `${y + 1}-02-01`, `${y + 1}-03-01`];
  const made = qualifiers(data.finalStandings);
  const points = [];
  for (const date of snapshots) {
    const rows = (await getJSON(`${API}/standings/${date}`)).standings;
    const today = dayIndex(date);
    const remaining = data.all
      .filter((g) => dayIndex(g.gameDate) >= today)
      .map((g) => ({ id: g.id, date: g.gameDate, day: dayIndex(g.gameDate), home: g.homeTeam.abbrev, away: g.awayTeam.abbrev }));
    const inSpotNow = qualifiers(rows);
    for (const v of VARIANTS) {
      const { odds } = simulate({ rows, remaining, today, seed: 1, settings: { ...SIM_SETTINGS, ...v, sims: 4000, horizonDays: 0 } });
      for (const r of rows) {
        const t = r.teamAbbrev.default;
        points.push({ season, date, team: t, variant: `${v.regressGames}/${v.homeEdge}`, p: odds[t], made: made.has(t) ? 1 : 0, inSpot: inSpotNow.has(t) ? 1 : 0 });
      }
    }
    log(`  ${season} ${date}: simulated ${VARIANTS.length} settings`);
  }
  return points;
}

// ---------- 2. schedule-debt regression ----------
function logistic(X, y) {
  const k = X[0].length;
  let b = new Array(k).fill(0);
  let cov = null;
  for (let iter = 0; iter < 25; iter++) {
    const H = Array.from({ length: k }, () => new Array(k).fill(0));
    const g = new Array(k).fill(0);
    for (let i = 0; i < X.length; i++) {
      const z = X[i].reduce((s, x, j) => s + x * b[j], 0);
      const p = 1 / (1 + Math.exp(-z));
      const w = p * (1 - p);
      for (let j = 0; j < k; j++) {
        g[j] += (y[i] - p) * X[i][j];
        for (let m = 0; m < k; m++) H[j][m] += w * X[i][j] * X[i][m];
      }
    }
    cov = invert(H);
    const step = cov.map((row) => row.reduce((s, h, m) => s + h * g[m], 0));
    b = b.map((bj, j) => bj + step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return { b, se: cov.map((row, j) => Math.sqrt(Math.max(row[j], 0))) };
}

function invert(A) {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-12;
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row.slice(n));
}

function debtRows(data) {
  const gamesByTeam = Object.fromEntries(
    Object.entries(data.schedules).filter(([, s]) => s).map(([t, s]) => [t, teamGames(s, t)])
  );
  const factors = {};
  for (const t of Object.keys(gamesByTeam)) for (const g of scoreTeam(t, gamesByTeam)) (factors[g.id] ??= {})[t] = g;
  const pct = Object.fromEntries(data.finalStandings.map((r) => [r.teamAbbrev.default, Math.min(0.8, Math.max(0.2, r.pointPctg ?? 0.5))]));
  const logit = (p) => Math.log(p / (1 - p));
  const X = [];
  const y = [];
  for (const g of data.all) {
    if (!FINAL.has(g.gameState) || g.homeTeam.score == null) continue;
    const h = factors[g.id]?.[g.homeTeam.abbrev];
    const a = factors[g.id]?.[g.awayTeam.abbrev];
    if (!h || !a || pct[g.homeTeam.abbrev] == null || pct[g.awayTeam.abbrev] == null) continue;
    X.push([
      1, // home ice
      logit(pct[g.homeTeam.abbrev]) - logit(pct[g.awayTeam.abbrev]), // team quality
      (h.b2b ? 1 : 0) - (a.b2b ? 1 : 0),
      (h.threeInFour ? 1 : 0) - (a.threeInFour ? 1 : 0),
      (h.km - a.km) / 1000,
      h.zones - a.zones,
    ]);
    y.push(g.homeTeam.score > g.awayTeam.score ? 1 : 0);
  }
  return { X, y };
}

// ---------- report ----------
const brier = (pts, f = (p) => p.p) => pts.reduce((s, p) => s + (f(p) - p.made) ** 2, 0) / pts.length;
const fmt = (n, d = 3) => n.toFixed(d);

async function main() {
  const calib = [];
  const X = [];
  const y = [];
  const checks = [];
  for (const season of SEASONS) {
    log(`Season ${season}: downloading schedules and standings`);
    const data = await seasonData(season);
    calib.push(...(await calibrate(season, data)));
    const d = debtRows(data);
    X.push(...d.X);
    y.push(...d.y);
    const made = [...qualifiers(data.finalStandings)].sort();
    checks.push({ season, games: d.y.length, playoffTeams: made });
    if (made.length !== 16 || d.y.length < 1000) throw new Error(`Season ${season} looks incomplete: ${made.length} playoff teams, ${d.y.length} games`);
  }

  // best settings by Brier score (lower is better)
  const byVariant = VARIANTS.map((v) => {
    const name = `${v.regressGames}/${v.homeEdge}`;
    const pts = calib.filter((p) => p.variant === name);
    return { ...v, name, brier: brier(pts), pts };
  }).sort((a, b) => a.brier - b.brier);
  const best = byVariant[0];
  const current = byVariant.find((v) => v.regressGames === SIM_SETTINGS.regressGames && v.homeEdge === SIM_SETTINGS.homeEdge);
  const naive = brier(best.pts, (p) => p.inSpot);
  const buckets = Array.from({ length: 10 }, (_, i) => {
    const inB = best.pts.filter((p) => p.p >= i / 10 && (p.p < (i + 1) / 10 || (i === 9 && p.p <= 1)));
    return { range: `${i * 10}–${(i + 1) * 10}%`, n: inB.length, predicted: inB.reduce((s, p) => s + p.p, 0) / (inB.length || 1), actual: inB.reduce((s, p) => s + p.made, 0) / (inB.length || 1) };
  });
  const atlantic = best.pts.filter((p) => ATLANTIC.includes(p.team) && p.date.endsWith('-01-01'));

  const reg = logistic(X, y);
  const names = ['Home ice', 'Team quality', 'Back-to-back (2nd night)', 'Third game in four nights', 'Per 1,000 km travelled', 'Per time zone crossed'];
  const effects = reg.b.map((b, i) => ({ name: names[i], coef: b, se: reg.se[i], z: b / reg.se[i], pp: (b / 4) * 100 }));
  const b2b = effects[2].coef;
  const suggest = (coef) => (b2b < 0 && coef < 0 ? Math.round((coef / b2b) * 3 * 10) / 10 : 0);

  const md = `# Backtest report

Seasons: ${SEASONS.join(', ')}. Generated ${new Date().toISOString().slice(0, 10)}.

## Data check

Confirm these match reality before trusting anything below.

| Season | Games used | Playoff teams (from final results) |
|---|---|---|
${checks.map((c) => `| ${c.season} | ${c.games.toLocaleString('en-CA')} | ${c.playoffTeams.join(', ')} |`).join('\n')}

## 1. Playoff odds

Each season was re-simulated from the standings on Dec 1, Jan 1, Feb 1 and Mar 1, then compared with who actually made the playoffs. Brier score: lower is better (0 = perfect, 0.25 = coin flip).

| Settings (regress games / home edge) | Brier |
|---|---|
${byVariant.map((v) => `| ${v.regressGames} / ${v.homeEdge}${v === best ? ' (best)' : ''}${v === current ? ' (current)' : ''} | ${fmt(v.brier)} |`).join('\n')}
| Naive: "whoever holds a spot today makes it" | ${fmt(naive)} |

**Recommended:** regressGames = ${best.regressGames}, homeEdge = ${best.homeEdge}.

### Calibration (best settings)

When the model says X%, how often did it happen?

| Model said | Times | Average prediction | Actually made it |
|---|---|---|---|
${buckets.filter((b) => b.n).map((b) => `| ${b.range} | ${b.n} | ${fmt(b.predicted * 100, 0)}% | ${fmt(b.actual * 100, 0)}% |`).join('\n')}

### Atlantic teams on Jan 1 (best settings)

| Season | Team | Odds | Made it |
|---|---|---|---|
${atlantic.map((p) => `| ${p.season} | ${p.team} | ${fmt(p.p * 100, 0)}% | ${p.made ? 'Yes' : 'No'} |`).join('\n')}

## 2. Schedule Debt

Logistic regression on ${y.length.toLocaleString('en-CA')} games: home win ~ home ice + team quality + fatigue differences. "Win chance" is the approximate change in a team's chance of winning that game. |z| above 2 means the effect is probably real; below 1 it's noise.

| Factor | Win chance | z | Current weight | Suggested weight |
|---|---|---|---|---|
${effects.slice(2).map((e, i) => `| ${e.name} | ${e.pp >= 0 ? '+' : ''}${fmt(e.pp, 1)} pts | ${fmt(e.z, 1)} | ${[WEIGHTS.backToBack, WEIGHTS.threeInFour, WEIGHTS.per1000km, WEIGHTS.perTimeZone][i]} | ${i === 0 ? 3 : suggest(e.coef)} |`).join('\n')}

Home ice: ${effects[0].pp >= 0 ? '+' : ''}${fmt(effects[0].pp, 1)} pts of win chance. Suggested weights keep a back-to-back at 3 and scale the rest by measured effect; anything that didn't hurt teams gets 0.
`;
  await mkdir('reports', { recursive: true });
  await writeFile('reports/backtest.md', md);
  await writeFile(
    'reports/backtest.json',
    JSON.stringify({ seasons: SEASONS, variants: byVariant.map(({ pts, ...v }) => v), naive, buckets, effects }, null, 2)
  );
  log('Wrote reports/backtest.md');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
