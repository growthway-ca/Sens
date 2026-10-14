// Name and colours for every club. `primary` fills the header plate; `secondary` is the stripe beside it.
// `tz` is the club's home time zone, used for game times and dates on its page.
// Highlights (photo rings, "us" row in the playoff table) use a brightened primary so dark navies still show on black.
export const TEAMS = {
  ANA: { name: 'Anaheim Ducks', short: 'Ducks', primary: '#F47A38', secondary: '#B9975B', tz: 'America/Los_Angeles' },
  BOS: { name: 'Boston Bruins', short: 'Bruins', primary: '#FFB81C', secondary: '#FFFFFF', tz: 'America/Toronto' },
  BUF: { name: 'Buffalo Sabres', short: 'Sabres', primary: '#003087', secondary: '#FFB81C', tz: 'America/Toronto' },
  CGY: { name: 'Calgary Flames', short: 'Flames', primary: '#C8102E', secondary: '#F1BE48', tz: 'America/Edmonton' },
  CAR: { name: 'Carolina Hurricanes', short: 'Hurricanes', primary: '#CE1126', secondary: '#A2AAAD', tz: 'America/Toronto' },
  CHI: { name: 'Chicago Blackhawks', short: 'Blackhawks', primary: '#CF0A2C', secondary: '#FFFFFF', tz: 'America/Chicago' },
  COL: { name: 'Colorado Avalanche', short: 'Avalanche', primary: '#6F263D', secondary: '#236192', tz: 'America/Denver' },
  CBJ: { name: 'Columbus Blue Jackets', short: 'Blue Jackets', primary: '#002654', secondary: '#CE1126', tz: 'America/Toronto' },
  DAL: { name: 'Dallas Stars', short: 'Stars', primary: '#006847', secondary: '#8F8F8C', tz: 'America/Chicago' },
  DET: { name: 'Detroit Red Wings', short: 'Red Wings', primary: '#CE1126', secondary: '#FFFFFF', tz: 'America/Toronto' },
  EDM: { name: 'Edmonton Oilers', short: 'Oilers', primary: '#041E42', secondary: '#FF4C00', tz: 'America/Edmonton' },
  FLA: { name: 'Florida Panthers', short: 'Panthers', primary: '#C8102E', secondary: '#B9975B', tz: 'America/Toronto' },
  LAK: { name: 'Los Angeles Kings', short: 'Kings', primary: '#3A3D40', secondary: '#A2AAAD', tz: 'America/Los_Angeles' },
  MIN: { name: 'Minnesota Wild', short: 'Wild', primary: '#154734', secondary: '#DDCBA4', tz: 'America/Chicago' },
  MTL: { name: 'Montréal Canadiens', short: 'Canadiens', primary: '#AF1E2D', secondary: '#FFFFFF', tz: 'America/Toronto' },
  NSH: { name: 'Nashville Predators', short: 'Predators', primary: '#FFB81C', secondary: '#FFFFFF', tz: 'America/Chicago' },
  NJD: { name: 'New Jersey Devils', short: 'Devils', primary: '#CE1126', secondary: '#FFFFFF', tz: 'America/Toronto' },
  NYI: { name: 'New York Islanders', short: 'Islanders', primary: '#00539B', secondary: '#F47D30', tz: 'America/Toronto' },
  NYR: { name: 'New York Rangers', short: 'Rangers', primary: '#0038A8', secondary: '#CE1126', tz: 'America/Toronto' },
  OTT: { name: 'Ottawa Senators', short: 'Sens', primary: '#C8102E', secondary: '#C2A26A', tz: 'America/Toronto' },
  PHI: { name: 'Philadelphia Flyers', short: 'Flyers', primary: '#F74902', secondary: '#FFFFFF', tz: 'America/Toronto' },
  PIT: { name: 'Pittsburgh Penguins', short: 'Penguins', primary: '#FCB514', secondary: '#FFFFFF', tz: 'America/Toronto' },
  SJS: { name: 'San Jose Sharks', short: 'Sharks', primary: '#006D75', secondary: '#EA7200', tz: 'America/Los_Angeles' },
  SEA: { name: 'Seattle Kraken', short: 'Kraken', primary: '#355464', secondary: '#99D9D9', tz: 'America/Los_Angeles' },
  STL: { name: 'St. Louis Blues', short: 'Blues', primary: '#002F87', secondary: '#FCB514', tz: 'America/Chicago' },
  TBL: { name: 'Tampa Bay Lightning', short: 'Lightning', primary: '#002868', secondary: '#FFFFFF', tz: 'America/Toronto' },
  TOR: { name: 'Toronto Maple Leafs', short: 'Leafs', primary: '#00205B', secondary: '#FFFFFF', tz: 'America/Toronto' },
  UTA: { name: 'Utah Mammoth', short: 'Mammoth', primary: '#5A8FBF', secondary: '#FFFFFF', tz: 'America/Denver' },
  VAN: { name: 'Vancouver Canucks', short: 'Canucks', primary: '#00205B', secondary: '#00843D', tz: 'America/Vancouver' },
  VGK: { name: 'Vegas Golden Knights', short: 'Golden Knights', primary: '#B4975A', secondary: '#C8102E', tz: 'America/Los_Angeles' },
  WSH: { name: 'Washington Capitals', short: 'Capitals', primary: '#C8102E', secondary: '#FFFFFF', tz: 'America/Toronto' },
  WPG: { name: 'Winnipeg Jets', short: 'Jets', primary: '#041E42', secondary: '#AC162C', tz: 'America/Winnipeg' },
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const luminance = (h) => {
  const [r, g, b] = hex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Mix toward white until the colour is clearly visible on a black page.
function bright(h) {
  let rgb = hex(h);
  for (let i = 0; i < 10 && luminance(toHex(rgb)) < 0.09; i++) rgb = rgb.map((v) => v + (255 - v) * 0.15);
  return toHex(rgb);
}

export function teamTheme(abbr) {
  const t = TEAMS[abbr] ?? { name: abbr, short: abbr, primary: '#C8102E', secondary: '#C2A26A', tz: 'America/Toronto' };
  const hi = abbr === 'OTT' ? t.primary : bright(t.primary);
  const [r, g, b] = hex(hi);
  return { ...t, abbr, hi, hiSoft: `rgba(${r},${g},${b},.38)` };
}
