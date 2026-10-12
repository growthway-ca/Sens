// Home arena location and standard UTC offset (hours) for every NHL team, 2026-27.
// Used for travel distance and time zones crossed. Update if a team moves arenas.
export const ARENAS = {
  ANA: { name: 'Honda Center', lat: 33.8078, lon: -117.8765, tz: -8 },
  BOS: { name: 'TD Garden', lat: 42.3662, lon: -71.0621, tz: -5 },
  BUF: { name: 'KeyBank Center', lat: 42.875, lon: -78.8764, tz: -5 },
  CAR: { name: 'Lenovo Center', lat: 35.8033, lon: -78.7219, tz: -5 },
  CBJ: { name: 'Nationwide Arena', lat: 39.9693, lon: -83.0061, tz: -5 },
  CGY: { name: 'Scotiabank Saddledome', lat: 51.0374, lon: -114.0519, tz: -7 },
  CHI: { name: 'United Center', lat: 41.8807, lon: -87.6742, tz: -6 },
  COL: { name: 'Ball Arena', lat: 39.7487, lon: -105.0077, tz: -7 },
  DAL: { name: 'American Airlines Center', lat: 32.7905, lon: -96.8103, tz: -6 },
  DET: { name: 'Little Caesars Arena', lat: 42.3411, lon: -83.0553, tz: -5 },
  EDM: { name: 'Rogers Place', lat: 53.5469, lon: -113.4979, tz: -7 },
  FLA: { name: 'Amerant Bank Arena', lat: 26.1584, lon: -80.3256, tz: -5 },
  LAK: { name: 'Crypto.com Arena', lat: 34.043, lon: -118.2673, tz: -8 },
  MIN: { name: 'Xcel Energy Center', lat: 44.9448, lon: -93.101, tz: -6 },
  MTL: { name: 'Bell Centre', lat: 45.4961, lon: -73.5693, tz: -5 },
  NJD: { name: 'Prudential Center', lat: 40.7334, lon: -74.1711, tz: -5 },
  NSH: { name: 'Bridgestone Arena', lat: 36.1592, lon: -86.7785, tz: -6 },
  NYI: { name: 'UBS Arena', lat: 40.7114, lon: -73.7256, tz: -5 },
  NYR: { name: 'Madison Square Garden', lat: 40.7505, lon: -73.9934, tz: -5 },
  OTT: { name: 'Canadian Tire Centre', lat: 45.2969, lon: -75.9271, tz: -5 },
  PHI: { name: 'Wells Fargo Center', lat: 39.9012, lon: -75.172, tz: -5 },
  PIT: { name: 'PPG Paints Arena', lat: 40.4395, lon: -79.9892, tz: -5 },
  SEA: { name: 'Climate Pledge Arena', lat: 47.6221, lon: -122.354, tz: -8 },
  SJS: { name: 'SAP Center', lat: 37.3327, lon: -121.901, tz: -8 },
  STL: { name: 'Enterprise Center', lat: 38.6268, lon: -90.2026, tz: -6 },
  TBL: { name: 'Amalie Arena', lat: 27.9427, lon: -82.4519, tz: -5 },
  TOR: { name: 'Scotiabank Arena', lat: 43.6435, lon: -79.3791, tz: -5 },
  UTA: { name: 'Delta Center', lat: 40.7683, lon: -111.9011, tz: -7 },
  VAN: { name: 'Rogers Arena', lat: 49.2778, lon: -123.1089, tz: -8 },
  VGK: { name: 'T-Mobile Arena', lat: 36.1029, lon: -115.1784, tz: -8 },
  WPG: { name: 'Canada Life Centre', lat: 49.8928, lon: -97.1436, tz: -6 },
  WSH: { name: 'Capital One Arena', lat: 38.8981, lon: -77.0209, tz: -5 },
};

// Games played away from both teams' arenas (e.g. Global Series in Europe).
// Key = venue name exactly as the NHL schedule lists it. Add entries as they're announced;
// unknown neutral sites fall back to the home team's arena.
export const NEUTRAL_VENUES = {
  // 'Avicii Arena': { lat: 59.2936, lon: 18.0832, tz: 1 },
};

export const ATLANTIC = ['BOS', 'BUF', 'DET', 'FLA', 'MTL', 'OTT', 'TBL', 'TOR'];

export const SHORT_NAMES = {
  BOS: 'Boston', BUF: 'Buffalo', DET: 'Detroit', FLA: 'Florida',
  MTL: 'Montréal', OTT: 'Ottawa', TBL: 'Tampa Bay', TOR: 'Toronto',
};
