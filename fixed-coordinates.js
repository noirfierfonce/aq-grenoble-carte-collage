(function(root) {
  "use strict";

  function inRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i], [px, py] = ring[j];
      if ((y > lat) !== (py > lat) && lon < (px - x) * (lat - y) / (py - y) + x) inside = !inside;
    }
    return inside;
  }

  function inGrenoble(point, boundary) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return false;
    if (boundary?.properties?.code !== "38185") return false;
    const geometry = boundary.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] :
      geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    return polygons.some(rings => inRing(point.lon, point.lat, rings[0]) &&
      !rings.slice(1).some(ring => inRing(point.lon, point.lat, ring)));
  }

  function validate(points, boundary) {
    const errors = [];
    if (!Array.isArray(points) || points.length !== 209) return ["209 points sont requis pour la V1 Grenoble."];
    const names = new Set();
    for (const point of points) {
      if (names.has(point.name)) errors.push(`${point.name} : identifiant en double.`);
      names.add(point.name);
      if (!inGrenoble(point, boundary)) errors.push(`${point.name} : coordonnées absentes ou hors Grenoble.`);
      if (point.coordinateStatus !== "verified" || !point.coordinateSource?.trim()) {
        errors.push(`${point.name} : source et vérification des coordonnées requises.`);
      }
    }
    return errors;
  }

  function directionsUrl(point) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) throw new Error("Coordonnées absentes.");
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("destination", `${point.lat},${point.lon}`);
    url.searchParams.set("travelmode", "walking");
    return url.toString();
  }

  const api = {inGrenoble, validate, directionsUrl};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AQFixedCoordinates = api;
})(globalThis);
