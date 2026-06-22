/**
 * app.js — SPA router, global state, sidebar navigation, toast utility.
 *
 * Imports and initialises each lab module when its section becomes active.
 */

import { initGraphBuilder, renderGraphBuilder } from './labs/graph_builder.js';
import { initCentrality }     from './labs/centrality.js';
import { initPathfinding }    from './labs/pathfinding.js';
import { initIntervention }   from './labs/intervention.js';
import { initSimulation }     from './labs/simulation.js';
import { initConceptMap }     from './labs/concept_map.js';
import { initGeoMap }         from './labs/geo_map.js';

// ---------------------------------------------------------------------------
// Global application state (shared across all lab modules via import)
// ---------------------------------------------------------------------------
export const AppState = {
  /** Current graph data from the backend */
  graph: null,   // { nodes, edges, adj }

  /** Betweenness centrality scores from the last Brandes run */
  centralityScores: null,   // { node_id: float }

  /** DP-selected node IDs from the last knapsack run */
  dpSelectedNodes: [],

  /** Whether the API is reachable */
  apiOk: false,
};

// ---------------------------------------------------------------------------
// API base URL — FastAPI backend
// ---------------------------------------------------------------------------
export const API_BASE = '';   // empty = same origin (FastAPI serves both)

// ---------------------------------------------------------------------------
// Toast notification helper
// ---------------------------------------------------------------------------
export function showToast(message, type = 'info', durationMs = 3000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}

// ---------------------------------------------------------------------------
// API call wrapper
// ---------------------------------------------------------------------------
export async function apiPost(endpoint, body) {
  const res = await fetch(`${API_BASE}/api${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Section routing
// ---------------------------------------------------------------------------
const SECTIONS = [
  'overview', 'graph-builder', 'centrality',
  'pathfinding', 'intervention', 'simulation', 'geo-map', 'concept-map',
];

const initialised = new Set();

function activateSection(id) {
  // Update panels
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`section-${id}`);
  if (panel) panel.classList.add('active');

  // Update sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === id);
  });

  // Initialise lab on first visit
  if (!initialised.has(id)) {
    initialised.add(id);
    switch (id) {
      case 'graph-builder':   initGraphBuilder(); break;
      case 'centrality':      initCentrality();   break;
      case 'pathfinding':     initPathfinding();  break;
      case 'intervention':    initIntervention(); break;
      case 'simulation':      initSimulation();   break;
      case 'geo-map':         initGeoMap();       break;
      case 'concept-map':     initConceptMap();   break;
    }
  } else {
    // Re-render graph when returning to graph builder
    if (id === 'graph-builder') renderGraphBuilder();
  }
}

// ---------------------------------------------------------------------------
// Wire up sidebar navigation
// ---------------------------------------------------------------------------
document.querySelectorAll('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', () => activateSection(item.dataset.section));
});

// Wire up overview "go to lab" cards
document.querySelectorAll('.lab-card[data-goto]').forEach(card => {
  card.addEventListener('click', () => activateSection(card.dataset.goto));
});

// ---------------------------------------------------------------------------
// Startup: load a default graph so labs have something to work with
// ---------------------------------------------------------------------------
async function loadDefaultGraph() {
  try {
    const data = await apiPost('/graph/generate', {
      type: 'barabasi_albert', n: 20, m: 2, seed: 42,
    });
    AppState.graph = data;
    AppState.apiOk = true;
    showToast('Default graph loaded (BA n=20, m=2)', 'success', 2000);
  } catch (e) {
    showToast('Backend not reachable — start the FastAPI server.', 'error', 6000);
    console.warn('API error on startup:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Theme Toggle Logic (Dark/Light mode)
// ---------------------------------------------------------------------------
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;

  const storedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(storedTheme);

  toggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const toggleContent = toggleBtn.querySelector('.theme-toggle-content');
    if (toggleContent) {
      if (theme === 'dark') {
        // currently dark -> button offers switch to "Light"
        toggleContent.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <span>Light</span>
        `;
      } else {
        // currently light -> button offers switch to "Dark"
        toggleContent.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <span>Dark</span>
        `;
      }
    }

    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
initTheme();
activateSection('overview');
loadDefaultGraph();
