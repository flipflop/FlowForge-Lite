import hmac
import json
import os
import time
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

import providers
from engine import NodeError, run_pipeline
from graph import has_cycle

try:  # local dev only; the Lambda bundle ships without python-dotenv
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = FastAPI(title="FlowForge API")

# In production the page and API share one origin (CloudFront), so CORS is not involved.
# These defaults are the local static dev server; override with a comma-separated list.
origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Origin verification ────────────────────────────────────────────────────────
# The Lambda Function URL is public. CloudFront adds `x-origin-verify: <secret>` to every
# request it forwards; when ORIGIN_VERIFY_SECRET is set, anything without it is rejected, so
# the API is only reachable through the distribution. Unset (local dev) means no check.

def origin_verified() -> bool:
    """True when origin verification is active (so the request came through CloudFront)."""
    return bool(os.getenv("ORIGIN_VERIFY_SECRET"))


@app.middleware("http")
async def verify_origin(request: Request, call_next):
    secret = os.getenv("ORIGIN_VERIFY_SECRET")
    if secret:
        supplied = request.headers.get("x-origin-verify", "")
        if not hmac.compare_digest(supplied.encode(), secret.encode()):
            return JSONResponse({"detail": "Forbidden"}, status_code=403)
    return await call_next(request)


def _strip_port(addr: str) -> str:
    addr = addr.strip()
    if addr.startswith("["):  # [v6]:port
        return addr[1:].split("]", 1)[0]
    if addr.count(":") == 1:  # v4:port
        return addr.split(":", 1)[0]
    return addr  # bare v4 or bare v6


def client_ip(headers, peer: Optional[str], via_proxy: bool) -> str:
    """Address used for the per-IP rate limit.

    Behind CloudFront the socket peer is the Lambda adapter, so every user would share one
    bucket. When the request is known to come via CloudFront (origin verification active) trust
    CloudFront-Viewer-Address, then the first X-Forwarded-For entry. Otherwise use the peer:
    these headers are client-controlled when no trusted proxy sits in front.
    """
    if via_proxy:
        viewer = headers.get("cloudfront-viewer-address")
        if viewer:
            return _strip_port(viewer)
        fwd = headers.get("x-forwarded-for")
        if fwd and fwd.split(",")[0].strip():
            return fwd.split(",")[0].strip()
    return peer or "unknown"


# ── Models ─────────────────────────────────────────────────────────────────────

class Node(BaseModel):
    id: str
    type: str = ""
    data: Dict[str, Any] = Field(default_factory=dict)


class Edge(BaseModel):
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


class Pipeline(BaseModel):
    nodes: List[Node]
    edges: List[Edge]


class RunRequest(Pipeline):
    # Bring-your-own keys; used for this request only and never logged or stored.
    api_keys: Dict[str, str] = Field(default_factory=dict)


# ── Rate limiting (server-key runs only) ───────────────────────────────────────

RUNS_PER_HOUR = int(os.getenv("RUNS_PER_HOUR", "10"))
_runs: Dict[str, deque] = defaultdict(deque)


def _allow(ip: str) -> bool:
    now, window = time.time(), _runs[ip]
    while window and now - window[0] > 3600:
        window.popleft()
    if len(window) >= RUNS_PER_HOUR:
        return False
    window.append(now)
    return True


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"status": "ok", "service": "FlowForge API"}


@app.get("/models")
def models():
    return {"models": list(providers.MODELS.keys())}


@app.post("/pipelines/parse")
def parse_pipeline(pipeline: Pipeline):
    """Validate the graph: node/edge counts and whether it is a DAG."""
    node_ids = [n.id for n in pipeline.nodes]
    edge_pairs = [(e.source, e.target) for e in pipeline.edges]
    return {
        "num_nodes": len(node_ids),
        "num_edges": len(edge_pairs),
        "is_dag": not has_cycle(node_ids, edge_pairs),
    }


@app.post("/pipelines/run")
async def run(req: RunRequest, request: Request):
    """Execute the pipeline in topological order, streaming progress as SSE."""
    ip = client_ip(
        request.headers, request.client.host if request.client else None, origin_verified()
    )
    rate_limited = False

    def resolve_key(provider: str) -> str:
        nonlocal rate_limited
        if req.api_keys.get(provider):
            return req.api_keys[provider]
        key = providers.server_key(provider)
        if not key:
            raise NodeError(f"No {provider} API key configured. Add your own key in Settings.")
        if not _allow(ip):
            rate_limited = True
            raise NodeError(
                f"Demo limit reached ({RUNS_PER_HOUR} LLM calls/hour). Add your own key to continue."
            )
        return key

    async def stream():
        async for event in run_pipeline(
            [n.model_dump() for n in req.nodes],
            [e.model_dump() for e in req.edges],
            resolve_key,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
