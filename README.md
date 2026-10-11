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
2. The workflow runs daily at 6am Eastern. To test right away, go to Actions, pick "Season at a glance" and click "Run workflow".
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

## Designs

The default is the "season ribbon" design (`design-ribbon.mjs`). To build the original layout instead, run `DESIGN=classic npm run build`.

## How the icons work

House = home game, plane = road game. Ribbon design: white = win, red = regulation loss, gold = OT/SO loss, dark grey = not played yet. Classic design: green / red / yellow / grey.
Division records are Ottawa's record against that division; teams are listed in division standings order.

Set `TEAM=TOR` (or any abbreviation) before `npm run build` to make one for another club.
