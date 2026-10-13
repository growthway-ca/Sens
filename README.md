# Sens Season at a Glance

Rebuilds the "Season at a Glance" graphic from live NHL data every morning.

## Run it on your computer

```
npm install
npx playwright install chromium
npm run build
```

Open `dist/season-at-a-glance.png` (the image) or `dist/index.html` (the live page).

## Make it run every day on GitHub

1. Create a new GitHub repo and upload this folder (keep the `.github` folder).
2. The workflow runs daily at 3:39am Eastern. To test right away, go to Actions, pick "Season at a glance" and click "Run workflow".
3. Each run saves the PNG under that run's Artifacts so you can download it and post it yourself.

## Netlify (live page)

`netlify.toml` is included, so Netlify builds the page without a browser. Each morning the GitHub workflow saves the new image to `latest/` and pushes it, which triggers Netlify to redeploy. That keeps the page fresh with no build hook. To save the image from the page, tap the Sens logo: on a phone you get the share sheet (choose Save Image), on a computer it downloads.

## Turn on auto-posting (optional)

1. Make a "script" app at https://www.reddit.com/prefs/apps. Reddit reviews new API apps, so this may need approval first.
2. In the repo, go to Settings → Secrets and variables → Actions and add:
   - Secrets: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD`
   - Variables: `AUTO_POST` = `true`
   - Optional variables: `FLAIR_ID` (if the sub requires flair), `POST_DAY` (default `Mon`; the page and image still refresh every day)
3. Check with the r/OttawaSenators mods before turning on automated posts.

## Atlantic: Schedule Debt

`atlantic/` builds a second card at `/atlantic/` on your Netlify site: a fatigue score for every Atlantic team (back-to-backs, travel, time zones, rest mismatches), ranked by debt paid so far, with the full season charted. Tap the gold "Atlantic" plate to save the image.

- Scoring weights live at the top of `atlantic/schedule-debt.mjs` (`WEIGHTS`) and are printed on the card.
- Arena locations are in `atlantic/arenas.mjs`. Add neutral-site games (e.g. Global Series) to `NEUTRAL_VENUES`.
- Run it on its own with `node atlantic/build-atlantic.mjs`.

## Atlantic: Leverage Games

Built in the same run, at `/atlantic/leverage.html`. It simulates the rest of the season 10,000 times from current standings to get playoff odds for every team, then measures each upcoming game's "swing": a team's playoff odds if it wins minus its odds if it doesn't. The card shows Atlantic odds (with week-over-week change), each team's biggest game in the next two weeks, and the eight biggest Atlantic games coming up.

- Model settings (simulations, overtime rate, home ice, early-season regression) are in `SIM_SETTINGS` at the top of `atlantic/simulate.mjs`.
- The simulation is seeded by date, so GitHub and Netlify produce identical numbers each day.
- The GitHub run saves each day's odds to `data/odds-history.json`; the week-over-week column reads from it, so it fills in after the first week.

## Designs

The default is the "season ribbon" design (`design-ribbon.mjs`). To build the original layout instead, run `DESIGN=classic npm run build`.

## How the icons work

House = home game, plane = road game. Ribbon design: white = win, red = regulation loss, gold = OT/SO loss, dark grey = not played yet. Classic design: green / red / yellow / grey.
Division records are Ottawa's record against that division; teams are listed in division standings order.

Set `TEAM=TOR` (or any abbreviation) before `npm run build` to make one for another club.

## Backtest (phase 3)

Actions → "Backtest (phase 3)" → Run workflow. It re-simulates the last three seasons from Dec/Jan/Feb/Mar standings to check the playoff odds are well calibrated (and picks the best model settings), and runs a regression on every game to measure what back-to-backs, travel and time zones actually cost. Results land in `reports/backtest.md` in about 5 minutes.
