"""
FastAPI proxy that forwards all requests to the Node.js server running on port 3000.
This allows the existing Node/Express/Vite application to work inside the Emergent
Kubernetes environment where /api/* paths are routed to port 8001.
"""
import os
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse

NODE_UPSTREAM = os.environ.get("NODE_UPSTREAM", "http://127.0.0.1:3000")

app = FastAPI(title="SmartDesk API Proxy")

# Shared async client with generous timeouts for long-running API calls.
_client = httpx.AsyncClient(base_url=NODE_UPSTREAM, timeout=httpx.Timeout(120.0))


@app.on_event("shutdown")
async def _shutdown() -> None:
    await _client.aclose()


HOP_BY_HOP = {
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "upgrade",
}


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(full_path: str, request: Request) -> Response:
    url = f"/{full_path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    body = await request.body()
    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in {"host", "content-length"}
    }

    try:
        upstream = await _client.request(
            request.method,
            url,
            headers=headers,
            content=body,
        )
    except httpx.ConnectError:
        return Response(
            content=b'{"error":"Upstream Node server unavailable"}',
            status_code=502,
            media_type="application/json",
        )

    resp_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in HOP_BY_HOP
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=resp_headers,
    )
