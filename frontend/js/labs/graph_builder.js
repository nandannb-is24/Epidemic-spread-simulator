/**
 * graph_builder.js — Graph Builder lab.
 *
 * Lets the user generate Erdős–Rényi or Barabási–Albert graphs,
 * or upload a custom adjacency list. Updates AppState.graph
 * and re-renders all other labs.
 */

import { AppState, apiPost, showToast } from '../app.js';
import { Graph } from '../graph.js';

let gbGraph = null;

export function initGraphBuilder() {
  gbGraph = new Graph('gb-svg', { showWeights: true, showCosts: true });

  // ---- Slider readouts ----
  bindSlider('gb-n',    'gb-n-val',    v => v);
  bindSlider('gb-m',    'gb-m-val',    v => v);
  bindSlider('gb-p',    'gb-p-val',    v => parseFloat(v).toFixed(2));
  bindSlider('gb-seed', 'gb-seed-val', v => v);

  // ---- Graph type toggle ----
  document.getElementById('gb-type').addEventListener('change', e => {
    const isBA = e.target.value === 'barabasi_albert';
    document.getElementById('gb-m-row').style.display = isBA ? '' : 'none';
    document.getElementById('gb-p-row').style.display = isBA ? 'none' : '';
  });

  // ---- Generate button ----
  document.getElementById('gb-generate-btn').addEventListener('click', async () => {
    const type = document.getElementById('gb-type').value;
    const n    = parseInt(document.getElementById('gb-n').value);
    const m    = parseInt(document.getElementById('gb-m').value);
    const p    = parseFloat(document.getElementById('gb-p').value);
    const seed = parseInt(document.getElementById('gb-seed').value);

    const btn = document.getElementById('gb-generate-btn');
    btn.disabled = true;
    btn.textContent = 'Generating…';

    try {
      const data = await apiPost('/graph/generate', { type, n, p, m, seed });
      AppState.graph = data;
      renderGraphBuilder();
      showToast(`Graph generated: ${data.nodes.length} nodes, ${data.edges.length} edges`, 'success');
    } catch (e) {
      showToast(`Error: ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Graph';
    }
  });

  // ---- Upload button ----
  document.getElementById('gb-upload-btn').addEventListener('click', async () => {
    const text = document.getElementById('gb-upload-text').value.trim();
    if (!text) { showToast('Paste an edge list first.', 'error'); return; }

    const rows = text.split('\n').map(line =>
      line.trim().split(/\s+/).map(Number).filter(v => !isNaN(v))
    ).filter(row => row.length >= 2);

    try {
      const data = await apiPost('/graph/upload', { adjacency_list: rows });
      AppState.graph = data;
      renderGraphBuilder();
      showToast(`Uploaded graph: ${data.nodes.length} nodes, ${data.edges.length} edges`, 'success');
    } catch (e) {
      showToast(`Upload error: ${e.message}`, 'error');
    }
  });

  renderGraphBuilder();
}

export function renderGraphBuilder() {
  if (!AppState.graph) return;
  const g = AppState.graph;

  if (gbGraph) gbGraph.render(g);

  document.getElementById('gb-stat-nodes').textContent = g.nodes.length;
  document.getElementById('gb-stat-edges').textContent = g.edges.length;
  document.getElementById('gb-overlay').textContent =
    `${g.nodes.length} nodes · ${g.edges.length} edges`;
  document.getElementById('gb-overlay').classList.remove('hidden');
}

// ---- Utility ----
function bindSlider(sliderId, displayId, fmt) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (!slider || !display) return;
  display.textContent = fmt(slider.value);
  slider.addEventListener('input', () => {
    display.textContent = fmt(slider.value);
  });
}
