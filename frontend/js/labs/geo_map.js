import { apiPost, showToast } from '../app.js';

// --- Color Constants ---
const COLOR_S = '#5cb87a'; // Green - Susceptible
const COLOR_I = '#e05c5c'; // Red - Infected
const COLOR_R = '#5b8fd9'; // Blue - Recovered
const COLOR_V = '#c9a24e'; // Gold - Vaccinated (DP optimal)

const BENGALURU_SAMPLE_DATA = [
  { name: "Majestic (KSR Station)", lat: 12.9786, lng: 77.5714, population: 800 },
  { name: "Koramangala 5th Block", lat: 12.9352, lng: 77.6245, population: 650 },
  { name: "Indiranagar 100ft Rd", lat: 12.9719, lng: 77.6412, population: 700 },
  { name: "Jayanagar 4th Block", lat: 12.9290, lng: 77.5828, population: 600 },
  { name: "Whitefield Inner Circle", lat: 12.9698, lng: 77.7499, population: 550 },
  { name: "Electronic City Phase 1", lat: 12.8497, lng: 77.6805, population: 900 },
  { name: "Malleshwaram 15th Cross", lat: 12.9984, lng: 77.5702, population: 500 },
  { name: "MG Road Metro Station", lat: 12.9754, lng: 77.6068, population: 750 },
  { name: "HSR Layout Sector 3", lat: 12.9105, lng: 77.6450, population: 580 },
  { name: "Madiwala Market", lat: 12.9226, lng: 77.6201, population: 720 },
  { name: "Hebbal Flyover", lat: 13.0359, lng: 77.5978, population: 480 },
  { name: "Rajajinagar 1st Block", lat: 12.9902, lng: 77.5534, population: 520 },
  { name: "Banashankari 3rd Stage", lat: 12.9254, lng: 77.5468, population: 610 },
  { name: "Yelahanka New Town", lat: 13.0991, lng: 77.5921, population: 450 },
  { name: "Ulsoor Lake", lat: 12.9818, lng: 77.6207, population: 400 },
  { name: "Basavanagudi (DVG Road)", lat: 12.9417, lng: 77.5750, population: 620 },
  { name: "Sadashivanagar", lat: 13.0068, lng: 77.5813, population: 350 },
  { name: "RT Nagar", lat: 13.0182, lng: 77.5946, population: 480 },
  { name: "BTM Layout 2nd Stage", lat: 12.9165, lng: 77.6101, population: 670 },
  { name: "Bellandur (ORR)", lat: 12.9304, lng: 77.6784, population: 850 },
  { name: "Marathahalli Bridge", lat: 12.9562, lng: 77.6967, population: 780 },
  { name: "Yeshwanthpur Junction", lat: 13.0236, lng: 77.5501, population: 690 },
  { name: "Bannerghatta Rd (IIMB)", lat: 12.8959, lng: 77.5997, population: 500 },
  { name: "Vijayanagar Metro", lat: 12.9696, lng: 77.5350, population: 580 },
  { name: "Kalyan Nagar", lat: 13.0221, lng: 77.6403, population: 460 }
];

// --- Map State ---
let map = null;
let currentLocations = [];
let pipelineResult = null;
let tileLayer = null;

// Leaflet Layers
let markerGroup = null;
let edgeGroup = null;

// Playback State
let playInterval = null;
let currentStep = 0;
let isPlaying = false;
let playbackMode = 'without'; // 'without' or 'with'

// Chart.js State
let compareChart = null;

export function initGeoMap() {
  initLeafletMap();
  setupUIEventListeners();
}

function initLeafletMap() {
  if (map) return;
  // Center on Bengaluru Majestic
  map = L.map('geo-leaflet-map', {
    zoomControl: true,
    minZoom: 10,
    maxZoom: 16
  }).setView([12.9716, 77.5946], 11);

  // Load Google Maps Roadmap tiles directly to match Google Maps format
  const googleMapsUrl = 'https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}';

  tileLayer = L.tileLayer(googleMapsUrl, {
    attribution: '&copy; Google Maps'
  }).addTo(map);

  markerGroup = L.layerGroup().addTo(map);
  edgeGroup = L.layerGroup().addTo(map);

  // Listen for theme changes to repaint edges under the new theme contrast
  document.addEventListener('themeChanged', (e) => {
    if (pipelineResult) {
      drawContactEdges(pipelineResult.graph.edges, pipelineResult.graph.nodes);
    }
  });
}

