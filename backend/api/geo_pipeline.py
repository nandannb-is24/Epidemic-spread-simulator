import math
import random
import networkx as nx
from backend.algorithms.brandes import brandes_betweenness
from backend.algorithms.intervention import knapsack_dp
from backend.simulation.sir import run_sir

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth (in km)."""
    R = 6371.0  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lng1_rad = math.radians(lng1)
    lat2_rad = math.radians(lat2)
    lng2_rad = math.radians(lng2)
    
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    
    a = (math.sin(dlat / 2) ** 2) + (math.cos(lat1_rad) * math.cos(lat2_rad) * (math.sin(dlng / 2) ** 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def run_geo_pipeline(
    locations: list[dict],
    proximity_radius: float = 5.0,
    budget: int = 10,
    beta: float = 0.4,
    gamma: float = 0.08,
    seed_nodes: list[int] = None,
) -> dict:
    """
    Build a contact network from geographic locations, run Brandes centrality,
    select vaccinated nodes via 0/1 Knapsack DP, and run SIR simulations
    with and without intervention.
    """
    N = len(locations)
    if N == 0:
        raise ValueError("Empty location list.")
        
    G = nx.Graph()
    for i in range(N):
        G.add_node(i)

    # Add edges based on proximity
    for i in range(N):
        for j in range(i + 1, N):
            dist = haversine_distance(
                locations[i]["lat"], locations[i]["lng"],
                locations[j]["lat"], locations[j]["lng"]
            )
            if dist <= proximity_radius:
                # Weight is inversely proportional to distance
                w = round(1.0 / (dist + 0.1), 2)
                G.add_edge(i, j, weight=w)

    # Ensure single connected component for nicer simulations
    if N > 1 and not nx.is_connected(G):
        components = list(nx.connected_components(G))
        # Sort components to make connection logic deterministic
        components = [list(c) for c in components]
        components.sort(key=lambda c: min(c))
        
        for c_idx in range(len(components) - 1):
            comp1 = components[c_idx]
            comp2 = components[c_idx + 1]
            min_dist = float("inf")
            best_pair = None
            for u in comp1:
                for v in comp2:
                    dist = haversine_distance(
                        locations[u]["lat"], locations[u]["lng"],
                        locations[v]["lat"], locations[v]["lng"]
                    )
                    if dist < min_dist:
                        min_dist = dist
                        best_pair = (u, v)
            if best_pair:
                u, v = best_pair
                w = round(1.0 / (min_dist + 0.1), 2)
                G.add_edge(u, v, weight=w)

    # Prepare adjacency map
    adj: dict[str, dict[str, float]] = {str(n): {} for n in G.nodes()}
    edges = []
    for u, v, data in G.edges(data=True):
        w = data["weight"]
        edges.append({"source": int(u), "target": int(v), "weight": w})
        adj[str(u)][str(v)] = w
        adj[str(v)][str(u)] = w

    # Calculate costs (linear scale 1-10 based on population)
    pops = [loc.get("population", 100) for loc in locations]
    min_pop, max_pop = min(pops), max(pops)
    pop_range = max_pop - min_pop
    
    nodes_list = []
    for i, loc in enumerate(locations):
        pop = loc.get("population", 100)
        if pop_range > 0:
            # Scale from 1 to 10
            cost = max(1, min(10, int(1 + 9 * (pop - min_pop) / pop_range)))
        else:
            cost = 3  # Default flat cost if all populations are equal
            
        nodes_list.append({
            "id": i,
            "name": loc.get("name", f"Locality {i}"),
            "lat": loc["lat"],
            "lng": loc["lng"],
            "population": pop,
            "cost": cost,
            # Assign dummy layout coords for graph visualizer compatibility
            "x": round(loc["lng"], 4),
            "y": round(loc["lat"], 4)
        })

    # 1. Run Brandes centrality
    brandes_res = brandes_betweenness(adj)
    final_scores = brandes_res["final_scores"]

    # Add centrality value to nodes_list
    knapsack_items = []
    for node in nodes_list:
        n_id = node["id"]
        val = final_scores.get(n_id, 0.0)
        node["value"] = val
        knapsack_items.append({
            "id": n_id,
            "cost": node["cost"],
            "value": val
        })

    # 2. Run Knapsack DP intervention
    dp_res = knapsack_dp(knapsack_items, budget)
    vaccinated_nodes = dp_res["selected_ids"]

    # 3. Run SIR simulations
    if not seed_nodes:
        # Default seed nodes: the top 2 highest centrality nodes (patient zeros)
        sorted_by_cent = sorted(knapsack_items, key=lambda x: x["value"], reverse=True)
        seed_nodes = [x["id"] for x in sorted_by_cent[:2]] if len(sorted_by_cent) >= 2 else [0]

    sim_without = run_sir(
        adj=adj,
        beta=beta,
        gamma=gamma,
        seed_nodes=seed_nodes,
        vaccinated_nodes=[],
        max_steps=100
    )

    sim_with = run_sir(
        adj=adj,
        beta=beta,
        gamma=gamma,
        seed_nodes=seed_nodes,
        vaccinated_nodes=vaccinated_nodes,
        max_steps=100
    )

    # Compile result
    return {
        "graph": {
            "nodes": nodes_list,
            "edges": edges,
            "adj": adj
        },
        "centrality": brandes_res,
        "intervention": dp_res,
        "sim_without": sim_without,
        "sim_with": sim_with,
        "seed_nodes": seed_nodes
    }
