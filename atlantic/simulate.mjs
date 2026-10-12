// Monte Carlo season simulator: playoff odds for every team, and "leverage" for upcoming games
// (playoff odds if a team wins that game minus playoff odds if it doesn't).
// Seeded, so the GitHub run and the Netlify build produce identical numbers on the same day.

export const SIM_SETTINGS = {
  sims: 10000,
  horizonDays: 14, // only games in the next two weeks get leverage numbers
  overtimeRate: 0.23, // share of games that reach OT/shootout (assumption; tune on past seasons)
  homeEdge: 0.04, // added to the home team's win chance
  regressGames: 40, // ratings are pulled toward average as if each team had 40 extra .500 games (best in the 3-season backtest)
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seedFromDate = (iso) => [...iso].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

// Team strength 0..1: goal-differential "Pythagorean" win rate, regressed toward .500.
function strengthOf(r, regress) {
  const gp = r.gamesPlayed || 0;
  const gf = r.goalFor;
  const ga = r.goalAgainst;
  const raw = gf != null && ga != null && gf + ga > 0 ? gf ** 2 / (gf ** 2 + ga ** 2) : gp ? r.points / (2 * gp) : 0.5;
  return (gp * raw + regress * 0.5) / (gp + regress);
}

/**
 * rows: standings rows (NHL API shape) for all 32 teams
 * remaining: [{ id, day, date, home, away }] every unplayed regular-season game in the league
 * today: day index (days since epoch)
 */
export function simulate({ rows, remaining, today, seed = 1, settings = SIM_SETTINGS }) {
  const { sims, horizonDays, overtimeRate, homeEdge, regressGames } = settings;
  const teams = rows.map((r) => r.teamAbbrev.default);
  const idx = Object.fromEntries(teams.map((t, i) => [t, i]));
  const n = teams.length;
  const basePts = rows.map((r) => r.points ?? 0);
  const baseRW = rows.map((r) => r.regulationWins ?? r.wins ?? 0);
  const strength = rows.map((r) => strengthOf(r, regressGames));

  // conference -> division -> team indices
  const confs = {};
  rows.forEach((r, i) => {
    ((confs[r.conferenceName] ??= {})[r.divisionName] ??= []).push(i);
  });

  const games = remaining
    .filter((g) => idx[g.home] != null && idx[g.away] != null)
    .map((g) => {
      const h = idx[g.home];
      const a = idx[g.away];
      const sh = strength[h];
      const sa = strength[a];
      const p = Math.min(0.9, Math.max(0.1, (sh * (1 - sa)) / (sh * (1 - sa) + sa * (1 - sh)) + homeEdge));
      return { ...g, h, a, p };
    });
  const tracked = games.map((g, gi) => (g.day < today + horizonDays ? gi : -1)).filter((gi) => gi >= 0);
  // per tracked game: homeWin: [home made, n, away made] ; awayWin: [home made, n, away made]
  const cnt = tracked.map(() => new Float64Array(6));

  const rng = mulberry32(seed);
  const pts = new Float64Array(n);
  const rw = new Float64Array(n);
  const key = new Float64Array(n);
  const inP = new Uint8Array(n);
  const made = new Float64Array(n);
  const homeWon = new Uint8Array(games.length);
  const byKey = (x, y) => key[y] - key[x];

  for (let s = 0; s < sims; s++) {
    pts.set(basePts);
    rw.set(baseRW);
    for (let gi = 0; gi < games.length; gi++) {
      const g = games[gi];
      const ot = rng() < overtimeRate;
      const win = rng() < (ot ? 0.5 + (g.p - 0.5) / 2 : g.p);
      const [w, l] = win ? [g.h, g.a] : [g.a, g.h];
      pts[w] += 2;
      if (ot) pts[l] += 1;
      else rw[w] += 1;
      homeWon[gi] = win ? 1 : 0;
    }
    // tiebreak: points, then regulation wins, then a coin flip
    for (let t = 0; t < n; t++) key[t] = pts[t] * 1000 + rw[t] + rng() * 0.5;
    inP.fill(0);
    for (const divs of Object.values(confs)) {
      const rest = [];
      for (const list of Object.values(divs)) {
        const sorted = [...list].sort(byKey);
        sorted.slice(0, 3).forEach((t) => (inP[t] = 1));
        rest.push(...sorted.slice(3));
      }
      rest.sort(byKey).slice(0, 2).forEach((t) => (inP[t] = 1));
    }
    for (let t = 0; t < n; t++) made[t] += inP[t];
    for (let k = 0; k < tracked.length; k++) {
      const g = games[tracked[k]];
      const o = homeWon[tracked[k]] ? 0 : 3;
      cnt[k][o] += inP[g.h];
      cnt[k][o + 1] += 1;
      cnt[k][o + 2] += inP[g.a];
    }
  }

  const odds = Object.fromEntries(teams.map((t, i) => [t, made[i] / sims]));
  const swing = (madeIfWin, nWin, madeIfLoss, nLoss) => (nWin && nLoss ? madeIfWin / nWin - madeIfLoss / nLoss : 0);
  const leverage = tracked.map((gi, k) => {
    const g = games[gi];
    const c = cnt[k];
    return {
      id: g.id,
      date: g.date,
      day: g.day,
      home: g.home,
      away: g.away,
      homeWinChance: g.p,
      // home team: wins when home won (c[0]/c[1]), loses when away won (c[3]/c[4])
      homeSwing: swing(c[0], c[1], c[3], c[4]),
      // away team: wins when away won (c[5]/c[4]), loses when home won (c[2]/c[1])
      awaySwing: swing(c[5], c[4], c[2], c[1]),
    };
  });
  return { odds, leverage };
}
