import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

console.log('Mapbox GL JS Loaded:', mapboxgl);
mapboxgl.accessToken = 'pk.eyJ1IjoicmFjaGVsd3Nha2Ftb3RvIiwiYSI6ImNtaHpsdXBnazByZXMya3EyMTF2ZnczOGQifQ.i0O8Lj2pEglTxoT7jqSx_g';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  
  const mapContainer = map.getContainer();
  const rect = mapContainer.getBoundingClientRect();
  
  return { cx: x, cy: y};
}

map.on('load', async () => {
  map.addSource('boston_route', {
    type:'geojson',
    data:'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });
  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#057532',
      'line-width': 5,
      'line-opacity': 0.6}

  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#d4009b',
      'line-width': 5,
      'line-opacity': 0.6}

  });

  let svg = d3.select("#overlay"); // Select the separate SVG
    if (svg.empty()) {
    svg = d3.select("#map-container")
        .append("svg")
        .attr("id", "overlay")
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "none")
        .style("z-index", 1);
    }

  try {
    const jsonData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
    const baseStations = jsonData.data.stations;

    let trips = await d3.csv(
      'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
      (trip) => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
        return trip;}
    );
    console.log("Trips loaded:", trips.length);

    let stations = computeStationTraffic(baseStations, trips);

    const stationFlow = d3.scaleQuantize()
      .domain([0, 1])
      .range([0, 0.5, 1]);

    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(stations, d => d.totalTraffic)])
      .range([0, 25]);

    let circles = svg
      .selectAll("circle")
      .data(stations, d => d.short_name)
      .enter()
      .append("circle")
      .attr("r", d => radiusScale(d.totalTraffic))
      .attr("fill", "steelblue")
      .style("--departure-ratio",
        d => stationFlow(d.departures / d.totalTraffic))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .each(function (d) {
        d3.select(this)
          .append("title")
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });

      
    function updatePositions() {
      circles
        .attr("cx", d => getCoords(d).cx)
        .attr("cy", d => getCoords(d).cy);
    }
    updatePositions();
    map.on("move", updatePositions);
    map.on("zoom", updatePositions);
    map.on("resize", updatePositions);
    map.on("moveend", updatePositions);

    
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');

    function formatTime(minutes) {
      const date = new Date(0, 0, 0, 0, minutes);
      return date.toLocaleString('en-US', { timeStyle: 'short' });
    }
    let timeFilter = -1;
    function updateTimeDisplay() {
      timeFilter = Number(timeSlider.value);

      if (timeFilter === -1) {
        selectedTime.textContent = "";
        anyTimeLabel.style.display = "block";
      } else {
        selectedTime.textContent = formatTime(timeFilter);
        anyTimeLabel.style.display = "none";
      }

      updateScatterPlot(timeFilter);
    }

    
    function updateScatterPlot(timeFilter) {
      const filteredTrips = filterTripsByTime(trips, timeFilter);
      const filteredStations = computeStationTraffic(baseStations, filteredTrips);

      if (timeFilter === -1) {
        radiusScale.range([0, 25]);
      } else {
        radiusScale.range([3, 50]);
      }

      circles
      .data(filteredStations, d => d.short_name)
      .join("circle")
      .attr("r", d => radiusScale(d.totalTraffic))
      .style("--departure-ratio", d =>
        stationFlow(d.departures / d.totalTraffic)
      );

      updatePositions();
    }

    
    timeSlider.addEventListener("input", updateTimeDisplay);
    updateTimeDisplay();

  } catch (error) {
    console.error("Error loading JSON:", error);
  }
});


function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
  const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);

  return stations.map(station => {
    const id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsByTime(trips, timeFilter) {
  if (timeFilter === -1) return trips;

  return trips.filter(trip => {
    const start = minutesSinceMidnight(trip.started_at);
    const end = minutesSinceMidnight(trip.ended_at);

    return (
      Math.abs(start - timeFilter) <= 60 ||
      Math.abs(end - timeFilter) <= 60
    );
  });
}

