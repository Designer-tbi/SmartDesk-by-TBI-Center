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

# Timeout configuration for long-running API calls.
TIMEOUT = httpx.Timeout(120.0)


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
    url = f"{NODE_UPSTREAM}/{full_path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    body = await request.body()
    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in {"host", "content-length", "accept-encoding"}
    }

    # Use a fresh client for each request to avoid cookie leakage between users.
    # This is critical for security - we don't want one user's session cookie
    # to be sent with another user's request.
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            upstream = await client.request(
                request.method,
                url,
                headers=headers,
                content=body,
            )
        except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError):
            # Node server is probably hot-reloading — retry a couple of times
            # before giving up so a brief restart window doesn't surface as a
            # 500 to the user.
            import asyncio

            upstream = None
            for attempt in range(5):
                await asyncio.sleep(0.4)
                try:
                    upstream = await client.request(
                        request.method,
                        url,
                        headers=headers,
                        content=body,
                    )
                    break
                except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError):
                    continue
            if upstream is None:
                return Response(
                    content=b'{"error":"Serveur en cours de redemarrage, reessayez."}',
                    status_code=503,
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
