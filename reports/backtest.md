# Backtest report

Seasons: 20232024, 20242025, 20252026. Generated 2026-10-12.

## 1. Playoff odds

Each season was re-simulated from the standings on Dec 1, Jan 1, Feb 1 and Mar 1, then compared with who actually made the playoffs. Brier score: lower is better (0 = perfect, 0.25 = coin flip).

| Settings (regress games / home edge) | Brier |
|---|---|
| 40 / 0.04 (best) | 0.316 |
| 40 / 0.02 | 0.316 |
| 30 / 0.04 | 0.318 |
| 30 / 0.02 | 0.319 |
| 20 / 0.04 (current) | 0.322 |
| 20 / 0.02 | 0.322 |
| 10 / 0.04 | 0.327 |
| 10 / 0.02 | 0.327 |
| Naive: "whoever holds a spot today makes it" | 0.406 |

**Recommended:** regressGames = 40, homeEdge = 0.04.

### Calibration (best settings)

When the model says X%, how often did it happen?

| Model said | Times | Average prediction | Actually made it |
|---|---|---|---|
| 0–10% | 81 | 3% | 0% |
| 10–20% | 41 | 15% | 7% |
| 20–30% | 33 | 25% | 12% |
| 30–40% | 24 | 35% | 13% |
| 40–50% | 18 | 45% | 11% |
| 50–60% | 22 | 55% | 36% |
| 60–70% | 19 | 65% | 32% |
| 70–80% | 24 | 75% | 29% |
| 80–90% | 20 | 86% | 35% |
| 90–100% | 102 | 97% | 24% |

### Atlantic teams on Jan 1 (best settings)

| Season | Team | Odds | Made it |
|---|---|---|---|
| 20232024 | BOS | 99% | No |
| 20232024 | FLA | 92% | No |
| 20232024 | TOR | 72% | No |
| 20232024 | TBL | 38% | No |
| 20232024 | DET | 31% | No |
| 20232024 | MTL | 7% | No |
| 20232024 | BUF | 4% | No |
| 20232024 | OTT | 12% | No |
| 20242025 | TOR | 94% | No |
| 20242025 | FLA | 94% | No |
| 20242025 | BOS | 41% | No |
| 20242025 | TBL | 97% | No |
| 20242025 | OTT | 70% | No |
| 20242025 | MTL | 21% | No |
| 20242025 | DET | 5% | No |
| 20242025 | BUF | 4% | No |
| 20252026 | DET | 65% | No |
| 20252026 | TBL | 94% | Yes |
| 20252026 | MTL | 73% | Yes |
| 20252026 | BUF | 54% | Yes |
| 20252026 | FLA | 45% | No |
| 20252026 | TOR | 34% | No |
| 20252026 | BOS | 22% | Yes |
| 20252026 | OTT | 40% | Yes |

## 2. Schedule Debt

Logistic regression on 1,312 games: home win ~ home ice + team quality + fatigue differences. "Win chance" is the approximate change in a team's chance of winning that game. |z| above 2 means the effect is probably real; below 1 it's noise.

| Factor | Win chance | z | Current weight | Suggested weight |
|---|---|---|---|---|
| Back-to-back (2nd night) | -4.8 pts | -1.4 | 3 | 3 |
| Third game in four nights | -1.7 pts | -0.6 | 1 | 1.1 |
| Per 1,000 km travelled | -1.0 pts | -0.4 | 0.5 | 0.6 |
| Per time zone crossed | +2.5 pts | 0.9 | 0.5 | 0 |

Home ice: +2.0 pts of win chance. Suggested weights keep a back-to-back at 3 and scale the rest by measured effect; anything that didn't hurt teams gets 0.
