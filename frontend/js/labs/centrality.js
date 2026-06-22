/**
 * centrality.js — Brandes' Betweenness Centrality Lab (centerpiece).
 *
 * Visualization phases:
 *  1. Phase "bfs_visit"   — BFS frontier expands from source; heat-gradient
 *                           node coloring by BFS level; live σ[v] labels.
 *  2. Phase "bfs_done"    — Source BFS complete, flash.
 *  3. Phase "back_prop"   — Dependency δ flows backward; edge pulse;
 *                           running centrality bar chart updates.
 *  4. Phase "source_done" — All of this source's contribution finalized.
 *
 * Controls: Play / Pause / Step-forward / Step-back / Speed / Reset
 * Toggle:   Single-source detail view vs. Full algorithm run
 */

import { AppState, apiPost, showToast } from '../app.js';
import { Graph } from '../graph.js';
import {
  createCentralityBarChart,
  updateCentralityChart,
} from '../charts.js';

// ---- BFS-level color gradient (blue-green → orange → red) ----
const LEVEL_COLORS = [
  '#3db8a0', // 0 — source: teal
  '#4ac4b0', // 1
  '#5b8fd9', // 2
  '#8b7ec8', // 3
  '#c77dba', // 4
  '#d4945a', // 5
  '#e05c5c', // 6+
];
function levelColor(lv) { return LEVEL_COLORS[Math.min(lv, LEVEL_COLORS.length - 1)]; }

const GOLD   = '#c9a24e';
const TEAL   = '#3db8a0';
const DIM    = '#2a3441';
const SOURCE = '#ebeef5';

// ---------------------------------------------------------------------------
let graph = null;           // Graph instance
let chart = null;           // Centrality bar chart
let frames = [];
let currentFrame = 0;
let playing = false;
let playTimer = null;
let result = null;          // Full API response
let mode = 'single';        // 'single' | 'full'

export function initCentrality() {
  graph = new Graph('centrality-svg', { showWeights: false });

  chart = createCentralityBarChart('centrality-bar-chart');

  // ---- Mode toggle ----
  document.getElementById('centrality-mode-single').addEventListener('click', () => setMode('single'));
  document.getElementById('centrality-mode-full').addEventListener('click',   () => setMode('full'));

  // ---- Playback controls ----
  document.getElementById('c-btn-play').addEventListener('click',  togglePlay);
  document.getElementById('c-btn-fwd').addEventListener('click',   stepForward);
  document.getElementById('c-btn-back').addEventListener('click',  stepBack);
  document.getElementById('c-btn-reset').addEventListener('click', resetPlayback);

  // ---- Speed slider ----
  const speedEl = document.getElementById('c-speed');
  speedEl.addEventListener('input', () => {
    document.getElementById('c-speed-val').textContent = `${speedEl.value}ms`;
    if (playing) { stopPlay(); startPlay(); }
  });

  // ---- Run button ----
  document.getElementById('c-run-btn').addEventListener('click', runBrandes);

  // ---- Source selector ----
  populateSourceSelect();

  // Render graph
  if (AppState.graph) {
    graph.render(AppState.graph);
    populateSourceSelect();
  }
}

function setMode(m) {
  mode = m;
  document.getElementById('centrality-mode-single').classList.toggle('active', m === 'single');
  document.getElementById('centrality-mode-full').classList.toggle('active', m === 'full');
  document.getElementById('centrality-source-row').style.display = m === 'single' ? '' : 'none';
}

function populateSourceSelect() {
  const sel = document.getElementById('centrality-source-select');
  sel.innerHTML = '';
  if (!AppState.graph) return;
  AppState.graph.nodes.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.id;
    opt.textContent = `Node ${n.id}`;
    sel.appendChild(opt);
  });
}

