// Name and colours for every club. `primary` fills the header plate; `secondary` is the stripe beside it.
// Highlights (photo rings, "us" row in the playoff table) use a brightened primary so dark navies still show on black.
export const TEAMS = {
  ANA: { name: 'Anaheim Ducks', short: 'Ducks', primary: '#F47A38', secondary: '#B9975B' },
  BOS: { name: 'Boston Bruins', short: 'Bruins', primary: '#FFB81C', secondary: '#FFFFFF' },
  BUF: { name: 'Buffalo Sabres', short: 'Sabres', primary: '#003087', secondary: '#FFB81C' },
  CGY: { name: 'Calgary Flames', short: 'Flames', primary: '#C8102E', secondary: '#F1BE48' },
  CAR: { name: 'Carolina Hurricanes', short: 'Hurricanes', primary: '#CE1126', secondary: '#A2AAAD' },
  CHI: { name: 'Chicago Blackhawks', short: 'Blackhawks', primary: '#CF0A2C', secondary: '#FFFFFF' },
  COL: { name: 'Colorado Avalanche', short: 'Avalanche', primary: '#6F263D', secondary: '#236192' },
  CBJ: { name: 'Columbus Blue Jackets', short: 'Blue Jackets', primary: '#002654', secondary: '#CE1126' },
  DAL: { name: 'Dallas Stars', short: 'Stars', primary: '#006847', secondary: '#8F8F8C' },
  DET: { name: 'Detroit Red Wings', short: 'Red Wings', primary: '#CE1126', secondary: '#FFFFFF' },
  EDM: { name: 'Edmonton Oilers', short: 'Oilers', primary: '#041E42', secondary: '#FF4C00' },
  FLA: { name: 'Florida Panthers', short: 'Panthers', primary: '#C8102E', secondary: '#B9975B' },
  LAK: { name: 'Los Angeles Kings', short: 'Kings', primary: '#3A3D40', secondary: '#A2AAAD' },
  MIN: { name: 'Minnesota Wild', short: 'Wild', primary: '#154734', secondary: '#DDCBA4' },
  MTL: { name: 'Montréal Canadiens', short: 'Canadiens', primary: '#AF1E2D', secondary: '#FFFFFF' },
  NSH: { name: 'Nashville Predators', short: 'Predators', primary: '#FFB81C', secondary: '#FFFFFF' },
  NJD: { name: 'New Jersey Devils', short: 'Devils', primary: '#CE1126', secondary: '#FFFFFF' },
  NYI: { name: 'New York Islanders', short: 'Islanders', primary: '#00539B', secondary: '#F47D30' },
  NYR: { name: 'New York Rangers', short: 'Rangers', primary: '#0038A8', secondary: '#CE1126' },
  OTT: { name: 'Ottawa Senators', short: 'Sens', primary: '#C8102E', secondary: '#C2A26A' },
  PHI: { name: 'Philadelphia Flyers', short: 'Flyers', primary: '#F74902', secondary: '#FFFFFF' },
  PIT: { name: 'Pittsburgh Penguins', short: 'Penguins', primary: '#FCB514', secondary: '#FFFFFF' },
  SJS: { name: 'San Jose Sharks', short: 'Sharks', primary: '#006D75', secondary: '#EA7200' },
  SEA: { name: 'Seattle Kraken', short: 'Kraken', primary: '#355464', secondary: '#99D9D9' },
  STL: { name: 'St. Louis Blues', short: 'Blues', primary: '#002F87', secondary: '#FCB514' },
  TBL: { name: 'Tampa Bay Lightning', short: 'Lightning', primary: '#002868', secondary: '#FFFFFF' },
  TOR: { name: 'Toronto Maple Leafs', short: 'Leafs', primary: '#00205B', secondary: '#FFFFFF' },
  UTA: { name: 'Utah Mammoth', short: 'Mammoth', primary: '#5A8FBF', secondary: '#FFFFFF' },
  VAN: { name: 'Vancouver Canucks', short: 'Canucks', primary: '#00205B', secondary: '#00843D' },
  VGK: { name: 'Vegas Golden Knights', short: 'Golden Knights', primary: '#B4975A', secondary: '#C8102E' },
  WSH: { name: 'Washington Capitals', short: 'Capitals', primary: '#C8102E', secondary: '#FFFFFF' },
  WPG: { name: 'Winnipeg Jets', short: 'Jets', primary: '#041E42', secondary: '#AC162C' },
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
  const t = TEAMS[abbr] ?? { name: abbr, short: abbr, primary: '#C8102E', secondary: '#C2A26A' };
  const hi = abbr === 'OTT' ? t.primary : bright(t.primary);
  const [r, g, b] = hex(hi);
  return { ...t, abbr, hi, hiSoft: `rgba(${r},${g},${b},.38)` };
}