function setupUIEventListeners() {
  // Slider displays
  bindSlider('geo-radius', 'geo-radius-val', v => `${parseFloat(v).toFixed(1)} km`);
  bindSlider('geo-budget', 'geo-budget-val', v => v);
  bindSlider('geo-beta', 'geo-beta-val', v => parseFloat(v).toFixed(2));
  bindSlider('geo-gamma', 'geo-gamma-val', v => parseFloat(v).toFixed(2));
  bindSlider('geo-speed', 'geo-speed-val', v => `${v}ms`);

  // Sample data button
  document.getElementById('geo-btn-sample').addEventListener('click', () => {
    loadLocations(BENGALURU_SAMPLE_DATA);
    showToast('Loaded 25 Bengaluru ward sample coordinates.', 'success');
  });

  // Run pipeline button
  document.getElementById('geo-btn-run').addEventListener('click', runGeoPipeline);

  // CSV Drag and Drop / Input
  const dropzone = document.getElementById('geo-csv-dropzone');
  const fileInput = document.getElementById('geo-csv-input');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleCSVFile(e.target.files[0]));

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--teal)';
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border)';
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border)';
    if (e.dataTransfer.files.length > 0) {
      handleCSVFile(e.dataTransfer.files[0]);
    }
  });

  // Playback Control Buttons
  document.getElementById('geo-btn-play').addEventListener('click', togglePlayback);
  document.getElementById('geo-btn-fwd').addEventListener('click', stepFwd);
  document.getElementById('geo-btn-back').addEventListener('click', stepBack);
  document.getElementById('geo-btn-reset').addEventListener('click', resetPlayback);

  // Speed slider adjustment on the fly
  document.getElementById('geo-speed').addEventListener('input', () => {
    if (isPlaying) {
      stopPlayback();
      startPlayback();
    }
  });

  // Toggle playback mode (with/without vaccination)
  const btnWithout = document.getElementById('geo-toggle-without');
  const btnWith = document.getElementById('geo-toggle-with');

  btnWithout.addEventListener('click', () => {
    btnWithout.classList.add('active');
    btnWith.classList.remove('active');
    setPlaybackMode('without');
  });

  btnWith.addEventListener('click', () => {
    btnWith.classList.add('active');
    btnWithout.classList.remove('active');
    setPlaybackMode('with');
  });
}

function bindSlider(id, displayId, formatFn) {
  const slider = document.getElementById(id);
  const display = document.getElementById(displayId);
  slider.addEventListener('input', (e) => {
    display.textContent = formatFn(e.target.value);
  });
  display.textContent = formatFn(slider.value);
}

function handleCSVFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    try {
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        showToast('No valid rows found in CSV. Format: lat, lng, population, name', 'error');
        return;
      }
      loadLocations(parsed);
      showToast(`Loaded ${parsed.length} locations from CSV.`, 'success');
    } catch (err) {
      showToast(`CSV Parse Error: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const results = [];
  let headerSkipped = false;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length < 2) continue;

    // Check if header line (non-numeric first column)
    if (!headerSkipped && isNaN(parseFloat(parts[0]))) {
      headerSkipped = true;
      continue;
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    const population = parts.length > 2 ? parseInt(parts[2], 10) : 100;
    const name = parts.length > 3 ? parts.slice(3).join(',').replace(/^"|"$/g, '').trim() : `Ward ${results.length + 1}`;

    if (!isNaN(lat) && !isNaN(lng)) {
      results.push({ lat, lng, population, name });
    }
  }
  return results;
}

function loadLocations(locs) {
  currentLocations = locs;
  pipelineResult = null;
  resetPlayback();

  // Clear map layers
  markerGroup.clearLayers();
  edgeGroup.clearLayers();

  // Fit bounds to new nodes
  if (locs.length > 0) {
    const bounds = L.latLngBounds(locs.map(l => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }

  // Draw initial nodes as grey circle markers
  locs.forEach((loc, idx) => {
    const radius = Math.max(6, Math.min(22, Math.sqrt(loc.population) * 0.6));
    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: radius,
      fillColor: '#8891a4',
      color: '#ffffff',
      weight: 1.5,
      fillOpacity: 0.8
    });

    marker.bindPopup(`
      <div style="font-family:var(--font-body); font-size:12px; color:var(--text-heading)">
        <strong>${loc.name}</strong><br/>
        Population: ${loc.population}<br/>
        Ward ID: ${idx}
      </div>
    `);
    markerGroup.addLayer(marker);
  });

  // Enable run button
  document.getElementById('geo-btn-run').disabled = false;
  document.getElementById('geo-map-status').textContent = 'Graph ready to analyze.';
  
  // Hide results and playback panels until pipeline runs
  document.getElementById('geo-playback-section').style.display = 'none';
  document.getElementById('geo-results-section').style.display = 'none';
}

async function runGeoPipeline() {
  if (currentLocations.length === 0) return;

  const btn = document.getElementById('geo-btn-run');
  btn.disabled = true;
  btn.textContent = 'Running Pipeline...';
  document.getElementById('geo-map-status').textContent = 'Running Brandes centrality, DP vaccination & SIR simulation...';

  try {
    const radius = parseFloat(document.getElementById('geo-radius').value);
    const budget = parseInt(document.getElementById('geo-budget').value, 10);
    const beta = parseFloat(document.getElementById('geo-beta').value);
    const gamma = parseFloat(document.getElementById('geo-gamma').value);

    const payload = {
      locations: currentLocations,
      proximity_radius: radius,
      budget: budget,
      beta: beta,
      gamma: gamma
    };

    const res = await apiPost('/geo/pipeline', payload);
    pipelineResult = res;

    // Show panels
    document.getElementById('geo-playback-section').style.display = 'block';
    document.getElementById('geo-results-section').style.display = 'block';

    drawContactEdges(res.graph.edges, res.graph.nodes);
    updateResultsUI();
    resetPlayback();

    showToast('Geo Analysis Pipeline execution complete.', 'success');
    document.getElementById('geo-map-status').textContent = 'Pipeline complete. Control simulation playback below.';

  } catch (err) {
    showToast(`Pipeline Execution Failed: ${err.message}`, 'error');
    document.getElementById('geo-map-status').textContent = 'Execution failed.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Analysis Pipeline';
  }
}

function drawContactEdges(edges, nodes) {
  edgeGroup.clearLayers();
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  // Brighter slate colors with high visibility on both light and dark backgrounds
  const edgeColor = currentTheme === 'light' ? '#334155' : '#94a3b8';
  const edgeOpacity = currentTheme === 'light' ? 0.65 : 0.55;

  edges.forEach(edge => {
    const n1 = nodes[edge.source];
    const n2 = nodes[edge.target];
    if (n1 && n2) {
      const poly = L.polyline([[n1.lat, n1.lng], [n2.lat, n2.lng]], {
        color: edgeColor,
        weight: Math.max(2.5, Math.min(7.5, edge.weight * 3.5)), // Thicker visible edges
        opacity: edgeOpacity
      });
      edgeGroup.addLayer(poly);
    }
  });
}

function updateResultsUI() {
  const res = pipelineResult;
  if (!res) return;

  // 1. Stats Table
  const statPeakNo = document.getElementById('geo-stat-peak-no');
  const statPeakYes = document.getElementById('geo-stat-peak-yes');
  const statTotalNo = document.getElementById('geo-stat-total-no');
  const statTotalYes = document.getElementById('geo-stat-total-yes');
  const statDurNo = document.getElementById('geo-stat-dur-no');
  const statDurYes = document.getElementById('geo-stat-dur-yes');

  statPeakNo.textContent = res.sim_without.final_stats.peak_infected;
  statPeakYes.textContent = res.sim_with.final_stats.peak_infected;

  statTotalNo.textContent = res.sim_without.final_stats.total_infected;
  statTotalYes.textContent = res.sim_with.final_stats.total_infected;

  statDurNo.textContent = res.sim_without.final_stats.containment_t || '100+';
  statDurYes.textContent = res.sim_with.final_stats.containment_t || '100+';

  // 2. Leaderboard
  const leaderboard = document.getElementById('geo-leaderboard');
  const sortedWards = [...res.graph.nodes]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  leaderboard.innerHTML = sortedWards.map((w, idx) => {
    const isVaccinated = res.intervention.selected_ids.includes(w.id);
    const vaccBadge = isVaccinated ? `<span style="font-size:8px; font-weight:700; background:var(--gold-dim); color:var(--gold); border:1px solid var(--gold); padding:1px 4px; border-radius:3px; white-space:nowrap; flex-shrink:0; line-height:1;">DP Vax</span>` : '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid var(--border-subtle); padding-bottom:4px; gap:8px;">
        <div style="display:flex; align-items:center; gap:4px; overflow:hidden; min-width:0; flex:1;">
          <strong style="white-space:nowrap; flex-shrink:0;">#${idx + 1}</strong>
          <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; font-weight:500;" title="${w.name}">${w.name}</span>
          <span style="font-size:10px; color:var(--text-muted); white-space:nowrap; flex-shrink:0;">(${w.id})</span>
          ${vaccBadge}
        </div>
        <div style="font-family:var(--font-mono); font-size:10px; color:var(--teal); white-space:nowrap; flex-shrink:0;">
          C: ${w.value.toFixed(4)}
        </div>
      </div>
    `;
  }).join('');

  // 3. Render chart
  renderCompareChart();
}

