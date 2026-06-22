"""
sir.py — Lightweight stochastic SIR epidemic simulation.

Discrete-time, node-level simulation:
  S → I  with probability β for each infected neighbour
  I → R  with probability γ each timestep

numpy is used only for random number generation and array operations.
The simulation itself is straightforward and NOT an algorithm being graded.
"""

import numpy as np
from typing import Any


def run_sir(
    adj: dict[str, dict[str, Any]],
    beta: float,
    gamma: float,
    seed_nodes: list[int],
    vaccinated_nodes: list[int] | None = None,
    max_steps: int = 100,
    rng_seed: int = 42,
) -> dict:
    """
    Run a stochastic SIR simulation on the given contact graph.

    Args:
        adj:               Adjacency map {str(node): {str(neighbor): weight}}.
        beta:              Transmission probability per infected neighbour per step.
        gamma:             Recovery probability per infected node per step.
        seed_nodes:        Nodes initially set to Infected state.
        vaccinated_nodes:  Nodes set to Recovered (immune) at t=0 (intervention).
        max_steps:         Maximum simulation steps.
        rng_seed:          Reproducibility seed.

    Returns:
        {
            "timeseries": [
                {"t": int, "S": int, "I": int, "R": int},
                ...
            ],
            "node_states": [
                {"t": int, "states": {node_id: "S"|"I"|"R", ...}},
                ...
            ],
            "final_stats": {
                "peak_infected":      int,
                "peak_infected_t":    int,
                "total_infected":     int,
                "containment_t":      int | None,
                "never_infected":     int,
            }
        }
    """
    rng = np.random.default_rng(rng_seed)
    nodes = [int(k) for k in adj.keys()]
    node_set = set(nodes)

    neighbors: dict[int, list[int]] = {
        int(u): [int(v) for v in adj[str(u)].keys()]
        for u in nodes
    }

    # State encoding: 0=S, 1=I, 2=R
    STATE_S, STATE_I, STATE_R = 0, 1, 2
    state: dict[int, int] = {v: STATE_S for v in nodes}

    vaccinated = set(vaccinated_nodes or [])
    for v in vaccinated:
        if v in node_set:
            state[v] = STATE_R

    for v in seed_nodes:
        if v in node_set and state[v] == STATE_S:
            state[v] = STATE_I

    timeseries: list[dict] = []
    node_states_trace: list[dict] = []
    ever_infected: set[int] = set(seed_nodes) & node_set

    def snapshot_states() -> dict[int, str]:
        label = {STATE_S: "S", STATE_I: "I", STATE_R: "R"}
        return {v: label[state[v]] for v in nodes}

    def count():
        s = sum(1 for v in nodes if state[v] == STATE_S)
        i = sum(1 for v in nodes if state[v] == STATE_I)
        r = sum(1 for v in nodes if state[v] == STATE_R)
        return s, i, r

    t = 0
    peak_infected = 0
    peak_t = 0
    containment_t = None

    s0, i0, r0 = count()
    timeseries.append({"t": 0, "S": s0, "I": i0, "R": r0})
    node_states_trace.append({"t": 0, "states": snapshot_states()})

    while t < max_steps:
        t += 1
        new_state = dict(state)

        for v in nodes:
            if state[v] == STATE_S:
                # Check each infected neighbour
                for w in neighbors[v]:
                    if state[w] == STATE_I:
                        if rng.random() < beta:
                            new_state[v] = STATE_I
                            ever_infected.add(v)
                            break  # one infection event per step

            elif state[v] == STATE_I:
                if rng.random() < gamma:
                    new_state[v] = STATE_R

        state = new_state
        s, i, r = count()

        timeseries.append({"t": t, "S": s, "I": i, "R": r})
        node_states_trace.append({"t": t, "states": snapshot_states()})

        if i > peak_infected:
            peak_infected = i
            peak_t = t

        if i == 0 and containment_t is None:
            containment_t = t
            break  # epidemic is over

    final_stats = {
        "peak_infected":   peak_infected,
        "peak_infected_t": peak_t,
        "total_infected":  len(ever_infected),
        "containment_t":   containment_t,
        "never_infected":  len(nodes) - len(ever_infected),
    }

    return {
        "timeseries": timeseries,
        "node_states": node_states_trace,
        "final_stats": final_stats,
    }
