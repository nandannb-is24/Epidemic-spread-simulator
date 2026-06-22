/**
 * concept_map.js — Concept Map section.
 *
 * Renders a table mapping every DAA/DMS concept to its lab section,
 * with clickable rows that navigate to the corresponding lab.
 */

const CONCEPT_MAP = [
  {
    concept: 'Graph Traversal — BFS',
    domain: ['DAA', 'DMS'],
    where: 'Pathfinding Lab (BFS vs DFS panel)',
    complexity: 'O(V + E)',
    file: 'algorithms/pathfinding.py → bfs()',
    section: 'pathfinding',
  },
  {
    concept: 'Graph Traversal — DFS',
    domain: ['DAA', 'DMS'],
    where: 'Pathfinding Lab (BFS vs DFS panel)',
    complexity: 'O(V + E)',
    file: 'algorithms/pathfinding.py → dfs()',
    section: 'pathfinding',
  },
  {
    concept: "Dijkstra's Shortest Path",
    domain: ['DAA'],
    where: 'Pathfinding Lab (Dijkstra panel)',
    complexity: 'O((V+E) log V)',
    file: 'algorithms/pathfinding.py → dijkstra()',
    section: 'pathfinding',
  },
  {
    concept: "Brandes' Betweenness Centrality",
    domain: ['DAA', 'DMS'],
    where: 'Centrality Lab ★ (Centerpiece)',
    complexity: 'O(V · E)',
    file: 'algorithms/brandes.py → brandes_betweenness()',
    section: 'centrality',
  },
  {
    concept: '0/1 Knapsack Dynamic Programming',
    domain: ['DAA'],
    where: 'Intervention Optimizer (DP panel)',
    complexity: 'O(N · W)',
    file: 'algorithms/intervention.py → knapsack_dp()',
    section: 'intervention',
  },
  {
    concept: 'Greedy Approximation',
    domain: ['DAA'],
    where: 'Intervention Optimizer (Greedy panel)',
    complexity: 'O(N log N)',
    file: 'algorithms/intervention.py → greedy_centrality()',
    section: 'intervention',
  },
  {
    concept: 'Graph Theory — Adjacency, Degree, Paths',
    domain: ['DMS'],
    where: 'Graph Builder + all labs',
    complexity: '—',
    file: 'graph_utils.py',
    section: 'graph-builder',
  },
  {
    concept: 'Probability — Stochastic Transitions (SIR)',
    domain: ['DMS'],
    where: 'SIR Simulation Lab',
    complexity: 'O(V · T)',
    file: 'simulation/sir.py → run_sir()',
    section: 'simulation',
  },
  {
    concept: 'Combinatorics — Shortest-Path Counting (σ)',
    domain: ['DMS'],
    where: 'Centrality Lab — σ labels on nodes',
    complexity: 'O(V · E)',
    file: 'algorithms/brandes.py → brandes_betweenness()',
    section: 'centrality',
  },
  {
    concept: 'Relations & Sets — Predecessor Sets in BFS',
    domain: ['DMS'],
    where: 'Centrality Lab — predecessor visualization',
    complexity: 'O(V + E)',
    file: 'algorithms/brandes.py (pred dict)',
    section: 'centrality',
  },
  {
    concept: 'NP-Hardness & Approximation Quality',
    domain: ['DAA'],
    where: 'Intervention Optimizer — optimality gap chart',
    complexity: '—',
    file: 'algorithms/intervention.py (comparison)',
    section: 'intervention',
  },
];

export function initConceptMap() {
  const tbody = document.getElementById('concept-map-tbody');
  if (!tbody) return;

  tbody.innerHTML = CONCEPT_MAP.map((row, i) => {
    const tags = row.domain.map(d =>
      `<span class="tag tag-${d.toLowerCase()}">${d}</span>`
    ).join(' ');

    return `
      <tr data-section="${row.section}" style="animation:fadeIn 0.3s ease ${i * 0.04}s both">
        <td>
          <strong>${row.concept}</strong>
          ${row.where.includes('★') ? ' <span style="color:var(--gold)">★</span>' : ''}
        </td>
        <td>${tags}</td>
        <td style="color:var(--text-secondary)">${row.where.replace('★ ', '')}</td>
        <td class="text-mono" style="color:var(--teal)">${row.complexity}</td>
        <td class="text-mono text-xs" style="color:var(--text-muted)">${row.file}</td>
      </tr>
    `;
  }).join('');

  // Clickable rows navigate to the corresponding section
  tbody.querySelectorAll('tr[data-section]').forEach(tr => {
    tr.addEventListener('click', () => {
      const section = tr.dataset.section;
      // Trigger sidebar nav click
      const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
      if (navItem) navItem.click();
    });
  });
}
