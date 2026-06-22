/**
 * pathfinding.js — BFS/DFS + Dijkstra Lab.
 *
 * Sub-tabs:
 *  1. BFS vs DFS — side-by-side graphs, same source, same speed
 *  2. Dijkstra   — single graph, source+target, priority queue display
 */

import { AppState, apiPost, showToast } from '../app.js';
import { Graph } from '../graph.js';

// --- Color constants ---
const VISITED_BFS  = '#3db8a0';   // teal (BFS)
const VISITED_DFS  = '#8b7ec8';   // purple (DFS)
const SOURCE_COLOR = '#ebeef5';
const PATH_COLOR   = '#5b8fd9';
const SETTLED      = '#1a3050';
const FRONTIER_BFS = '#d4945a';
const FRONTIER_DFS = '#c77dba';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let bfsGraph = null, dfsGraph = null, dijkGraph = null;

let bfsFrames = [], dfsFrames = [];
let dijkFrames = [];
let pfCurrentFrame = 0;
let pfPlaying = false;
let pfTimer = null;

let dijkCurrentFrame = 0;
let dijkPlaying = false;
let dijkTimer = null;

let pfResult = null;
let dijkResult = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export function initPathfinding() {
  bfsGraph  = new Graph('bfs-svg',  { interactive: true });
  dfsGraph  = new Graph('dfs-svg',  { interactive: true });
  dijkGraph = new Graph('dijkstra-svg', { showWeights: true });

  // ---- Sub-tab switching ----
  document.getElementById('pf-tab-bfsdfs').addEventListener('click', () => {
    switchSubTab('bfsdfs');
  });
  document.getElementById('pf-tab-dijkstra').addEventListener('click', () => {
    switchSubTab('dijkstra');
  });

  // ---- Populate selects ----
  populateAllSelects();

  // ---- BFS/DFS controls ----
  document.getElementById('pf-run-btn').addEventListener('click',   runBFSDFS);
  document.getElementById('pf-btn-play').addEventListener('click',  () => pfTogglePlay());
  document.getElementById('pf-btn-fwd').addEventListener('click',   () => pfStepFwd());
  document.getElementById('pf-btn-back').addEventListener('click',  () => pfStepBack());
  document.getElementById('pf-btn-reset').addEventListener('click', () => pfReset());

  const pfSpeed = document.getElementById('pf-speed');
  pfSpeed.addEventListener('input', () => {
    document.getElementById('pf-speed-val').textContent = `${pfSpeed.value}ms`;
    if (pfPlaying) { pfStop(); pfStart(); }
  });

  // ---- Dijkstra controls ----
  document.getElementById('dijk-run-btn').addEventListener('click',   runDijkstra);
  document.getElementById('dijk-btn-play').addEventListener('click',  () => dijkTogglePlay());
  document.getElementById('dijk-btn-fwd').addEventListener('click',   () => dijkStepFwd());
  document.getElementById('dijk-btn-back').addEventListener('click',  () => dijkStepBack());
  document.getElementById('dijk-btn-reset').addEventListener('click', () => dijkReset());

  const dijkSpeed = document.getElementById('dijk-speed');
  dijkSpeed.addEventListener('input', () => {
    document.getElementById('dijk-speed-val').textContent = `${dijkSpeed.value}ms`;
    if (dijkPlaying) { dijkStop(); dijkStart(); }
  });

  // Initial render
  if (AppState.graph) {
    bfsGraph.render(AppState.graph);
    dfsGraph.render(AppState.graph);
    dijkGraph.render(AppState.graph);
    populateAllSelects();
  }
}

function switchSubTab(tab) {
  document.getElementById('pf-tab-bfsdfs').classList.toggle('active', tab === 'bfsdfs');
  document.getElementById('pf-tab-dijkstra').classList.toggle('active', tab === 'dijkstra');
  document.getElementById('pf-bfsdfs-panel').style.display    = tab === 'bfsdfs'   ? 'flex' : 'none';
  document.getElementById('pf-dijkstra-panel').style.display  = tab === 'dijkstra' ? 'flex' : 'none';
  document.getElementById('pf-complexity-badge').textContent  =
    tab === 'bfsdfs' ? 'O(V+E)' : 'O((V+E) log V)';
}

function populateAllSelects() {
  if (!AppState.graph) return;
  const ids = AppState.graph.nodes.map(n => n.id);

  ['pf-source-select', 'dijk-source-select', 'dijk-target-select'].forEach(selId => {
    const sel = document.getElementById(selId);
    sel.innerHTML = ids.map(id => `<option value="${id}">Node ${id}</option>`).join('');
  });
  // Default target = last node
  document.getElementById('dijk-target-select').value = ids[ids.length - 1];
}

