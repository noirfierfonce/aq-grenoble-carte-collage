const fs = require('node:fs');
const path = require('node:path');
const {validate} = require('../fixed-coordinates.js');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../data', name)));
const errors = validate(read('points.json'), read('grenoble-boundary.geojson'));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('209 coordonnées documentées dans la commune de Grenoble.');
