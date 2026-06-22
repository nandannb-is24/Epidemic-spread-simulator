/**
 * intervention.js — Intervention Optimizer Lab.
 *
 * Runs 0/1 Knapsack DP and Greedy side-by-side.
 * Animates the DP table cell-by-cell (heatmap) and shows a comparison chart.
 */

import { AppState, apiPost, showToast } from '../app.js';
import {
  createInterventionCompareChart,
  updateInterventionCompareChart,
} from '../charts.js';

let compareChart = null;
let dpFrames = [];
let ivCurrentFrame = 0;
let ivPlaying = false;
let ivTimer = null;

let dpResult    = null;
let greedyResult = null;

let dpTableData  = null;  // [N+1][W+1] floats
let dpTableNodes = null;  // ordered node list used for labels

export function initIntervention() {
  compareChart = createInterventionCompareChart('intervention-compare-chart');

  // ---- Budget slider ----
  const budgetEl = document.getElementById('iv-budget');
  budgetEl.addEventListener('input', () => {
    document.getElementById('iv-budget-val').textContent = budgetEl.value;
  });

  // ---- Run button ----
  document.getElementById('iv-run-btn').addEventListener('click', runIntervention);

  // ---- Playback ----
  document.getElementById('iv-btn-play').addEventListener('click',  ivTogglePlay);
  document.getElementById('iv-btn-fwd').addEventListener('click',   ivStepFwd);
  document.getElementById('iv-btn-back').addEventListener('click',  ivStepBack);
  document.getElementById('iv-btn-reset').addEventListener('click', ivReset);

  const speedEl = document.getElementById('iv-speed');
  speedEl.addEventListener('input', () => {
    document.getElementById('iv-speed-val').textContent = `${speedEl.value}ms`;
    if (ivPlaying) { ivStop(); ivStart(); }
  });
}

