"""Loopback-only allowlist gateway for the disposable mobile stand."""
import os
from pathlib import Path
from urllib.parse import unquote

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response, FileResponse
import uvicorn

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
checklist = Path(os.environ['INVENTORY_STAND_DIR']) / 'checklist.html'

@app.api_route('/{path:path}', methods=['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
async def forward(path: str, request: Request):
    decoded = unquote(path)
    # Reject alternate encodings, traversal and all private harness controls.
    if decoded != path or '..' in path or '\\' in path or path.startswith('__'):
        return Response(status_code=404)
    if path == 'mobile-checklist' and request.method in {'GET', 'HEAD'}:
        return FileResponse(checklist, media_type='text/html')
    if path.startswith('api/'):
        allowed = (
            path in {'api/v1/backoffice/auth/login', 'api/v1/backoffice/auth/refresh'} and request.method == 'POST'
            or path == 'api/v1/backoffice/auth/me' and request.method == 'GET'
            or path.startswith('api/v1/backoffice/inventory/') and request.method in {'GET', 'POST', 'PUT'}
            or (path == 'api/v1/backoffice/products' or path.startswith('api/v1/backoffice/products/')) and request.method == 'GET'
            or path == 'api/v1/public/masters' and request.method == 'GET'
        )
        if not allowed:
            return Response(status_code=404)
        base = 'http://127.0.0.1:58002/'
    else:
        if request.method not in {'GET', 'HEAD'} or path in {'docs', 'redoc', 'openapi.json'}:
            return Response(status_code=404)
        base = 'http://127.0.0.1:4043/'
    headers = {key: value for key, value in request.headers.items() if key.lower() not in {'host', 'connection', 'content-length', 'accept-encoding'}}
    async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
        result = await client.request(request.method, base + path, params=request.query_params, headers=headers, content=await request.body())
    response_headers = {key: value for key, value in result.headers.items() if key.lower() not in {'content-encoding', 'transfer-encoding', 'connection', 'content-length'}}
    response_headers['X-Robots-Tag'] = 'noindex, nofollow'
    response_headers['Cache-Control'] = 'no-store' if path.startswith('api/') else response_headers.get('Cache-Control', 'no-cache')
    return Response(result.content, status_code=result.status_code, headers=response_headers)

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8089)
