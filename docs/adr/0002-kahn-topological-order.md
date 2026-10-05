# 0002. Kahn's algorithm for ordering and cycle detection

Status: Accepted
Date: 2026-10-06

## Context

The engine must run each node after all nodes that feed it, and the Validate action must report whether the graph is a DAG. A graph with a cycle has no valid execution order and must be rejected before any LLM call is made.

## Decision

`backend/graph.py` implements Kahn's algorithm in `topological_order(node_ids, edge_pairs)`. It builds in-degree counts and adjacency lists, starts a queue with the zero in-degree nodes, and pops nodes while decrementing successors. If the resulting order has fewer nodes than the input, the graph has a cycle and the function returns `None`. `has_cycle()` is `topological_order(...) is None`.

The same function serves `POST /pipelines/parse` (`is_dag`) and `engine.run_pipeline` (the execution order, or `run_error` when `None`). Edges that mention an unknown node id are ignored. The module is pure, with no I/O, and is unit tested in `backend/tests/test_graph_and_engine.py`.

## Consequences

- One pass yields both the order and the cycle check, so the two cannot disagree.
- It is iterative. A recursive depth-first search could hit Python's recursion limit on a long chain; Kahn's algorithm cannot. The engine also caps pipelines at 50 nodes (`MAX_NODES`).
- The order among independent nodes follows the input node order, not a priority. It is deterministic but not tuned.
- Nodes run strictly one at a time. Running independent branches in parallel is on the README roadmap and would need level grouping on top of this sort.
- The result says that a cycle exists, not where. [TK: whether the UI should highlight the nodes on the cycle.]
