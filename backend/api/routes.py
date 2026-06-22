"""
routes.py — All FastAPI endpoint definitions.

Every endpoint calls hand-rolled algorithm implementations.
Every response includes a `complexity` field for the frontend
to display next to the running algorithm.
"""

import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Optional

from backend.graph_utils import (
    generate_erdos_renyi,
    generate_barabasi_albert,
    parse_adjacency_list,
)
from backend.algorithms.brandes import brandes_betweenness
from backend.algorithms.pathfinding import bfs, dfs, dijkstra
from backend.algorithms.intervention import knapsack_dp, greedy_centrality
from backend.simulation.sir import run_sir
from backend.api.geo_pipeline import run_geo_pipeline

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class GenerateGraphRequest(BaseModel):
    type: str = Field("barabasi_albert", description="erdos_renyi | barabasi_albert")
    n: int = Field(20, ge=4, le=100)
    p: float = Field(0.2, ge=0.01, le=1.0, description="Edge probability (Erdős–Rényi)")
    m: int = Field(2, ge=1, le=10, description="Attachment edges (Barabási–Albert)")
    seed: int = Field(42)


class UploadGraphRequest(BaseModel):
    adjacency_list: list[list]  # [[u, v, w?], ...]


class BrandesRequest(BaseModel):
    adj: dict[str, dict[str, Any]]


class BFSRequest(BaseModel):
    adj: dict[str, dict[str, Any]]
    source: int


class DFSRequest(BaseModel):
    adj: dict[str, dict[str, Any]]
    source: int


class DijkstraRequest(BaseModel):
    adj: dict[str, dict[str, Any]]
    source: int
    target: Optional[int] = None


class KnapsackRequest(BaseModel):
    nodes: list[dict]     # [{"id": int, "cost": int, "value": float}, ...]
    budget: int = Field(10, ge=1)


class GreedyRequest(BaseModel):
    nodes: list[dict]
    budget: int = Field(10, ge=1)


class SIRRequest(BaseModel):
    adj: dict[str, dict[str, Any]]
    beta: float = Field(0.3, ge=0.0, le=1.0)
    gamma: float = Field(0.1, ge=0.0, le=1.0)
    seed_nodes: list[int] = Field(default_factory=list)
    vaccinated_nodes: Optional[list[int]] = None
    max_steps: int = Field(100, ge=1, le=500)
    rng_seed: int = 42


class LocationItem(BaseModel):
    lat: float
    lng: float
    population: int
    name: str


class GeoPipelineRequest(BaseModel):
    locations: list[LocationItem]
    proximity_radius: float = Field(5.0, ge=0.5, le=50.0)
    budget: int = Field(10, ge=1)
    beta: float = Field(0.3, ge=0.0, le=1.0)
    gamma: float = Field(0.1, ge=0.0, le=1.0)
    seed_nodes: Optional[list[int]] = None


# ---------------------------------------------------------------------------
# Graph endpoints
# ---------------------------------------------------------------------------

@router.post("/graph/generate")
def graph_generate(req: GenerateGraphRequest):
    """Generate a random graph and return nodes + edges with layout coords."""
    try:
        if req.type == "erdos_renyi":
            result = generate_erdos_renyi(req.n, req.p, req.seed)
        elif req.type == "barabasi_albert":
            result = generate_barabasi_albert(req.n, req.m, req.seed)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown graph type: {req.type}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Attach default node costs (random 1–5) for the knapsack lab
    rng = random.Random(req.seed + 1)
    for node in result["nodes"]:
        node["cost"] = rng.randint(1, 5)

    return result


@router.post("/graph/upload")
def graph_upload(req: UploadGraphRequest):
    """Parse a user-uploaded adjacency list and return graph JSON."""
    try:
        result = parse_adjacency_list(req.adjacency_list)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    rng = random.Random(0)
    for node in result["nodes"]:
        node["cost"] = rng.randint(1, 5)

    return result


# ---------------------------------------------------------------------------
# Algorithm endpoints
# ---------------------------------------------------------------------------

@router.post("/algorithms/brandes")
def algo_brandes(req: BrandesRequest):
    """
    Run Brandes' betweenness centrality and return full step trace.
    Complexity: O(V·E).
    """
    if not req.adj:
        raise HTTPException(status_code=422, detail="Empty adjacency map.")
    return brandes_betweenness(req.adj)


@router.post("/algorithms/bfs")
def algo_bfs(req: BFSRequest):
    """Run BFS from source and return step trace. Complexity: O(V+E)."""
    return bfs(req.adj, req.source)


@router.post("/algorithms/dfs")
def algo_dfs(req: DFSRequest):
    """Run DFS from source and return step trace. Complexity: O(V+E)."""
    return dfs(req.adj, req.source)


@router.post("/algorithms/dijkstra")
def algo_dijkstra(req: DijkstraRequest):
    """Run Dijkstra from source (optionally to target). Complexity: O((V+E)logV)."""
    return dijkstra(req.adj, req.source, req.target)


@router.post("/algorithms/knapsack-intervention")
def algo_knapsack(req: KnapsackRequest):
    """
    0/1 Knapsack DP for budget-constrained node vaccination.
    Complexity: O(N·W).
    """
    if not req.nodes:
        raise HTTPException(status_code=422, detail="No nodes provided.")
    return knapsack_dp(req.nodes, req.budget)


@router.post("/algorithms/greedy-intervention")
def algo_greedy(req: GreedyRequest):
    """
    Greedy centrality-based node selection.
    Complexity: O(N log N).
    """
    if not req.nodes:
        raise HTTPException(status_code=422, detail="No nodes provided.")
    return greedy_centrality(req.nodes, req.budget)


# ---------------------------------------------------------------------------
# Simulation endpoint
# ---------------------------------------------------------------------------

@router.post("/simulate/sir")
def simulate_sir(req: SIRRequest):
    """
    Run a stochastic SIR simulation and return time-series + per-node states.
    """
    if not req.adj:
        raise HTTPException(status_code=422, detail="Empty graph.")
    if not req.seed_nodes:
        # Default: pick node 0 as patient zero
        req.seed_nodes = [int(list(req.adj.keys())[0])]

    return run_sir(
        adj=req.adj,
        beta=req.beta,
        gamma=req.gamma,
        seed_nodes=req.seed_nodes,
        vaccinated_nodes=req.vaccinated_nodes,
        max_steps=req.max_steps,
        rng_seed=req.rng_seed,
    )


@router.post("/geo/pipeline")
def geo_pipeline(req: GeoPipelineRequest):
    """
    Run the entire DAA epidemic spread analysis pipeline on a geographic coordinate graph:
    1. Proximity contact graph construction
    2. Brandes betweenness centrality ranking
    3. 0/1 Knapsack DP optimal vaccination selection
    4. SIR epidemic simulation comparison (before/after vaccination)
    """
    try:
        locs_dict = [loc.model_dump() for loc in req.locations]
        result = run_geo_pipeline(
            locations=locs_dict,
            proximity_radius=req.proximity_radius,
            budget=req.budget,
            beta=req.beta,
            gamma=req.gamma,
            seed_nodes=req.seed_nodes
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
