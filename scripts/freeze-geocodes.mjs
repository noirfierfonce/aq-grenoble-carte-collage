import fs from 'node:fs/promises';

const POINTS_PATH = new URL('../data/points.json', import.meta.url);
const CACHE_PATH = new URL('../geocode-cache-v1.js', import.meta.url);
const REPORT_PATH = new URL('../data/geocode-report.json', import.meta.url);
const CITYCODE = '38185';
const API = 'https://data.geopf.fr/geocodage/search';
const BOUNDS = { minLat: 45.14, maxLat: 45.23, minLon: 5.67, maxLon: 5.79 };
const CENTER = { lat: 45.1885, lon: 5.7245 };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function cleanBase(address) {
  return String(address || '')
    .replace(/,\s*38000\s+Grenoble,\s*France$/i, '')
    .replace(/,\s*Grenoble,\s*France$/i, '')
    .replace(/\bN[°º]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attempts(address) {
  const base = cleanBase(address);
  const out = [];
  const add = value => {
    const q = String(value || '').replace(/\s+/g, ' ').trim();
    if (q && !out.includes(q)) out.push(q);
  };

  add(`${base}, Grenoble`);
  add(`${base.replace(/\([^)]*\)/g, ' ')}, Grenoble`);

  const primary = base.split(/,\s*(?:angle|face|vers|sous|parc|avenue|av\.?|bd\.?|boulevard|rue)\b/i)[0].trim();
  add(`${primary}, Grenoble`);

  const withoutNotes = base
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:angle|face|vers|sous|entrée|centre sportif|école maternelle|école|lycée|collège|groupe scolaire|parking)\b.*$/i, '')
    .trim();
  add(`${withoutNotes}, Grenoble`);

  return out;
}

function inGrenoble(lon, lat) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat &&
    lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenScore(query, props) {
  const q = new Set(normalizeText(query).split(' ').filter(x => x.length > 2));
  const hay = normalizeText([
    props.label, props.name, props.street, props.city, props.context
  ].filter(Boolean).join(' '));
  let hit = 0;
  for (const token of q) if (hay.includes(token)) hit++;
  return q.size ? hit / q.size : 0;
}

async function geocode(query) {
  const url = new URL(API);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '10');
  url.searchParams.set('autocomplete', 'false');
  url.searchParams.set('citycode', CITYCODE);
  url.searchParams.set('lat', String(CENTER.lat));
  url.searchParams.set('lon', String(CENTER.lon));

  const response = await fetch(url, { headers: { 'user-agent': 'AQ-Grenoble-coordinate-freezer/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];

  return features
    .map(feature => {
      const p = feature?.properties || {};
      const c = feature?.geometry?.coordinates || [];
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      const citycode = String(p.citycode || p.cityCode || '');
      const apiScore = Number(p.score || 0);
      return { feature, p, lon, lat, citycode, score: apiScore + tokenScore(query, p) };
    })
    .filter(r => r.citycode === CITYCODE && inGrenoble(r.lon, r.lat))
    .sort((a, b) => b.score - a.score)[0] || null;
}

async function locate(address) {
  let lastError = null;
  for (const query of attempts(address)) {
    try {
      const result = await geocode(query);
      if (result) return { ...result, query };
    } catch (error) {
      lastError = error;
    }
    await sleep(120);
  }
  if (lastError) console.error('Dernière erreur:', lastError.message);
  return null;
}

const raw = await fs.readFile(POINTS_PATH, 'utf8');
const points = JSON.parse(raw);
if (!Array.isArray(points) || points.length !== 209) {
  throw new Error(`points.json doit contenir exactement 209 points, trouvé: ${Array.isArray(points) ? points.length : 'invalide'}`);
}

const byAddress = new Map();
const report = [];
let resolved = 0;

for (let i = 0; i < points.length; i++) {
  const point = points[i];
  const key = point.address;
  let loc = byAddress.get(key);
  if (!loc) {
    loc = await locate(key);
    if (loc) byAddress.set(key, loc);
  }

  if (!loc) {
    report.push({ name: point.name, address: point.address, circuit: point.circuit, status: 'unresolved' });
    console.error(`NON RÉSOLU ${point.name}: ${point.address}`);
    continue;
  }

  point.lat = Number(loc.lat.toFixed(6));
  point.lon = Number(loc.lon.toFixed(6));
  point.citycode = CITYCODE;
  point.geocodeLabel = loc.p.label || loc.p.name || '';
  point.geocodeSource = 'IGN / Géoplateforme';
  resolved++;

  report.push({
    name: point.name,
    address: point.address,
    circuit: point.circuit,
    status: 'ok',
    lat: point.lat,
    lon: point.lon,
    label: point.geocodeLabel,
    query: loc.query,
    score: Number(loc.score.toFixed(4))
  });

  console.log(`${String(i + 1).padStart(3, '0')}/209 ${point.name} -> ${point.lat}, ${point.lon}`);
  await sleep(120);
}

await fs.writeFile(REPORT_PATH, JSON.stringify({ citycode: CITYCODE, total: points.length, resolved, unresolved: points.length - resolved, generatedAt: new Date().toISOString(), points: report }, null, 2) + '\n');

if (resolved !== points.length) {
  throw new Error(`${points.length - resolved} point(s) non résolu(s). Aucun fichier de production n'est remplacé.`);
}

await fs.writeFile(POINTS_PATH, JSON.stringify(points, null, 2) + '\n');

const cache = Object.fromEntries(points.map(p => [p.address, { lat: p.lat, lon: p.lon, approx: false, fixed: true }]));
const cacheJs = `(() => {\n  "use strict";\n  const KEY = "aq-grenoble-geocode-v2";\n  const RESET = "aq-geocode-guard-v2-reset";\n  const FIXED = ${JSON.stringify(cache, null, 2)};\n  try {\n    localStorage.setItem(KEY, JSON.stringify(FIXED));\n    localStorage.setItem(RESET, "1");\n  } catch (_) {}\n})();\n`;
await fs.writeFile(CACHE_PATH, cacheJs);

console.log(`OK: ${resolved}/209 coordonnées figées, toutes citycode=${CITYCODE}.`);