// ---------------------------------------------------------------------------
// BFS / DFS
// ---------------------------------------------------------------------------
async function runBFSDFS() {
  if (!AppState.graph) { showToast('Generate a graph first.', 'error'); return; }

  pfReset();
  const source = parseInt(document.getElementById('pf-source-select').value);
  const btn = document.getElementById('pf-run-btn');
  btn.disabled = true; btn.textContent = 'Running...';

  try {
    const [bfsRes, dfsRes] = await Promise.all([
      apiPost('/algorithms/bfs', { adj: AppState.graph.adj, source }),
      apiPost('/algorithms/dfs', { adj: AppState.graph.adj, source }),
    ]);
    pfResult = { bfs: bfsRes, dfs: dfsRes };
    bfsFrames = bfsRes.frames;
    dfsFrames = dfsRes.frames;
    pfCurrentFrame = 0;

    bfsGraph.render(AppState.graph);
    dfsGraph.render(AppState.graph);
    updatePfCounter();
    pfStart();
  } catch (e) {
    showToast(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '▶ Run BFS & DFS';
  }
}

function applyBFSFrame(frame) {
  if (!frame) return;
  const isSource = frame.node === parseInt(document.getElementById('pf-source-select').value);

  switch (frame.phase) {
    case 'enqueue':
      bfsGraph.setNodeColor(frame.node, isSource ? SOURCE_COLOR : FRONTIER_BFS);
      break;
    case 'dequeue':
      bfsGraph.setNodeColor(frame.node, isSource ? SOURCE_COLOR : VISITED_BFS);
      bfsGraph.setNodeValueLabel(frame.node, `L${frame.level}`);
      if (frame.parent != null) bfsGraph.setEdgeStyle(frame.parent, frame.node, 'highlighted');
      break;
    case 'done':
      document.getElementById('bfs-visit-order').textContent = frame.visit_order.join(' → ');
      break;
  }
}

function applyDFSFrame(frame) {
  if (!frame) return;
  switch (frame.phase) {
    case 'push':
      dfsGraph.setNodeColor(frame.node, FRONTIER_DFS);
      break;
    case 'pop':
      dfsGraph.setNodeColor(frame.node, VISITED_DFS);
      if (frame.parent != null) dfsGraph.setEdgeStyle(frame.parent, frame.node, 'highlighted');
      break;
    case 'done':
      document.getElementById('dfs-visit-order').textContent = frame.visit_order.join(' → ');
      break;
  }
}

function pfStepFwd() {
  const maxFrame = Math.max(bfsFrames.length, dfsFrames.length);
  if (pfCurrentFrame >= maxFrame) return;

  if (bfsFrames[pfCurrentFrame]) applyBFSFrame(bfsFrames[pfCurrentFrame]);
  if (dfsFrames[pfCurrentFrame]) applyDFSFrame(dfsFrames[pfCurrentFrame]);

  pfCurrentFrame++;
  updatePfCounter();
}

function pfStepBack() {
  if (pfCurrentFrame <= 0) return;
  pfCurrentFrame--;
  bfsGraph.render(AppState.graph); bfsGraph.resetColors();
  dfsGraph.render(AppState.graph); dfsGraph.resetColors();
  for (let i = 0; i < pfCurrentFrame; i++) {
    if (bfsFrames[i]) applyBFSFrame(bfsFrames[i]);
    if (dfsFrames[i]) applyDFSFrame(dfsFrames[i]);
  }
  updatePfCounter();
}

function pfStart() {
  pfPlaying = true;
  document.getElementById('pf-btn-play').textContent = '⏸';
  pfTimer = setInterval(() => {
    const maxFrame = Math.max(bfsFrames.length, dfsFrames.length);
    if (pfCurrentFrame >= maxFrame) { pfStop(); return; }
    pfStepFwd();
  }, parseInt(document.getElementById('pf-speed').value));
}

function pfStop() {
  pfPlaying = false;
  document.getElementById('pf-btn-play').textContent = '▶';
  clearInterval(pfTimer);
}

function pfTogglePlay() {
  if (!bfsFrames.length) { runBFSDFS(); return; }
  pfPlaying ? pfStop() : pfStart();
}

function pfReset() {
  pfStop();
  pfCurrentFrame = 0; bfsFrames = []; dfsFrames = [];
  if (AppState.graph) {
    bfsGraph.render(AppState.graph); bfsGraph.resetColors();
    dfsGraph.render(AppState.graph); dfsGraph.resetColors();
  }
  updatePfCounter();
  document.getElementById('bfs-visit-order').textContent = '—';
  document.getElementById('dfs-visit-order').textContent = '—';
}

function updatePfCounter() {
  const maxFrame = Math.max(bfsFrames.length, dfsFrames.length, 0);
  document.getElementById('pf-frame-counter').textContent =
    `Frame ${pfCurrentFrame} / ${maxFrame}`;
}

// ---------------------------------------------------------------------------
// Dijkstra
// ---------------------------------------------------------------------------
async function runDijkstra() {
  if (!AppState.graph) { showToast('Generate a graph first.', 'error'); return; }

  dijkReset();
  const source = parseInt(document.getElementById('dijk-source-select').value);
  const target = parseInt(document.getElementById('dijk-target-select').value);
  const btn = document.getElementById('dijk-run-btn');
  btn.disabled = true; btn.textContent = 'Running...';

  try {
    dijkResult = await apiPost('/algorithms/dijkstra',
      { adj: AppState.graph.adj, source, target });
    dijkFrames = dijkResult.frames;
    dijkCurrentFrame = 0;
    dijkGraph.render(AppState.graph);
    updateDijkCounter();

    if (dijkResult.path) {
      document.getElementById('dijk-path-display').textContent =
        dijkResult.path.join(' → ');
      const dist = dijkResult.distances[target];
      document.getElementById('dijk-dist-display').textContent =
        dist != null ? `Total distance: ${dist}` : 'No path found';
    } else {
      document.getElementById('dijk-path-display').textContent = 'No path found';
    }

    dijkStart();
  } catch (e) {
    showToast(`Dijkstra error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '▶ Run Dijkstra';
  }
}

function applyDijkFrame(frame) {
  if (!frame) return;

  switch (frame.phase) {
    case 'relax': {
      dijkGraph.setEdgeStyle(frame.relaxed_edge.from, frame.relaxed_edge.to, 'highlighted');
      dijkGraph.setNodeColor(frame.node, '#3db8a0');
      const d = frame.dist;
      dijkGraph.setNodeValueLabel(frame.node, d != null ? `d=${d}` : '∞');
      updateHeapDisplay(frame.heap_snapshot);
      break;
    }
    case 'settle': {
      dijkGraph.setNodeColor(frame.node, SETTLED);
      dijkGraph.setNodeGlow(frame.node, '#5b8fd9');
      updateHeapDisplay(frame.heap_snapshot);
      break;
    }
    case 'done': {
      // Highlight final path
      if (dijkResult?.path && dijkResult.path.length > 1) {
        for (let i = 0; i < dijkResult.path.length - 1; i++) {
          dijkGraph.setEdgeStyle(dijkResult.path[i], dijkResult.path[i+1], 'path-edge');
        }
        dijkGraph.setNodeColor(dijkResult.path[0], '#ebeef5');
        dijkGraph.setNodeColor(dijkResult.path[dijkResult.path.length - 1], '#e05c5c');
      }
      break;
    }
  }
}

function updateHeapDisplay(heap) {
  const el = document.getElementById('dijk-heap-display');
  if (!heap || !heap.length) { el.textContent = '(empty)'; return; }
  el.textContent = heap.map(([d, n]) => `(${d}, N${n})`).join('\n');
}

function dijkStepFwd() {
  if (dijkCurrentFrame >= dijkFrames.length) return;
  applyDijkFrame(dijkFrames[dijkCurrentFrame]);
  dijkCurrentFrame++;
  updateDijkCounter();
}

function dijkStepBack() {
  if (dijkCurrentFrame <= 0) return;
  dijkCurrentFrame--;
  dijkGraph.render(AppState.graph); dijkGraph.resetColors();
  for (let i = 0; i < dijkCurrentFrame; i++) applyDijkFrame(dijkFrames[i]);
  updateDijkCounter();
}

function dijkStart() {
  dijkPlaying = true;
  document.getElementById('dijk-btn-play').textContent = '⏸';
  dijkTimer = setInterval(() => {
    if (dijkCurrentFrame >= dijkFrames.length) { dijkStop(); return; }
    dijkStepFwd();
  }, parseInt(document.getElementById('dijk-speed').value));
}

function dijkStop() {
  dijkPlaying = false;
  document.getElementById('dijk-btn-play').textContent = '▶';
  clearInterval(dijkTimer);
}

function dijkTogglePlay() {
  if (!dijkFrames.length) { runDijkstra(); return; }
  dijkPlaying ? dijkStop() : dijkStart();
}

function dijkReset() {
  dijkStop();
  dijkCurrentFrame = 0; dijkFrames = [];
  if (AppState.graph) { dijkGraph.render(AppState.graph); dijkGraph.resetColors(); }
  updateDijkCounter();
  document.getElementById('dijk-path-display').textContent = '—';
  document.getElementById('dijk-dist-display').textContent = '';
  document.getElementById('dijk-heap-display').textContent = '—';
}

function updateDijkCounter() {
  document.getElementById('dijk-frame-counter').textContent =
    `Frame ${dijkCurrentFrame} / ${dijkFrames.length}`;
}
