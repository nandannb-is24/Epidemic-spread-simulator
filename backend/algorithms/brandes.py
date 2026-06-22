"""
brandes.py — Hand-rolled Brandes' algorithm for betweenness centrality.

Complexity: O(V·E) for unweighted graphs.

Every meaningful internal step is recorded as a "frame" so the frontend
can replay the algorithm deterministically without faking any animation.

References:
  Brandes, U. (2001). A faster algorithm for betweenness centrality.
  Journal of Mathematical Sociology, 25(2), 163–177.
"""

from collections import deque, defaultdict
from typing import Any


# ---------------------------------------------------------------------------
# Frame helpers
# ---------------------------------------------------------------------------

def _frame(phase: str, source: int, **kwargs) -> dict:
    """Build a single animation frame dict."""
    return {"phase": phase, "source": source, **kwargs}


# ---------------------------------------------------------------------------
# Main algorithm
# ---------------------------------------------------------------------------

def brandes_betweenness(adj: dict[str, dict[str, Any]]) -> dict:
    """
    Compute betweenness centrality for all nodes using Brandes' algorithm.

    Args:
        adj: Adjacency map  {str(node): {str(neighbor): weight, ...}, ...}
             Weights are IGNORED — this runs the unweighted BFS variant,
             which gives O(V·E) complexity.

    Returns:
        {
            "frames":        [frame, ...],   # full step trace for animation
            "final_scores":  {node_id: float, ...},
            "complexity":    "O(V·E)",
            "complexity_note": "V BFS runs each taking O(E) time"
        }

    Frame schema (phase = "bfs_visit"):
        { phase, source, node, level, sigma, queue, predecessors }

    Frame schema (phase = "bfs_done"):
        { phase, source, stack_order }   # reverse BFS order for back-prop

    Frame schema (phase = "back_prop"):
        { phase, source, node, predecessor, delta_update,
          delta, centrality_delta, running_scores }

    Frame schema (phase = "source_done"):
        { phase, source, running_scores }
    """

    # Convert all keys to integers for uniform handling
    nodes = [int(k) for k in adj.keys()]
    # Build integer-keyed adjacency set (unweighted)
    neighbors: dict[int, list[int]] = {
        int(u): [int(v) for v in adj[str(u)].keys()]
        for u in nodes
    }

    # Betweenness centrality accumulator (normalisation applied at the end)
    centrality: dict[int, float] = {v: 0.0 for v in nodes}

    frames: list[dict] = []

    for s in nodes:
        # ---------------------------------------------------------------
        # Phase 1: BFS from source s
        # ---------------------------------------------------------------
        stack: list[int] = []          # reverse BFS order (for back-prop)
        pred: dict[int, list[int]] = defaultdict(list)  # predecessors on SP
        sigma: dict[int, int] = {v: 0 for v in nodes}  # #shortest paths from s
        dist:  dict[int, int] = {v: -1 for v in nodes}  # BFS distance

        sigma[s] = 1
        dist[s] = 0

        Q: deque[int] = deque([s])

        while Q:
            v = Q.popleft()
            stack.append(v)

            # Emit a frame for each node dequeued
            frames.append(_frame(
                "bfs_visit",
                source=s,
                node=v,
                level=dist[v],
                sigma={k: sigma[k] for k in nodes},
                queue=list(Q),
                predecessors={k: list(v2) for k, v2 in pred.items() if v2},
            ))

            for w in neighbors[v]:
                # First discovery of w?
                if dist[w] < 0:
                    Q.append(w)
                    dist[w] = dist[v] + 1

                # Is this a shortest path to w via v?
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)

        # Emit a frame marking BFS complete for this source
        frames.append(_frame(
            "bfs_done",
            source=s,
            stack_order=list(stack),
            sigma_final={k: sigma[k] for k in nodes},
            dist={k: dist[k] for k in nodes},
        ))

        # ---------------------------------------------------------------
        # Phase 2: Backward accumulation (dependency)
        # ---------------------------------------------------------------
        delta: dict[int, float] = {v: 0.0 for v in nodes}

        while stack:
            w = stack.pop()
            for v in pred[w]:
                # Proportion of shortest paths through v that continue to w
                contribution = (sigma[v] / sigma[w]) * (1.0 + delta[w])
                delta[v] += contribution

                # Emit frame for each dependency edge update
                frames.append(_frame(
                    "back_prop",
                    source=s,
                    node=w,
                    predecessor=v,
                    contribution=round(contribution, 4),
                    delta={k: round(delta[k], 4) for k in nodes},
                    running_scores={
                        k: round(centrality[k], 4) for k in nodes
                    },
                ))

            # Nodes other than source accumulate centrality
            if w != s:
                centrality[w] += delta[w]

        # Emit frame marking this source's full contribution
        frames.append(_frame(
            "source_done",
            source=s,
            running_scores={k: round(centrality[k], 4) for k in nodes},
        ))

    # -----------------------------------------------------------------------
    # Normalisation: divide by (V-1)(V-2)/2 for undirected graphs
    # -----------------------------------------------------------------------
    V = len(nodes)
    norm = (V - 1) * (V - 2) / 2 if V > 2 else 1.0
    final_scores = {k: round(centrality[k] / norm, 6) for k in nodes}

    return {
        "frames": frames,
        "final_scores": final_scores,
        "complexity": "O(V·E)",
        "complexity_note": (
            "Runs a BFS from every vertex V. Each BFS is O(E). "
            "Total: O(V·E). The backward pass adds only O(V+E) per source."
        ),
    }
