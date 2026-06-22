/**
 * simulation.js — SIR Epidemic Simulation Lab.
 *
 * Animates node-state changes (S=green, I=red, R=blue) on the D3 graph,
 * draws a live epidemic curve, and shows a before/after comparison panel.
 */

import { AppState, apiPost, showToast } from '../app.js';
import { Graph } from '../graph.js';
import { createSIRChart, updateSIRChart } from '../charts.js';

const COLOR_S = '#5cb87a';   // green — susceptible
const COLOR_I = '#e05c5c';   // red   — infected
const COLOR_R = '#5b8fd9';   // blue  — recovered
const COLOR_V = '#c9a24e';   // gold  — vaccinated (pre-immune)

function stateColor(s) {
  if (s === 'I') return COLOR_I;
  if (s === 'R') return COLOR_R;
  return COLOR_S;
}

// ---------------------------------------------------------------------------
let simGraph = null;
let sirChart  = null;

let simFrames = [];
let simCurrentFrame = 0;
let simPlaying = false;
let simTimer = null;

let resultNoIv = null;    // SIR result without intervention
let resultIv   = null;    // SIR result with DP intervention

export function initSimulation() {
  simGraph = new Graph('sim-svg', { interactive: true });
  sirChart  = createSIRChart('sir-curve-chart');

  // ---- Sliders ----
  bindSlider('sim-beta',  'sim-beta-val',  v => parseFloat(v).toFixed(2));
  bindSlider('sim-gamma', 'sim-gamma-val', v => parseFloat(v).toFixed(2));
  bindSlider('sim-speed', 'sim-speed-val', v => `${v}ms`);

  // ---- Seed select ----
  populateSeedSelect();

  // ---- Run buttons ----
  document.getElementById('sim-run-btn').addEventListener('click', () => runSIM(false));
  document.getElementById('sim-run-iv-btn').addEventListener('click', () => runSIM(true));

  // ---- Playback ----
  document.getElementById('sim-btn-play').addEventListener('click',  simTogglePlay);
  document.getElementById('sim-btn-fwd').addEventListener('click',   simStepFwd);
  document.getElementById('sim-btn-back').addEventListener('click',  simStepBack);
  document.getElementById('sim-btn-reset').addEventListener('click', simReset);

  const speedEl = document.getElementById('sim-speed');
  speedEl.addEventListener('input', () => {
    if (simPlaying) { simStop(); simStart(); }
  });

  if (AppState.graph) {
    simGraph.render(AppState.graph);
    populateSeedSelect();
  }
}

function populateSeedSelect() {
  const sel = document.getElementById('sim-seed-select');
  if (!AppState.graph) return;
  sel.innerHTML = AppState.graph.nodes
    .map(n => `<option value="${n.id}">Node ${n.id}</option>`)
    .join('');
}

