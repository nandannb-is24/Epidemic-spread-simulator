# Epidemic Spread Simulator — Algorithm Visualization Lab

An interactive web application visualizing graph algorithms through the lens of epidemic spread modeling.
Built for a **Design and Analysis of Algorithms (DAA) + Discrete Mathematical Structures (DMS)** college lab project.

---

## Quick Start

### 1. Install Python dependencies

```bash
cd "DAA EL"
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

### 2. Start the server

From the project root (the `DAA EL` folder):

```bash
uvicorn backend.main:app --reload
```

### 3. Open the app

Navigate to **http://127.0.0.1:8000** in your browser.

The FastAPI backend serves the frontend automatically — no separate web server needed.

---

## Architecture Overview

```
DAA EL/
├── backend/                   Python + FastAPI backend
│   ├── main.py                App entry point (CORS, static mount, router)
│   ├── graph_utils.py         Graph generation via networkx (ONLY place networkx is used)
│   ├── algorithms/
│   │   ├── brandes.py         ★ Brandes' betweenness centrality — O(V·E)
│   │   ├── pathfinding.py     BFS O(V+E), DFS O(V+E), Dijkstra O((V+E)logV)
│   │   └── intervention.py    0/1 Knapsack DP O(N·W), Greedy O(N log N)
│   ├── simulation/
│   │   └── sir.py             Stochastic SIR epidemic model
│   └── api/
│       └── routes.py          All FastAPI endpoints
│
└── frontend/                  Vanilla HTML + CSS + JS (no framework)
    ├── index.html             Single-page app shell (7 sections)
    ├── css/style.css          Dark academic dashboard design system
    └── js/
        ├── app.js             SPA router, global state, API wrapper
        ├── graph.js           Reusable D3.js force-directed graph component
        ├── charts.js          Chart.js helpers (centrality bar, SIR curve, comparison)
        └── labs/
            ├── graph_builder.js   Graph generation / upload
            ├── centrality.js      Brandes' visualization (centerpiece)
            ├── pathfinding.js     BFS/DFS + Dijkstra
            ├── intervention.js    DP table + Greedy list + comparison
            ├── simulation.js      SIR animation + before/after panel
            └── concept_map.js     Evaluator-friendly concept table
```

### Key Design Decisions

- **networkx is used ONLY for graph generation and layout coordinates** (`graph_utils.py`).
  All algorithm implementations in `algorithms/` are hand-rolled from scratch.
- **Step-trace pattern**: every algorithm function emits a list of "frames" (JSON dicts
  describing internal state at each meaningful step). The frontend replays these frames
  deterministically using `setInterval` — no server-side animation.
- **Shared adjacency map**: the `adj` dict `{str(node): {str(neighbor): weight}}` is the
  single canonical graph representation passed through the entire app.

---

## API Endpoints

| Endpoint | Description | Complexity |
|---|---|---|
| `POST /api/graph/generate` | Generate ER or BA random graph | — |
| `POST /api/graph/upload`   | Parse custom adjacency list | — |
| `POST /api/algorithms/brandes` | Betweenness centrality + step trace | O(V·E) |
| `POST /api/algorithms/bfs` | BFS from source + step trace | O(V+E) |
| `POST /api/algorithms/dfs` | DFS from source + step trace | O(V+E) |
| `POST /api/algorithms/dijkstra` | Dijkstra source→target + step trace | O((V+E)logV) |
| `POST /api/algorithms/knapsack-intervention` | 0/1 Knapsack DP + table trace | O(N·W) |
| `POST /api/algorithms/greedy-intervention` | Greedy centrality selection | O(N log N) |
| `POST /api/simulate/sir` | Stochastic SIR simulation | O(V·T) |

Interactive API docs: **http://127.0.0.1:8000/docs**

---

## Viva Cheat Sheet

> For defending the project to evaluators — exact complexity and implementation location for each graded algorithm.

| Algorithm | Big-O | File | Function |
|---|---|---|---|
| **Brandes' Betweenness Centrality** | O(V·E) | `backend/algorithms/brandes.py` | `brandes_betweenness(adj)` |
| **BFS** | O(V + E) | `backend/algorithms/pathfinding.py` | `bfs(adj, source)` |
| **DFS** | O(V + E) | `backend/algorithms/pathfinding.py` | `dfs(adj, source)` |
| **Dijkstra** | O((V+E) log V) | `backend/algorithms/pathfinding.py` | `dijkstra(adj, source, target)` |
| **0/1 Knapsack DP** | O(N · W) | `backend/algorithms/intervention.py` | `knapsack_dp(nodes, budget)` |
| **Greedy Centrality Selection** | O(N log N) | `backend/algorithms/intervention.py` | `greedy_centrality(nodes, budget)` |
| **SIR Simulation** | O(V · T) | `backend/simulation/sir.py` | `run_sir(adj, beta, gamma, ...)` |

### Complexity Notes

- **Brandes O(V·E)**: Runs a full BFS from every vertex V. Each BFS is O(V+E). The backward dependency accumulation pass is also O(V+E) per source. Total: O(V·(V+E)) = O(V·E) for sparse graphs.
- **Dijkstra O((V+E) log V)**: Uses a binary min-heap (Python's `heapq`). Each edge relaxation pushes to the heap in O(log V). Each vertex is settled once.
- **Knapsack O(N·W)**: Pseudo-polynomial — polynomial in N (number of nodes) and W (budget), but exponential in the number of bits to represent W. Guarantees optimal solution. Greedy does NOT.
- **SIR O(V·T)**: Each timestep examines all nodes and their neighbours. T = max timesteps (≤ 100 default).

---

## Lab Walkthrough

1. **Graph Builder** → Generate a Barabási–Albert graph (default n=20, m=2). This creates realistic hub nodes.
2. **Centrality Lab** → Run Brandes. Switch to "Full Algorithm" mode and watch all V sources complete. The bar chart reveals which nodes are true super-spreaders.
3. **Pathfinding Lab** → BFS vs DFS: see how BFS explores level by level while DFS dives deep. Dijkstra: pick source=0, target=last node.
4. **Intervention Lab** → Run Brandes first (step 2). Then run both strategies with budget=10. The DP table fills cell-by-cell; observe the optimality gap in the comparison chart.
5. **SIR Simulation** → Run without intervention, then run with DP vaccination. Compare peak infections in the before/after panel.
6. **Concept Map** → Click any row to jump to the relevant lab. Useful during viva.

---

## Non-Goals (explicitly out of scope)

- No auth, no database, no deployment configuration
- No SEIR / age-structured / spatial epidemic models — listed as "future work" only
- No React or other JS framework — vanilla JS + D3.js only
- No mobile-responsive layout — built for desktop / projector presentation
