"""
pathfinding.py — Hand-rolled BFS, DFS, and Dijkstra implementations.

All three algorithms emit step-trace frames so the frontend can animate
each internal state change deterministically.

Complexities:
  BFS   — O(V + E)
  DFS   — O(V + E)
  Dijkstra — O((V + E) log V)  with binary-heap priority queue
"""

from collections import deque
import heapq
from typing import Any


# ---------------------------------------------------------------------------
# BFS
# ---------------------------------------------------------------------------

def bfs(adj: dict[str, dict[str, Any]], source: int) -> dict:
    """
    Breadth-First Search from `source`.

    Args:
        adj:    Adjacency map {str(node): {str(neighbor): weight}}.
        source: Starting node (integer).

    Returns:
        {
            "frames":      [frame, ...],
            "visit_order": [node, ...],
            "complexity":  "O(V + E)"
        }

    Frame schema:
        { phase: "enqueue" | "dequeue" | "done",
          node, queue, visited, level, parent }
    """
    nodes = [int(k) for k in adj.keys()]
    neighbors: dict[int, list[int]] = {
        int(u): sorted(int(v) for v in adj[str(u)].keys())
        for u in nodes
    }

    visited: set[int] = set()
    parent: dict[int, int | None] = {source: None}
    level_map: dict[int, int] = {source: 0}
    visit_order: list[int] = []
    frames: list[dict] = []

    Q: deque[int] = deque([source])
    visited.add(source)

    frames.append({
        "phase": "enqueue", "node": source,
        "queue": [source], "visited": [source],
        "level": 0, "parent": None,
    })

    while Q:
        v = Q.popleft()
        visit_order.append(v)

        frames.append({
            "phase": "dequeue", "node": v,
            "queue": list(Q), "visited": sorted(visited),
            "level": level_map[v], "parent": parent[v],
        })

        for w in neighbors[v]:
            if w not in visited:
                visited.add(w)
                parent[w] = v
                level_map[w] = level_map[v] + 1
                Q.append(w)

                frames.append({
                    "phase": "enqueue", "node": w,
                    "queue": list(Q), "visited": sorted(visited),
                    "level": level_map[w], "parent": v,
                })

    frames.append({
        "phase": "done", "visit_order": visit_order,
        "queue": [], "visited": sorted(visited),
        "level": None, "parent": None,
    })

    return {
        "frames": frames,
        "visit_order": visit_order,
        "level_map": level_map,
        "parent": {k: v for k, v in parent.items()},
        "complexity": "O(V + E)",
        "complexity_note": "Each vertex and edge is processed at most once.",
    }


# ---------------------------------------------------------------------------
# DFS
# ---------------------------------------------------------------------------

def dfs(adj: dict[str, dict[str, Any]], source: int) -> dict:
    """
    Depth-First Search from `source` (iterative, using an explicit stack).

    Returns:
        {
            "frames":      [frame, ...],
            "visit_order": [node, ...],
            "complexity":  "O(V + E)"
        }

    Frame schema:
        { phase: "push" | "pop" | "skip" | "done",
          node, stack, visited, parent }
    """
    nodes = [int(k) for k in adj.keys()]
    neighbors: dict[int, list[int]] = {
    int(u): sorted((int(v) for v in adj[str(u)].keys()), reverse=True)
    for u in nodes
}

    visited: set[int] = set()
    parent: dict[int, int | None] = {source: None}
    visit_order: list[int] = []
    frames: list[dict] = []

    stack: list[int] = [source]

    frames.append({
        "phase": "push", "node": source,
        "stack": [source], "visited": [],
        "parent": None,
    })

    while stack:
        v = stack.pop()

        if v in visited:
            frames.append({
                "phase": "skip", "node": v,
                "stack": list(reversed(stack)), "visited": sorted(visited),
                "parent": parent.get(v),
            })
            continue

        visited.add(v)
        visit_order.append(v)

        frames.append({
            "phase": "pop", "node": v,
            "stack": list(reversed(stack)), "visited": sorted(visited),
            "parent": parent.get(v),
        })

        for w in neighbors[v]:
            if w not in visited:
                parent[w] = v
                stack.append(w)
                frames.append({
                    "phase": "push", "node": w,
                    "stack": list(reversed(stack)), "visited": sorted(visited),
                    "parent": v,
                })

    frames.append({
        "phase": "done", "visit_order": visit_order,
        "stack": [], "visited": sorted(visited),
        "parent": None,
    })

    return {
        "frames": frames,
        "visit_order": visit_order,
        "parent": {k: v for k, v in parent.items()},
        "complexity": "O(V + E)",
        "complexity_note": "Each vertex and edge is processed at most once.",
    }


