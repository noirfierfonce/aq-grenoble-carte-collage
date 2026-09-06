const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {inGrenoble, validate, directionsUrl} = require('../fixed-coordinates.js');
const boundary = JSON.parse(fs.readFileSync(new URL('../data/grenoble-boundary.geojson', `file://${__filename}`)));

test('La limite communale exclut Eybens, Fontaine et Saint-Égrève', () => {
  assert.equal(inGrenoble({lat:45.1885, lon:5.7245}, boundary), true);
  for (const [lat,lon] of [[45.148,5.750], [45.193,5.682], [45.234,5.682]]) {
    assert.equal(inGrenoble({lat,lon}, boundary), false);
  }
});

test('Une latitude nulle, inversée ou textuelle ne devient pas un repère', () => {
  for (const lat of [null, undefined, NaN, '45.1885', 5.7245]) {
    assert.equal(inGrenoble({lat,lon:5.7245}, boundary), false);
  }
});

test('Une coordonnée sans preuve ne passe pas la validation', () => {
  const points = Array.from({length:209}, (_,i)=>({name:`Point ${i}`,lat:45.1885,lon:5.7245,coordinateStatus:'verified',coordinateSource:'fixture de test'}));
  assert.deepEqual(validate(points,boundary), []);
  delete points[17].coordinateSource;
  assert.ok(validate(points,boundary).some(e=>e.includes('Point 17')));
  points[18].name = points[19].name;
  assert.ok(validate(points,boundary).some(e=>e.includes('double')));
});

test('L’itinéraire utilise les coordonnées même si l’adresse est ambiguë', () => {
  const url = new URL(directionsUrl({lat:45.1885,lon:5.7245,address:'Rue homonyme, Eybens'}));
  assert.equal(url.searchParams.get('destination'), '45.1885,5.7245');
  assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.throws(()=>directionsUrl({address:'Grenoble'}));
});

test('Le code actif ne lit plus le cache de géocodage ni Photon', () => {
  const app = fs.readFileSync(new URL('../app-pwa-v2.js', `file://${__filename}`), 'utf8');
  assert.doesNotMatch(app, /photon|state\.geocode|loadJson\(GEO_KEY/);
  assert.match(app, /addMarker\(point,point\.lat,point\.lon/);
});
