// Schedule Debt: a transparent fatigue score for every game on a team's schedule.
// Each game adds points for back-to-backs, compressed stretches, travel, time zones
// and rest mismatches with the opponent. Sum it up and you get a team's "debt".
import { ARENAS as CURRENT, LEGACY_ARENAS, NEUTRAL_VENUES } from './arenas.mjs';

const ARENAS = { ...CURRENT, ...LEGACY_ARENAS };

// Weights set from the 2023-26 backtest (3,854 games): a back-to-back cost about 6 points of win chance
// and is the anchor at 3; the others are scaled by their measured effect. Time zones showed no cost.
export const WEIGHTS = {
  backToBack: 3, // second night of a back-to-back
  threeInFour: 1.4, // third game in four nights (stacks with a back-to-back)
  per1000km: 0.7, // travel from the previous game's city
  perTimeZone: 0, // each time zone crossed since the previous game
  restMismatch: 1, // + when you're on a back-to-back and they're rested, − when it's the other way round
};

const FINAL = new Set(['OFF', 'FINAL']);
const dayIndex = (isoDate) => Math.round(Date.parse(isoDate + 'T00:00:00Z') / 864e5);

function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Regular-season games for one team, in order, in a compact shape.
export function teamGames(schedule, team) {
  return (schedule?.games ?? [])
    .filter((g) => g.gameType === 2)
    .map((g) => {
      const home = g.homeTeam.abbrev === team;
      const venueName = g.venue?.default;
      const neutral = g.neutralSite && NEUTRAL_VENUES[venueName];
      return {
        id: g.id,
        date: g.gameDate,
        day: dayIndex(g.gameDate),
        home,
        opp: home ? g.awayTeam.abbrev : g.homeTeam.abbrev,
        loc: neutral || ARENAS[g.homeTeam.abbrev],
        done: FINAL.has(g.gameState),
      };
    })
    .filter((g) => g.loc)
    .sort((a, b) => a.day - b.day);
}

// Days of rest a team had before `day` (0 = played yesterday), or null if unknown.
function restBefore(days, day) {
  let prev = null;
  for (const d of days) {
    if (d >= day) break;
    prev = d;
  }
  return prev == null ? null : day - prev - 1;
}

export function scoreTeam(team, gamesByTeam) {
  const games = gamesByTeam[team] ?? [];
  const dayLists = Object.fromEntries(Object.entries(gamesByTeam).map(([t, gs]) => [t, gs.map((g) => g.day)]));
  const myDays = dayLists[team];
  let prevLoc = ARENAS[team];
  let prevDay = null;

  return games.map((g) => {
    const km = haversineKm(prevLoc, g.loc);
    const zones = Math.abs((g.loc.tz ?? 0) - (prevLoc.tz ?? 0));
    const rest = prevDay == null ? null : g.day - prevDay - 1;
    const b2b = rest === 0;
    const threeInFour = myDays.filter((d) => d <= g.day && d >= g.day - 3).length >= 3;
    const oppRest = dayLists[g.opp] ? restBefore(dayLists[g.opp], g.day) : null;
    const mismatch = b2b && oppRest != null && oppRest >= 1 ? 1 : oppRest === 0 && rest != null && rest >= 1 ? -1 : 0;

    const debt =
      (b2b ? WEIGHTS.backToBack : 0) +
      (threeInFour ? WEIGHTS.threeInFour : 0) +
      (km / 1000) * WEIGHTS.per1000km +
      zones * WEIGHTS.perTimeZone +
      mismatch * WEIGHTS.restMismatch;

    prevLoc = g.loc;
    prevDay = g.day;
    return { ...g, km, zones, rest, b2b, threeInFour, oppRest, mismatch, debt };
  });
}

// Season summary for each team: what's been paid, what's still owed, and the running total.
export function debtTable(teams, gamesByTeam, now = new Date()) {
  const today = dayIndex(now.toISOString().slice(0, 10));
  const rows = teams.map((team) => {
    const scored = scoreTeam(team, gamesByTeam);
    const played = scored.filter((g) => g.done || g.day < today);
    const ahead = scored.filter((g) => !(g.done || g.day < today));
    const sum = (list, key) => list.reduce((s, g) => s + (typeof key === 'function' ? key(g) : g[key]), 0);
    let running = 0;
    return {
      team,
      gamesPlayed: played.length,
      debtSoFar: sum(played, 'debt'),
      debtAhead: sum(ahead, 'debt'),
      kmSoFar: sum(played, 'km'),
      kmTotal: sum(scored, 'km'),
      b2bPlayed: played.filter((g) => g.b2b).length,
      b2bTotal: scored.filter((g) => g.b2b).length,
      restEdge: -sum(played, 'mismatch'), // + means the schedule has handed them more rest advantages
      next7: sum(ahead.filter((g) => g.day < today + 7), 'debt'),
      next7Games: ahead.filter((g) => g.day < today + 7).length,
      cumulative: scored.map((g) => (running += g.debt)),
    };
  });
  return rows.sort((a, b) => b.debtSoFar - a.debtSoFar);
}