# ---------------------------------------------------------------------------
# Dijkstra
# ---------------------------------------------------------------------------

def dijkstra(
    adj: dict[str, dict[str, Any]],
    source: int,
    target: int | None = None,
) -> dict:
    """
    Dijkstra's shortest-path algorithm using a binary min-heap.

    Args:
        adj:    Adjacency map {str(node): {str(neighbor): weight}}.
        source: Source node (integer).
        target: Optional target node. If given, search stops once target
                is settled and the shortest path is returned.

    Returns:
        {
            "frames":     [frame, ...],
            "distances":  {node: dist, ...},
            "path":       [node, ...] or None,
            "complexity": "O((V + E) log V)"
        }

    Frame schema:
        { phase: "relax" | "settle" | "done",
          node, dist, heap_snapshot, distances, relaxed_edge }
    """
    nodes = [int(k) for k in adj.keys()]
    neighbors: dict[int, dict[int, float]] = {
        int(u): {int(v): float(w) for v, w in adj[str(u)].items()}
        for u in nodes
    }

    INF = float("inf")
    dist: dict[int, float] = {v: INF for v in nodes}
    dist[source] = 0.0
    prev: dict[int, int | None] = {v: None for v in nodes}

    # Min-heap: (distance, node)
    heap: list[tuple[float, int]] = [(0.0, source)]
    settled: set[int] = set()
    frames: list[dict] = []

    def heap_snapshot():
        return sorted([(round(d, 2), n) for d, n in heap])

    while heap:
        d, u = heapq.heappop(heap)

        if u in settled:
            continue
        settled.add(u)

        frames.append({
            "phase": "settle",
            "node": u,
            "dist": round(d, 2),
            "heap_snapshot": heap_snapshot(),
            "distances": {k: (round(dist[k], 2) if dist[k] != INF else None)
                         for k in nodes},
            "relaxed_edge": None,
        })

        if target is not None and u == target:
            break

        for v, w in neighbors[u].items():
            if v in settled:
                continue
            new_dist = dist[u] + w
            if new_dist < dist[v]:
                dist[v] = new_dist
                prev[v] = u
                heapq.heappush(heap, (new_dist, v))

                frames.append({
                    "phase": "relax",
                    "node": v,
                    "dist": round(new_dist, 2),
                    "heap_snapshot": heap_snapshot(),
                    "distances": {k: (round(dist[k], 2) if dist[k] != INF else None)
                                 for k in nodes},
                    "relaxed_edge": {"from": u, "to": v, "weight": round(w, 2)},
                })

    frames.append({
        "phase": "done",
        "node": None,
        "dist": None,
        "heap_snapshot": [],
        "distances": {k: (round(dist[k], 2) if dist[k] != INF else None)
                     for k in nodes},
        "relaxed_edge": None,
    })

    # Reconstruct path if target was given
    path: list[int] | None = None
    if target is not None and dist[target] != INF:
        path = []
        cur: int | None = target
        while cur is not None:
            path.append(cur)
            cur = prev[cur]
        path.reverse()

    return {
        "frames": frames,
        "distances": {k: (round(dist[k], 2) if dist[k] != INF else None)
                     for k in nodes},
        "path": path,
        "complexity": "O((V + E) log V)",
        "complexity_note": (
            "Binary min-heap ensures each edge relaxation and extraction "
            "costs O(log V). Total: O((V + E) log V)."
        ),
    }