// ---------------------------------------------------------------------------
// Run both strategies
// ---------------------------------------------------------------------------
async function runIntervention() {
  if (!AppState.graph) { showToast('Generate a graph first.', 'error'); return; }
  if (!AppState.centralityScores) {
    showToast('Run Brandes first (Centrality Lab) to get scores for node values.', 'error');
    return;
  }

  ivReset();

  const budget = parseInt(document.getElementById('iv-budget').value);
  const btn = document.getElementById('iv-run-btn');
  btn.disabled = true; btn.textContent = 'Running...';

  // Build node list: cost from graph, value from centrality
  const nodes = AppState.graph.nodes.map(n => ({
    id:    n.id,
    cost:  n.cost ?? 2,
    value: AppState.centralityScores[n.id] ?? 0,
  }));
  dpTableNodes = nodes;

  try {
    [dpResult, greedyResult] = await Promise.all([
      apiPost('/algorithms/knapsack-intervention', { nodes, budget }),
      apiPost('/algorithms/greedy-intervention',   { nodes, budget }),
    ]);

    dpFrames = dpResult.frames;
    dpTableData = dpResult.dp_table;
    ivCurrentFrame = 0;

    // Render greedy immediately (no animation needed — it's just a list)
    renderGreedyList(greedyResult);

    // Build DP table skeleton
    buildDPTableSkeleton(nodes, budget);

    // Update comparison chart
    updateInterventionCompareChart(compareChart, dpResult, greedyResult);

    // Update stat cards
    document.getElementById('dp-total-value').textContent   = dpResult.total_value.toFixed(4);
    document.getElementById('dp-total-cost').textContent    = dpResult.total_cost;
    document.getElementById('greedy-total-value').textContent = greedyResult.total_value.toFixed(4);
    document.getElementById('greedy-total-cost').textContent  = greedyResult.total_cost;

    document.getElementById('dp-selected-nodes').textContent =
      dpResult.selected_ids.length ? dpResult.selected_ids.map(id => `N${id}`).join(', ') : 'None';
    document.getElementById('greedy-selected-nodes').textContent =
      greedyResult.selected_ids.length ? greedyResult.selected_ids.map(id => `N${id}`).join(', ') : 'None';

    updateIvCounter();
    ivStart();
    showToast('Both strategies complete!', 'success', 2000);
  } catch (e) {
    showToast(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '▶ Run Both Strategies';
  }
}

// ---------------------------------------------------------------------------
// DP Table rendering
// ---------------------------------------------------------------------------
function buildDPTableSkeleton(nodes, budget) {
  const container = document.getElementById('dp-table-container');
  const W = budget;
  const N = nodes.length;

  // Cap display size to avoid browser slowdown
  const maxCols = Math.min(W, 30);
  const maxRows = Math.min(N, 20);

  let html = '<table class="dp-table"><thead><tr><th>Item \\ W</th>';
  for (let w = 0; w <= maxCols; w++) html += `<th>${w}</th>`;
  html += '</tr></thead><tbody>';

  for (let i = 0; i <= maxRows; i++) {
    const label = i === 0 ? '—' : `N${nodes[i-1].id}($${nodes[i-1].cost})`;
    html += `<tr><th>${label}</th>`;
    for (let w = 0; w <= maxCols; w++) {
      html += `<td id="dp-cell-${i}-${w}">0</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function applyDPFrame(frame) {
  if (!frame) return;
  const r = frame.row, c = frame.col;

  // Only animate cells within our capped display range
  if (r == null || c == null) return;

  const cell = document.getElementById(`dp-cell-${r}-${c}`);
  if (!cell) return;

  if (frame.action === 'backtrack' || (frame.action === 'fill' && frame.item_action === 'take' &&
      dpResult?.selected_ids?.includes(frame.node_id))) {
    cell.className = 'dp-selected';
  } else if (frame.action === 'fill' && frame.item_action === 'take') {
    cell.className = 'dp-active';
  } else if (frame.action === 'fill') {
    cell.className = '';
  }

  if (frame.value != null) cell.textContent = frame.value.toFixed(2);
}

// ---------------------------------------------------------------------------
// Greedy ranked list
// ---------------------------------------------------------------------------
function renderGreedyList(result) {
  const el = document.getElementById('greedy-ranked-list');
  el.innerHTML = result.ranked_nodes.map((n, i) => `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 8px;
                border-radius:4px;border:1px solid var(--border-subtle);
                background:${n.selected ? 'rgba(251,146,60,0.1)' : 'var(--bg-elevated)'};
                border-color:${n.selected ? 'var(--orange)' : 'var(--border-subtle)'}">
      <span style="font-size:10px;color:var(--text-muted);width:18px">${i+1}</span>
      <span style="flex:1;font-size:12px">Node ${n.id}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--orange)">σ=${n.value.toFixed(4)}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">$${n.cost}</span>
      ${n.selected
        ? '<span style="color:var(--orange);font-size:10px">✓</span>'
        : '<span style="color:var(--text-muted);font-size:10px">✗</span>'}
    </div>
  `).join('');
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------
function ivStepFwd() {
  if (ivCurrentFrame >= dpFrames.length) return;
  applyDPFrame(dpFrames[ivCurrentFrame]);
  ivCurrentFrame++;
  updateIvCounter();
}

function ivStepBack() {
  if (ivCurrentFrame <= 0) return;
  ivCurrentFrame--;
  // Re-apply all frames up to current (table cells accumulate)
  buildDPTableSkeleton(dpTableNodes,
    parseInt(document.getElementById('iv-budget').value));
  for (let i = 0; i < ivCurrentFrame; i++) applyDPFrame(dpFrames[i]);
  updateIvCounter();
}

function ivStart() {
  ivPlaying = true;
  document.getElementById('iv-btn-play').textContent = '⏸';
  ivTimer = setInterval(() => {
    if (ivCurrentFrame >= dpFrames.length) { ivStop(); return; }
    ivStepFwd();
  }, parseInt(document.getElementById('iv-speed').value));
}

function ivStop() {
  ivPlaying = false;
  document.getElementById('iv-btn-play').textContent = '▶';
  clearInterval(ivTimer);
}

function ivTogglePlay() {
  if (!dpFrames.length) { runIntervention(); return; }
  ivPlaying ? ivStop() : ivStart();
}

function ivReset() {
  ivStop();
  ivCurrentFrame = 0; dpFrames = [];
  document.getElementById('dp-table-container').innerHTML =
    '<div class="text-sm text-muted">Run to see DP table…</div>';
  updateIvCounter();
}

function updateIvCounter() {
  document.getElementById('iv-frame-counter').textContent =
    `Frame ${ivCurrentFrame} / ${dpFrames.length}`;
}
