"""Quick smoke-test for every API endpoint (no GitHub call needed for validation tests)."""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8000"


def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def get(path):
    req = urllib.request.Request(BASE + path, method="GET")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read())


# ── 1. Health check ───────────────────────────────────────────────────────────
status, body = get("/health")
assert status == 200, f"Expected 200 got {status}"
assert body["status"] == "ok"
print(f"PASS  GET /health  → {body}")

# ── 2. Invalid URL validation ─────────────────────────────────────────────────
status, body = post("/api/v1/review", {"pr_url": "not-a-url"})
assert status == 422, f"Expected 422 got {status}: {body}"
print(f"PASS  POST /api/v1/review invalid URL → HTTP {status}: {body.get('status') or body.get('detail','?')}")

# ── 3. Blank question for /ask ────────────────────────────────────────────────
status, body = post("/api/v1/ask", {"pr_url": "https://github.com/a/b/pull/1", "question": "  "})
assert status == 422, f"Expected 422 got {status}: {body}"
print(f"PASS  POST /api/v1/ask blank question → HTTP {status}")

# ── 4. Missing question field ─────────────────────────────────────────────────
status, body = post("/api/v1/ask", {"pr_url": "https://github.com/a/b/pull/1"})
assert status == 422, f"Expected 422 got {status}: {body}"
print(f"PASS  POST /api/v1/ask missing question → HTTP {status}")

# ── 5. Missing pr_url ─────────────────────────────────────────────────────────
status, body = post("/api/v1/improve", {})
assert status == 422, f"Expected 422 got {status}: {body}"
print(f"PASS  POST /api/v1/improve missing pr_url → HTTP {status}")

# ── 6. OpenAPI spec contains all routes ───────────────────────────────────────
_, spec = get("/openapi.json")
paths = list(spec["paths"].keys())
for expected in ["/health", "/api/v1/review", "/api/v1/describe", "/api/v1/improve", "/api/v1/ask"]:
    assert expected in paths, f"Route {expected!r} missing from OpenAPI spec"
print(f"PASS  OpenAPI spec contains all 5 routes: {paths}")

print("\nAll validation smoke-tests passed.")
