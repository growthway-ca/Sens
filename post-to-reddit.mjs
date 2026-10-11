// Uploads dist/season-at-a-glance.png to Reddit as an image post.
// Needs a Reddit "script" app: https://www.reddit.com/prefs/apps
import { readFile } from 'node:fs/promises';

const {
  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD,
  SUBREDDIT = 'OttawaSenators', FLAIR_ID, POST_DAY = 'Mon',
} = process.env;
const UA = `season-at-a-glance/1.0 by u/${REDDIT_USERNAME}`;

const meta = JSON.parse(await readFile('dist/meta.json', 'utf8'));
// Weekly post: only on POST_DAY (Toronto time). Set POST_DAY=any to post every run.
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short' }).format(new Date());
if (POST_DAY !== 'any' && !today.toLowerCase().startsWith(POST_DAY.toLowerCase().slice(0, 3))) {
  console.log(`Today is ${today}; weekly post goes out on ${POST_DAY}. Skipping.`);
  process.exit(0);
}

// 1. Log in
const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': UA,
  },
  body: new URLSearchParams({ grant_type: 'password', username: REDDIT_USERNAME, password: REDDIT_PASSWORD }),
});
const { access_token, error } = await tokenRes.json();
if (!access_token) throw new Error(`Reddit login failed: ${error ?? tokenRes.status}`);
const api = (route, params) =>
  fetch(`https://oauth.reddit.com${route}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': UA },
    body: new URLSearchParams(params),
  }).then((r) => r.json());

// 2. Ask Reddit for an upload slot, then upload the image to it
const lease = await api('/api/media/asset.json', { filepath: 'season-at-a-glance.png', mimetype: 'image/png' });
const form = new FormData();
for (const { name, value } of lease.args.fields) form.append(name, value);
form.append('file', new Blob([await readFile('dist/season-at-a-glance.png')], { type: 'image/png' }), 'season-at-a-glance.png');
const uploadUrl = 'https:' + lease.args.action;
const up = await fetch(uploadUrl, { method: 'POST', body: form });
if (!up.ok) throw new Error(`Image upload failed: ${up.status}`);
const key = lease.args.fields.find((f) => f.name === 'key').value;

// 3. Submit the post
const post = await api('/api/submit', {
  sr: SUBREDDIT, kind: 'image', title: meta.title, url: `${uploadUrl}/${key}`,
  api_type: 'json', resubmit: 'true', ...(FLAIR_ID ? { flair_id: FLAIR_ID } : {}),
});
if (post.json?.errors?.length) throw new Error(`Reddit rejected the post: ${JSON.stringify(post.json.errors)}`);
console.log(`Posted to r/${SUBREDDIT}: ${meta.title}`);