// ---------------------------------------------------------------------------
// Run SIR
// ---------------------------------------------------------------------------
async function runSIM(withIntervention) {
  if (!AppState.graph) { showToast('Generate a graph first.', 'error'); return; }
  if (withIntervention && !AppState.dpSelectedNodes?.length) {
    if (!AppState.centralityScores) {
      showToast('Run Brandes + Intervention labs first to get vaccinated node list.', 'error');
      return;
    }
    // Fallback: use top-3 central nodes as vaccinated
    AppState.dpSelectedNodes = Object.entries(AppState.centralityScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => Number(id));
  }

  simReset();
  const label = document.getElementById('sim-status-label');
  label.textContent = withIntervention ? 'Running with DP vaccination...' : 'Running without intervention...';

  const btn = withIntervention
    ? document.getElementById('sim-run-iv-btn')
    : document.getElementById('sim-run-btn');
  btn.disabled = true;

  try {
    const body = {
      adj:              AppState.graph.adj,
      beta:             parseFloat(document.getElementById('sim-beta').value),
      gamma:            parseFloat(document.getElementById('sim-gamma').value),
      seed_nodes:       [parseInt(document.getElementById('sim-seed-select').value)],
      vaccinated_nodes: withIntervention ? AppState.dpSelectedNodes : null,
      max_steps:        100,
      rng_seed:         42,
    };

    const result = await apiPost('/simulate/sir', body);

    if (withIntervention) {
      resultIv = result;
    } else {
      resultNoIv = result;
    }

    // Build simFrames from node_states
    simFrames = result.node_states;
    simCurrentFrame = 0;

    // Mark vaccinated nodes gold
    if (withIntervention && AppState.dpSelectedNodes?.length) {
      simGraph.render(AppState.graph);
      AppState.dpSelectedNodes.forEach(id => {
        simGraph.setNodeColor(id, COLOR_V);
        simGraph.setNodeGlow(id, COLOR_V);
      });
    } else {
      simGraph.render(AppState.graph);
    }

    updateSIRChart(sirChart, result.timeseries, 0);
    updateComparePanel();
    updateSimCounter();
    label.textContent = withIntervention
      ? `Vaccinated: ${AppState.dpSelectedNodes?.join(', ')}`
      : 'Running without intervention';
    simStart();
  } catch (e) {
    showToast(`SIR error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Frame application
// ---------------------------------------------------------------------------
function applySimFrame(frame) {
  if (!frame) return;
  const colorMap = {};
  Object.entries(frame.states).forEach(([id, state]) => {
    // Don't overwrite vaccinated-gold nodes
    if (state === 'R' && AppState.dpSelectedNodes?.includes(Number(id))) {
      colorMap[Number(id)] = COLOR_V;
    } else {
      colorMap[Number(id)] = stateColor(state);
    }
  });
  simGraph.setAllNodeColors(colorMap);
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------
function simStepFwd() {
  if (simCurrentFrame >= simFrames.length) return;
  const frame = simFrames[simCurrentFrame];
  applySimFrame(frame);

  // Update epidemic curve
  const tIdx = simCurrentFrame;
  const timeseries = resultNoIv?.timeseries ?? resultIv?.timeseries ?? [];
  updateSIRChart(sirChart, timeseries, tIdx);

  simCurrentFrame++;
  updateSimCounter();
}

function simStepBack() {
  if (simCurrentFrame <= 0) return;
  simCurrentFrame--;
  simGraph.render(AppState.graph); simGraph.resetColors();
  for (let i = 0; i <= simCurrentFrame; i++) {
    if (simFrames[i]) applySimFrame(simFrames[i]);
  }
  updateSimCounter();
}

function simStart() {
  simPlaying = true;
  document.getElementById('sim-btn-play').textContent = '⏸';
  simTimer = setInterval(() => {
    if (simCurrentFrame >= simFrames.length) { simStop(); return; }
    simStepFwd();
  }, parseInt(document.getElementById('sim-speed').value));
}

function simStop() {
  simPlaying = false;
  document.getElementById('sim-btn-play').textContent = '▶';
  clearInterval(simTimer);
}

function simTogglePlay() {
  if (!simFrames.length) { runSIM(false); return; }
  simPlaying ? simStop() : simStart();
}

function simReset() {
  simStop();
  simCurrentFrame = 0; simFrames = [];
  if (AppState.graph) { simGraph.render(AppState.graph); simGraph.resetColors(); }
  updateSimCounter();
}

function updateSimCounter() {
  document.getElementById('sim-frame-counter').textContent =
    `Step ${simCurrentFrame} / ${simFrames.length}`;
}

// ---------------------------------------------------------------------------
// Before / After comparison panel
// ---------------------------------------------------------------------------
function updateComparePanel() {
  const el = document.getElementById('sim-compare-panel');
  if (!resultNoIv && !resultIv) return;

  const a = resultNoIv?.final_stats;
  const b = resultIv?.final_stats;

  if (!a && !b) return;

  const row = (label, aVal, bVal) => {
    const better = bVal != null && aVal != null && bVal < aVal;
    return `
      <tr>
        <td style="padding:4px 8px;color:var(--text-secondary)">${label}</td>
        <td style="padding:4px 8px;text-align:center;font-family:var(--font-mono);color:var(--red)">
          ${aVal != null ? aVal : '—'}
        </td>
        <td style="padding:4px 8px;text-align:center;font-family:var(--font-mono);
                   color:${better ? 'var(--teal)' : 'var(--text-primary)'}">
          ${bVal != null ? bVal : '—'} ${better ? '✓' : ''}
        </td>
      </tr>
    `;
  };

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr>
          <th style="padding:4px 8px;text-align:left;color:var(--text-muted);font-size:10px">Metric</th>
          <th style="padding:4px 8px;text-align:center;color:var(--red);font-size:10px">No Intervention</th>
          <th style="padding:4px 8px;text-align:center;color:var(--teal);font-size:10px">With Vaccination</th>
        </tr>
      </thead>
      <tbody>
        ${row('Peak Infected',    a?.peak_infected,   b?.peak_infected)}
        ${row('Peak at timestep', a?.peak_infected_t, b?.peak_infected_t)}
        ${row('Total Infected',   a?.total_infected,  b?.total_infected)}
        ${row('Containment at t', a?.containment_t ?? '—', b?.containment_t ?? '—')}
        ${row('Never Infected',   a?.never_infected,  b?.never_infected)}
      </tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function bindSlider(sliderId, displayId, fmt) {
  const slider  = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (!slider || !display) return;
  display.textContent = fmt(slider.value);
  slider.addEventListener('input', () => {
    display.textContent = fmt(slider.value);
  });
}
