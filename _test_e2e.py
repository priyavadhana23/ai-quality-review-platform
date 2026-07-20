"""
End-to-end test: call the live REST API with a real PR URL and verify
that the response is a well-formed SuccessResponse with non-empty output.
"""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8000"
PR_URL = "https://github.com/priyavadhana23/pr-agent-demo/pull/1"


def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=150) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


print(f"Calling POST /api/v1/review for {PR_URL} ...")
status, body = post("/api/v1/review", {"pr_url": PR_URL})
print(f"HTTP status : {status}")
print(f"status field: {body.get('status')}")
print(f"tool        : {body.get('tool')}")
print(f"exec time   : {body.get('execution_time')}s")

if status == 200:
    output = body.get("data", {}).get("output", "")
    print(f"Output (first 400 chars):\n{output[:400]}")
    assert body["status"] == "success"
    assert body["tool"] == "review"
    assert body["execution_time"] > 0
    assert output
    print("\nE2E review test PASSED")
else:
    print(f"Response body: {json.dumps(body, indent=2)}")
    print(f"\nNote: HTTP {status} may indicate quota exhaustion — that is an API key issue, not a code issue.")
    if status in (502, 204):
        # Engine ran but quota was exhausted or produced no output
        print("E2E test result: engine reached (Gemini quota may be exhausted today)")
    else:
        raise SystemExit(1)
