import proj4 from 'proj4';

const EPSG_3857 = 'EPSG:3857';
const EPSG_4326 = 'EPSG:4326';

const convertMultiPolygon = (multiPolygon: number[][][][]): number[][][][] => {
  return multiPolygon.map(polygon =>
    polygon.map(ring =>
      ring.map(coord => proj4(EPSG_3857, EPSG_4326, coord))
    )
  );
};

addEventListener('message', ({ data }) => {
  const geoJson = data;

  if (geoJson.type === 'FeatureCollection') {
    geoJson.features.forEach((feature: any) => {
      if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates = convertMultiPolygon(feature.geometry.coordinates);
      }
    });
  }

  postMessage(geoJson);
});
