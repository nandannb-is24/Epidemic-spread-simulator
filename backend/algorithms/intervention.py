"""
intervention.py — Hand-rolled 0/1 Knapsack DP and Greedy selection.

Used by the Intervention Optimizer lab to choose which nodes to
"vaccinate" (remove from the infection network) within a budget.

Each node has:
  - cost   (integer, 1–10)
  - value  (float, betweenness centrality score — higher = more important to remove)

Complexities:
  Knapsack DP — O(N · W)  where N = #nodes, W = budget
  Greedy      — O(N log N) for sorting + O(N) selection
"""

from typing import Any


# ---------------------------------------------------------------------------
# 0/1 Knapsack DP
# ---------------------------------------------------------------------------

def knapsack_dp(
    nodes: list[dict],   # [{"id": int, "cost": int, "value": float}, ...]
    budget: int,
) -> dict:
    """
    Solve the 0/1 Knapsack problem with a full DP table.

    Emits a frame for every cell fill so the frontend can animate
    the table being populated row by row, column by column.

    Args:
        nodes:  List of node dicts with 'id', 'cost', 'value'.
        budget: Integer budget (maximum total cost).

    Returns:
        {
            "dp_table":      [[float, ...], ...],  # (N+1) x (W+1) table
            "frames":        [frame, ...],
            "selected_ids":  [int, ...],
            "total_value":   float,
            "total_cost":    int,
            "complexity":    "O(N·W)"
        }

    Frame schema:
        { row, col, value, action: "fill" | "backtrack" | "done",
          selected_so_far }
    """
    N = len(nodes)
    W = budget

    # dp[i][w] = max value achievable using items 0..i-1 with capacity w
    dp: list[list[float]] = [[0.0] * (W + 1) for _ in range(N + 1)]
    frames: list[dict] = []

    # DP fill — O(N·W)
    for i in range(1, N + 1):
        node = nodes[i - 1]
        cost  = node["cost"]
        value = node["value"]

        for w in range(W + 1):
            # Option A: skip this node
            skip_val = dp[i - 1][w]
            # Option B: include this node (if it fits)
            take_val = dp[i - 1][w - cost] + value if w >= cost else -1

            if take_val > skip_val:
                dp[i][w] = take_val
                action = "take"
            else:
                dp[i][w] = skip_val
                action = "skip"

            frames.append({
                "action": "fill",
                "row": i,
                "col": w,
                "value": round(dp[i][w], 4),
                "item_action": action,
                "node_id": node["id"],
                "selected_so_far": [],
            })

    # Backtrack to find selected nodes — O(N)
    selected_ids: list[int] = []
    w = W
    for i in range(N, 0, -1):
        if dp[i][w] != dp[i - 1][w]:
            selected_ids.append(nodes[i - 1]["id"])
            w -= nodes[i - 1]["cost"]

            frames.append({
                "action": "backtrack",
                "row": i,
                "col": w + nodes[i - 1]["cost"],
                "value": round(dp[i][w + nodes[i - 1]["cost"]], 4),
                "item_action": "selected",
                "node_id": nodes[i - 1]["id"],
                "selected_so_far": list(selected_ids),
            })

    frames.append({
        "action": "done",
        "row": None, "col": None, "value": None,
        "item_action": None, "node_id": None,
        "selected_so_far": list(selected_ids),
    })

    total_cost  = sum(nodes[i]["cost"]  for i, n in enumerate(nodes) if n["id"] in selected_ids)
    total_value = sum(nodes[i]["value"] for i, n in enumerate(nodes) if n["id"] in selected_ids)

    return {
        "dp_table": [[round(v, 4) for v in row] for row in dp],
        "frames": frames,
        "selected_ids": selected_ids,
        "total_value": round(total_value, 4),
        "total_cost": total_cost,
        "complexity": "O(N·W)",
        "complexity_note": (
            "N items × W budget cells, each filled in O(1). "
            "May be exponential in input size (pseudo-polynomial). "
            "Guarantees optimal solution — Greedy does not."
        ),
    }


# ---------------------------------------------------------------------------
# Greedy (centrality-ranked)
# ---------------------------------------------------------------------------

def greedy_centrality(
    nodes: list[dict],         # [{"id": int, "cost": int, "value": float}, ...]
    budget: int,
) -> dict:
    """
    Greedy node selection: sort by centrality (value) descending,
    pick nodes in order while budget allows.

    O(N log N) for sort + O(N) for selection.

    Returns:
        {
            "frames":        [frame, ...],
            "selected_ids":  [int, ...],
            "total_value":   float,
            "total_cost":    int,
            "ranked_nodes":  [{"id", "cost", "value", "selected"}, ...],
            "complexity":    "O(N log N)"
        }

    Frame schema:
        { step, node_id, action: "consider" | "accept" | "reject",
          remaining_budget, selected_so_far, running_value }
    """
    # Sort by value descending (O(N log N))
    ranked = sorted(nodes, key=lambda n: n["value"], reverse=True)

    frames: list[dict] = []
    selected_ids: list[int] = []
    remaining = budget
    running_value = 0.0

    for step, node in enumerate(ranked):
        if node["cost"] <= remaining:
            action = "accept"
            selected_ids.append(node["id"])
            remaining -= node["cost"]
            running_value += node["value"]
        else:
            action = "reject"

        frames.append({
            "step": step,
            "node_id": node["id"],
            "node_value": round(node["value"], 4),
            "node_cost": node["cost"],
            "action": action,
            "remaining_budget": remaining,
            "selected_so_far": list(selected_ids),
            "running_value": round(running_value, 4),
        })

    frames.append({
        "step": len(ranked),
        "node_id": None,
        "action": "done",
        "remaining_budget": remaining,
        "selected_so_far": list(selected_ids),
        "running_value": round(running_value, 4),
    })

    ranked_with_flag = [
        {**n, "selected": n["id"] in selected_ids} for n in ranked
    ]
    total_cost = sum(n["cost"] for n in nodes if n["id"] in selected_ids)

    return {
        "frames": frames,
        "selected_ids": selected_ids,
        "total_value": round(running_value, 4),
        "total_cost": total_cost,
        "ranked_nodes": ranked_with_flag,
        "complexity": "O(N log N)",
        "complexity_note": (
            "Dominated by sorting nodes by centrality. "
            "Does NOT guarantee optimal solution — DP does. "
            "Demonstrates the approximation gap."
        ),
    }
