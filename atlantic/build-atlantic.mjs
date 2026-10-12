// Builds the Atlantic "Schedule Debt" card: dist/atlantic/index.html (+ PNG and JSON).
// Run from the repo root: node atlantic/build-atlantic.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getJSON, fontFaceCSS, inlineLogos, screenshot } from '../build.mjs';
import { ARENAS, ATLANTIC } from './arenas.mjs';
import { teamGames, debtTable } from './schedule-debt.mjs';
import { simulate, seedFromDate, SIM_SETTINGS } from './simulate.mjs';

const API = 'https://api-web.nhle.com/v1';
const OUT = path.join(process.env.OUT_DIR ?? 'dist', 'atlantic');

async function loadSchedules() {
  const teams = Object.keys(ARENAS);
  const out = {};
  // every team, because opponents' rest matters too; 8 requests at a time
  for (let i = 0; i < teams.length; i += 8) {
    await Promise.all(
      teams.slice(i, i + 8).map(async (t) => {
        try {
          out[t] = process.env.FIXTURE_DIR
            ? JSON.parse(await readFile(path.join(process.env.FIXTURE_DIR, 'schedules', `${t}.json`), 'utf8'))
            : await getJSON(`${API}/club-schedule-season/${t}/now`);
        } catch {
          out[t] = null; // a missing opponent schedule only removes its rest-mismatch points
        }
      })
    );
  }
  return out;
}

const FINAL = new Set(['OFF', 'FINAL']);
const dayIndex = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 864e5);
const torontoDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(d);
const HISTORY = 'data/odds-history.json';

async function loadStandings() {
  if (process.env.FIXTURE_DIR) return JSON.parse(await readFile(path.join(process.env.FIXTURE_DIR, 'standings.json'), 'utf8')).standings;
  return (await getJSON(`${API}/standings/now`)).standings;
}

// Every unplayed regular-season game in the league, once each.
function remainingGames(schedules, today) {
  const seen = new Map();
  for (const s of Object.values(schedules)) {
    for (const g of s?.games ?? []) {
      if (g.gameType !== 2 || FINAL.has(g.gameState) || seen.has(g.id)) continue;
      const day = dayIndex(g.gameDate);
      if (day < today) continue;
      seen.set(g.id, { id: g.id, date: g.gameDate, day, home: g.homeTeam.abbrev, away: g.awayTeam.abbrev });
    }
  }
  return [...seen.values()];
}

async function buildLeverage({ schedules, now, saveScript, fonts }) {
  const iso = torontoDate(now);
  const today = dayIndex(iso);
  const rows = await loadStandings();
  const { odds, leverage } = simulate({ rows, remaining: remainingGames(schedules, today), today, seed: seedFromDate(iso) });

  // week-over-week change from the saved history (the GitHub run writes it; Netlify only reads)
  const history = JSON.parse(await readFile(HISTORY, 'utf8').catch(() => '{}'));
  const prevDate = Object.keys(history).filter((d) => dayIndex(d) <= today - 6).sort().at(-1);
  if (process.env.WRITE_HISTORY === 'true') {
    history[iso] = Object.fromEntries(Object.entries(odds).map(([t, p]) => [t, Math.round(p * 1000) / 1000]));
    await mkdir(path.dirname(HISTORY), { recursive: true });
    await writeFile(HISTORY, JSON.stringify(history, null, 1));
  }

  const isAtl = (t) => ATLANTIC.includes(t);
  const byAbbr = Object.fromEntries(rows.map((r) => [r.teamAbbrev.default, r]));
  const teams = ATLANTIC.filter((t) => byAbbr[t])
    .map((team) => {
      const mine = leverage
        .filter((g) => g.home === team || g.away === team)
        .map((g) => ({ opp: g.home === team ? g.away : g.home, home: g.home === team, date: g.date, swing: g.home === team ? g.homeSwing : g.awaySwing }))
        .sort((a, b) => b.swing - a.swing);
      return {
        team,
        points: byAbbr[team].points,
        gp: byAbbr[team].gamesPlayed,
        odds: odds[team] ?? 0,
        change: prevDate && history[prevDate][team] != null ? Math.round((odds[team] - history[prevDate][team]) * 100) : null,
        bigGame: mine[0] ?? null,
      };
    })
    .sort((a, b) => b.odds - a.odds);

  const atlGames = (days) =>
    leverage
      .filter((g) => (isAtl(g.home) || isAtl(g.away)) && g.day < today + days)
      .map((g) => ({ ...g, homeAtl: isAtl(g.home), awayAtl: isAtl(g.away), weight: Math.max(isAtl(g.home) ? g.homeSwing : 0, isAtl(g.away) ? g.awaySwing : 0) }))
      .sort((a, b) => b.weight - a.weight);
  let gamesWindow = 7;
  let games = atlGames(7);
  if (games.length < 8) [gamesWindow, games] = [14, atlGames(14)];

  const { renderLeverage } = await import('./design-leverage.mjs');
  const htmlFile = path.join(OUT, 'leverage.html');
  await writeFile(
    htmlFile,
    await inlineLogos(renderLeverage({ teams, games: games.slice(0, 8), gamesWindow, now, saveScript, settings: SIM_SETTINGS }, fonts))
  );
  await writeFile(path.join(OUT, 'leverage.json'), JSON.stringify({ updated: now.toISOString(), odds, teams, games: games.slice(0, 20) }, null, 2));
  if (process.env.SKIP_SCREENSHOT !== 'true') await screenshot(htmlFile, path.join(OUT, 'leverage-games.png'));
  console.log(`Built ${OUT}/leverage.html — playoff odds and leverage games`);
}

async function main() {
  const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
  const schedules = await loadSchedules();
  const gamesByTeam = Object.fromEntries(
    Object.entries(schedules).filter(([, s]) => s).map(([t, s]) => [t, teamGames(s, t)])
  );
  const rows = debtTable(ATLANTIC.filter((t) => gamesByTeam[t]?.length), gamesByTeam, now);
  if (!rows.length) throw new Error('No Atlantic schedules came back from the NHL API');

  const { renderDebt } = await import('./design-debt.mjs');
  const saveScript = await readFile('node_modules/html-to-image/dist/html-to-image.js', 'utf8').catch(() => '');
  await mkdir(OUT, { recursive: true });
  const htmlFile = path.join(OUT, 'index.html');
  await writeFile(htmlFile, await inlineLogos(renderDebt({ rows, now, saveScript }, await fontFaceCSS())));
  await writeFile(
    path.join(OUT, 'schedule-debt.json'),
    JSON.stringify({ updated: now.toISOString(), rows: rows.map(({ cumulative, ...r }) => r) }, null, 2)
  );
  if (process.env.SKIP_SCREENSHOT !== 'true') await screenshot(htmlFile, path.join(OUT, 'schedule-debt.png'));
  console.log(`Built ${OUT}/ — Atlantic schedule debt, ${rows.length} teams`);

  await buildLeverage({ schedules, now, saveScript, fonts: await fontFaceCSS() });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