// ---------------------------------------------------------------------------
// Run Brandes
// ---------------------------------------------------------------------------
async function runBrandes() {
  if (!AppState.graph) { showToast('Generate a graph first.', 'error'); return; }

  resetPlayback();

  const btn = document.getElementById('c-run-btn');
  btn.disabled = true;
  btn.textContent = 'Computing...';

  try {
    result = await apiPost('/algorithms/brandes', { adj: AppState.graph.adj });

    // Store scores globally for other labs
    AppState.centralityScores = result.final_scores;

    // Filter frames by mode
    if (mode === 'single') {
      const sourceId = parseInt(document.getElementById('centrality-source-select').value);
      frames = result.frames.filter(f => f.source === sourceId);
    } else {
      frames = result.frames;
    }

    currentFrame = 0;
    graph.render(AppState.graph);
    graph.resetColors();
    updateFrameCounter();
    updateLeaderboard(result.final_scores, 5);
    document.getElementById('c-complexity-note').textContent = result.complexity_note;

    showToast(`Brandes done — ${result.frames.length} frames total`, 'success', 2000);

    // Auto-play
    startPlay();
  } catch (e) {
    showToast(`Brandes error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Run Brandes';
  }
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------
function startPlay() {
  playing = true;
  document.getElementById('c-btn-play').textContent = '⏸';
  playTimer = setInterval(() => {
    if (currentFrame >= frames.length - 1) { stopPlay(); return; }
    stepForward();
  }, parseInt(document.getElementById('c-speed').value));
}

function stopPlay() {
  playing = false;
  document.getElementById('c-btn-play').textContent = '▶';
  clearInterval(playTimer);
}

function togglePlay() {
  if (!frames.length) { runBrandes(); return; }
  playing ? stopPlay() : startPlay();
}

function stepForward() {
  if (currentFrame >= frames.length) return;
  applyFrame(frames[currentFrame]);
  currentFrame++;
  updateFrameCounter();
}

function stepBack() {
  if (currentFrame <= 0) return;
  currentFrame--;
  // Re-apply all frames from 0 to get correct visual state
  graph.render(AppState.graph);
  graph.resetColors();
  for (let i = 0; i < currentFrame; i++) applyFrame(frames[i]);
  updateFrameCounter();
}

function resetPlayback() {
  stopPlay();
  currentFrame = 0;
  frames = [];
  if (AppState.graph) { graph.render(AppState.graph); graph.resetColors(); }
  updateFrameCounter();
  document.getElementById('centrality-phase-label').textContent = '';
  if (chart) updateCentralityChart(chart, {});
  document.getElementById('centrality-leaderboard').innerHTML =
    '<div class="text-sm text-muted">Run Brandes to see rankings…</div>';
}

function updateFrameCounter() {
  document.getElementById('c-frame-counter').textContent =
    `Frame ${currentFrame} / ${frames.length}`;
}

// ---------------------------------------------------------------------------
// Frame application — the core animation logic
// ---------------------------------------------------------------------------
function applyFrame(frame) {
  if (!frame) return;
  const phaseLabel = document.getElementById('centrality-phase-label');

  switch (frame.phase) {
    case 'bfs_visit': {
      phaseLabel.textContent = `BFS from Node ${frame.source} — visiting Node ${frame.node} (level ${frame.level})`;

      // Color source white, visited nodes by level
      graph.setNodeColor(frame.source, SOURCE);
      graph.setNodeColor(frame.node, levelColor(frame.level));
      graph.setNodeGlow(frame.node, levelColor(frame.level));

      // Show σ label
      const sigmaVal = frame.sigma[frame.node];
      graph.setNodeValueLabel(frame.node, `σ=${sigmaVal}`);

      // Highlight predecessor edges
      const preds = frame.predecessors[String(frame.node)] || [];
      preds.forEach(p => graph.setEdgeStyle(p, frame.node, 'highlighted'));

      break;
    }

    case 'bfs_done': {
      phaseLabel.textContent = `BFS from Node ${frame.source} complete — starting backward pass`;
      // Flash source node
      graph.setNodeColor(frame.source, GOLD);
      graph.setNodeGlow(frame.source, GOLD);
      break;
    }

    case 'back_prop': {
      phaseLabel.textContent =
        `Back-prop from Node ${frame.source}: δ[${frame.predecessor}] += ${frame.contribution.toFixed(4)}`;

      // Highlight the dependency edge
      graph.setEdgeStyle(frame.predecessor, frame.node, 'dependency');
      graph.setNodeGlow(frame.predecessor, GOLD);

      // Update δ label
      const dv = frame.delta[frame.predecessor];
      graph.setNodeValueLabel(frame.predecessor, `δ=${dv.toFixed(2)}`);

      // Update live bar chart
      if (chart) {
        const topK = getTopK(frame.running_scores, 5);
        updateCentralityChart(chart, frame.running_scores, topK);
      }
      break;
    }

    case 'source_done': {
      phaseLabel.textContent =
        `Node ${frame.source} contribution complete — running scores updated`;

      const topK = getTopK(frame.running_scores, 5);
      if (chart) updateCentralityChart(chart, frame.running_scores, topK);

      // Apply heat color by centrality so far
      Object.entries(frame.running_scores).forEach(([id, score]) => {
        const maxScore = Math.max(...Object.values(frame.running_scores)) || 1;
        const intensity = score / maxScore;
        const color = interpolateColor('#2a3441', GOLD, intensity);
        graph.setNodeColor(Number(id), color);
      });

      // Highlight top-k with glow
      topK.forEach(id => graph.setNodeGlow(id, GOLD));

      if (result) updateLeaderboard(frame.running_scores, 5);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
function updateLeaderboard(scores, topK = 5) {
  const el = document.getElementById('centrality-leaderboard');
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);

  el.innerHTML = sorted.map(([id, score], i) => `
    <div class="leaderboard-item ${i < 3 ? 'top' : ''}">
      <span class="rank">${i + 1}</span>
      <span class="node-label">Node ${id}</span>
      <span class="score">${score.toFixed(4)}</span>
    </div>
  `).join('');
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function getTopK(scores, k) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => Number(id));
}

function interpolateColor(hex1, hex2, t) {
  const c1 = hexToRgb(hex1), c2 = hexToRgb(hex2);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return { r, g, b };
}
