"""
graph_utils.py — Graph generation and layout utilities.

networkx is used ONLY here (for generation and spring-layout coordinates).
All algorithm implementations live in algorithms/ and do NOT call networkx.
"""

import random
import networkx as nx
import numpy as np
from typing import Optional


def _graph_to_json(G: nx.Graph, seed: int = 42) -> dict:
    """
    Convert a networkx Graph into the JSON format used throughout the app.

    Returns:
        {
            "nodes": [{"id": int, "x": float, "y": float}, ...],
            "edges": [{"source": int, "target": int, "weight": float}, ...],
            "adj": {str(node): {str(neighbor): weight, ...}, ...}
        }
    """
    # Compute 2-D layout positions (spring layout for nice visuals)
    pos = nx.spring_layout(G, seed=seed, scale=400)

    nodes = [
        {"id": int(n), "x": round(float(pos[n][0]), 2), "y": round(float(pos[n][1]), 2)}
        for n in G.nodes()
    ]

    edges = []
    adj: dict[str, dict[str, float]] = {str(n): {} for n in G.nodes()}

    for u, v, data in G.edges(data=True):
        w = round(float(data.get("weight", 1.0)), 2)
        edges.append({"source": int(u), "target": int(v), "weight": w})
        adj[str(u)][str(v)] = w
        adj[str(v)][str(u)] = w  # undirected

    return {"nodes": nodes, "edges": edges, "adj": adj}


def generate_erdos_renyi(n: int, p: float, seed: int = 42) -> dict:
    """
    Generate an Erdős–Rényi random graph G(n, p).

    Args:
        n: Number of nodes.
        p: Probability of each edge existing.
        seed: Random seed for reproducibility.

    Returns:
        Graph JSON dict (nodes with layout coords, edges with weights, adj matrix).
    """
    rng = random.Random(seed)
    G = nx.erdos_renyi_graph(n, p, seed=seed)

    # Ensure connectivity — add edges to any isolated nodes
    for node in list(nx.isolates(G)):
        target = rng.choice([v for v in G.nodes() if v != node])
        G.add_edge(node, target)

    # Assign random integer weights 1–10
    np_rng = np.random.default_rng(seed)
    for u, v in G.edges():
        G[u][v]["weight"] = int(np_rng.integers(1, 11))

    return _graph_to_json(G, seed=seed)


def generate_barabasi_albert(n: int, m: int, seed: int = 42) -> dict:
    """
    Generate a Barabási–Albert preferential-attachment graph.

    Args:
        n: Number of nodes (must be > m).
        m: Number of edges to attach from a new node to existing nodes.
        seed: Random seed.

    Returns:
        Graph JSON dict.
    """
    G = nx.barabasi_albert_graph(n, m, seed=seed)

    np_rng = np.random.default_rng(seed)
    for u, v in G.edges():
        G[u][v]["weight"] = int(np_rng.integers(1, 11))

    return _graph_to_json(G, seed=seed)


def parse_adjacency_list(data: list[list]) -> dict:
    """
    Parse a user-uploaded adjacency list.

    Expected format: list of [source, target, weight] triples.
    Weight defaults to 1 if omitted.

    Returns:
        Graph JSON dict.
    """
    G = nx.Graph()
    for row in data:
        if len(row) < 2:
            continue
        u, v = int(row[0]), int(row[1])
        w = float(row[2]) if len(row) > 2 else 1.0
        G.add_edge(u, v, weight=w)

    if G.number_of_nodes() == 0:
        raise ValueError("Empty graph — check your adjacency list format.")

    return _graph_to_json(G)
