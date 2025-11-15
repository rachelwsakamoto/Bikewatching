import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
console.log('Mapbox GL JS Loaded:', mapboxgl);

mapboxgl.accessToken = 'pk.eyJ1IjoicmFjaGVsd3Nha2Ftb3RvIiwiYSI6ImNtaHpsdXBnazByZXMya3EyMTF2ZnczOGQifQ.i0O8Lj2pEglTxoT7jqSx_g';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

map.on('load', async () => {
  //code
  map.addSource('boston_route', {
  type: 'geojson',
  data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',});
  map.addLayer({
  id: 'bike-lanes',
  type: 'line',
  source: 'boston_route',
  paint: {
    'line-color': 'green',
    'line-width': 3,
    'line-opacity': 0.4,},
});
});