function renderCompareChart() {
  const res = pipelineResult;
  if (!res) return;

  const canvas = document.getElementById('geo-curve-chart');
  if (!canvas) return;

  if (compareChart) {
    compareChart.destroy();
  }

  // Find max length of timeseries
  const stepsNo = res.sim_without.timeseries;
  const stepsYes = res.sim_with.timeseries;
  const labels = stepsNo.map(s => s.t);

  compareChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Infected (No Intervention)',
          data: stepsNo.map(s => s.I),
          borderColor: '#e05c5c',
          backgroundColor: 'rgba(224, 92, 92, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Infected (With DP Vaccination)',
          data: stepsYes.map(s => s.I),
          borderColor: '#5cb87a',
          backgroundColor: 'rgba(92, 184, 122, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 9 }, boxWidth: 10, color: '#8891a4' }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { maxTicksLimit: 8, font: { size: 8 }, color: '#8891a4' },
          title: { display: false }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: true,
          ticks: { font: { size: 8 }, color: '#8891a4' }
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Playback Engine
// ---------------------------------------------------------------------------

function setPlaybackMode(mode) {
  playbackMode = mode;
  updateMapVisuals();
}

function togglePlayback() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  const speed = parseInt(document.getElementById('geo-speed').value, 10);
  isPlaying = true;
  document.getElementById('geo-btn-play').textContent = '⏸';

  const simData = playbackMode === 'without' ? pipelineResult.sim_without : pipelineResult.sim_with;
  const maxSteps = simData.node_states.length;

  playInterval = setInterval(() => {
    if (currentStep >= maxSteps - 1) {
      stopPlayback();
      return;
    }
    currentStep++;
    updateMapVisuals();
  }, speed);
}

function stopPlayback() {
  isPlaying = false;
  document.getElementById('geo-btn-play').textContent = '▶';
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

function stepFwd() {
  stopPlayback();
  const simData = playbackMode === 'without' ? pipelineResult.sim_without : pipelineResult.sim_with;
  if (!simData) return;
  if (currentStep < simData.node_states.length - 1) {
    currentStep++;
    updateMapVisuals();
  }
}

function stepBack() {
  stopPlayback();
  if (currentStep > 0) {
    currentStep--;
    updateMapVisuals();
  }
}

function resetPlayback() {
  stopPlayback();
  currentStep = 0;
  updateMapVisuals();
}

function updateMapVisuals() {
  if (!pipelineResult) return;

  const simData = playbackMode === 'without' ? pipelineResult.sim_without : pipelineResult.sim_with;
  if (!simData || !simData.node_states[currentStep]) return;

  const states = simData.node_states[currentStep].states;
  const vaccinated = pipelineResult.intervention.selected_ids;
  const nodes = pipelineResult.graph.nodes;

  const markers = markerGroup.getLayers();

  nodes.forEach((node, idx) => {
    const marker = markers[idx];
    if (!marker) return;

    const state = states[node.id];
    let color = COLOR_S;

    if (playbackMode === 'with' && vaccinated.includes(node.id)) {
      color = COLOR_V;
    } else {
      if (state === 'I') color = COLOR_I;
      else if (state === 'R') color = COLOR_R;
    }

    // Adjust borders for clarity
    const isSeed = pipelineResult.seed_nodes.includes(node.id);
    const borderColor = isSeed ? '#ffffff' : (color === COLOR_V ? '#ffffff' : 'var(--border)');
    const borderWidth = isSeed ? 3.0 : 1.5;

    marker.setStyle({
      fillColor: color,
      color: borderColor,
      weight: borderWidth
    });

    // Update popup description for interactive click
    const centralityVal = node.value || 0.0;
    const vaccText = vaccinated.includes(node.id) ? '<strong style="color:var(--gold)">DP Vaccinated (Immune)</strong>' : 'None';
    
    marker.getPopup().setContent(`
      <div style="font-family:var(--font-body); font-size:12px; color:var(--text-heading)">
        <strong>${node.name}</strong><br/>
        Population: ${node.population}<br/>
        Centrality: ${centralityVal.toFixed(4)}<br/>
        Intervention: ${vaccText}<br/>
        Current State: <strong style="color:${color}">${state === 'S' ? 'Susceptible' : (state === 'I' ? 'Infected' : 'Recovered')}</strong>
      </div>
    `);
  });

  // Update Frame Counter Text
  document.getElementById('geo-frame-counter').textContent = `Step ${currentStep} / ${simData.node_states.length - 1}`;
}
