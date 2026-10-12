# Backtest report

Seasons: 20232024, 20242025, 20252026. Generated 2026-10-12.

## Data check

Confirm these match reality before trusting anything below.

| Season | Games used | Playoff teams (from final results) |
|---|---|---|
| 20232024 | 1,230 | BOS, CAR, COL, DAL, EDM, FLA, LAK, NSH, NYI, NYR, TBL, TOR, VAN, VGK, WPG, WSH |
| 20242025 | 1,312 | CAR, COL, DAL, EDM, FLA, LAK, MIN, MTL, NJD, OTT, STL, TBL, TOR, VGK, WPG, WSH |
| 20252026 | 1,312 | ANA, BOS, BUF, CAR, COL, DAL, EDM, LAK, MIN, MTL, OTT, PHI, PIT, TBL, UTA, VGK |

## 1. Playoff odds

Each season was re-simulated from the standings on Dec 1, Jan 1, Feb 1 and Mar 1, then compared with who actually made the playoffs. Brier score: lower is better (0 = perfect, 0.25 = coin flip).

| Settings (regress games / home edge) | Brier |
|---|---|
| 40 / 0.04 (best) | 0.120 |
| 40 / 0.02 | 0.120 |
| 30 / 0.04 | 0.121 |
| 30 / 0.02 | 0.121 |
| 20 / 0.04 (current) | 0.122 |
| 20 / 0.02 | 0.122 |
| 10 / 0.04 | 0.124 |
| 10 / 0.02 | 0.124 |
| Naive: "whoever holds a spot today makes it" | 0.182 |

**Recommended:** regressGames = 40, homeEdge = 0.04.

### Calibration (best settings)

When the model says X%, how often did it happen?

| Model said | Times | Average prediction | Actually made it |
|---|---|---|---|
| 0–10% | 83 | 3% | 5% |
| 10–20% | 40 | 15% | 20% |
| 20–30% | 31 | 25% | 35% |
| 30–40% | 23 | 34% | 35% |
| 40–50% | 21 | 45% | 24% |
| 50–60% | 20 | 55% | 55% |
| 60–70% | 21 | 65% | 52% |
| 70–80% | 23 | 75% | 61% |
| 80–90% | 20 | 86% | 90% |
| 90–100% | 102 | 97% | 100% |

### Atlantic teams on Jan 1 (best settings)

| Season | Team | Odds | Made it |
|---|---|---|---|
| 20232024 | BOS | 99% | Yes |
| 20232024 | FLA | 92% | Yes |
| 20232024 | TOR | 71% | Yes |
| 20232024 | TBL | 37% | Yes |
| 20232024 | DET | 31% | No |
| 20232024 | MTL | 7% | No |
| 20232024 | BUF | 4% | No |
| 20232024 | OTT | 12% | No |
| 20242025 | TOR | 94% | Yes |
| 20242025 | FLA | 95% | Yes |
| 20242025 | BOS | 42% | No |
| 20242025 | TBL | 97% | Yes |
| 20242025 | OTT | 70% | Yes |
| 20242025 | MTL | 22% | Yes |
| 20242025 | DET | 4% | No |
| 20242025 | BUF | 4% | No |
| 20252026 | DET | 65% | No |
| 20252026 | TBL | 94% | Yes |
| 20252026 | MTL | 72% | Yes |
| 20252026 | BUF | 54% | Yes |
| 20252026 | FLA | 45% | No |
| 20252026 | TOR | 33% | No |
| 20252026 | BOS | 21% | Yes |
| 20252026 | OTT | 40% | Yes |

## 2. Schedule Debt

Logistic regression on 3,854 games: home win ~ home ice + team quality + fatigue differences. "Win chance" is the approximate change in a team's chance of winning that game. |z| above 2 means the effect is probably real; below 1 it's noise.

| Factor | Win chance | z | Current weight | Suggested weight |
|---|---|---|---|---|
| Back-to-back (2nd night) | -6.2 pts | -2.9 | 3 | 3 |
| Third game in four nights | -2.9 pts | -1.5 | 1 | 1.4 |
| Per 1,000 km travelled | -1.4 pts | -1.1 | 0.5 | 0.7 |
| Per time zone crossed | +2.2 pts | 1.4 | 0.5 | 0 |

Home ice: +3.5 pts of win chance. Suggested weights keep a back-to-back at 3 and scale the rest by measured effect; anything that didn't hurt teams gets 0.
