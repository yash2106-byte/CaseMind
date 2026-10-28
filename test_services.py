"""
Script to test both the Backend (Port 3000) and the AI Service (Port 8000).
Run with: python test_services.py
"""

import json
import urllib.request
import urllib.error

def test_endpoint(name, url, method="GET", payload=None):
    print(f"\n--- Testing {name} ({url}) ---")
    headers = {"Content-Type": "application/json"} if payload else {}
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            body = resp.read().decode("utf-8")
            print(f"[SUCCESS {resp.status}]: {body}")
            return True
    except urllib.error.HTTPError as e:
        print(f"[HTTP ERROR {e.code}]: {e.read().decode('utf-8')}")
        return False
    except Exception as e:
        print(f"[CONNECTION ERROR]: {e}")
        return False

if __name__ == "__main__":
    print("==========================================")
    print(" CaseMind Backend (3000) & AI Service (8000)")
    print("==========================================")

    # 1. Backend health (Port 3000)
    test_endpoint("Backend Health", "http://localhost:3000/api/v1/health")

    # 2. AI Service health (Port 8000)
    test_endpoint("AI Service Health", "http://localhost:8000/health")

    # 3. AI Service Classify (Port 8000)
    test_endpoint(
        "AI Classify (NVIDIA Nemotron 3 Ultra)",
        "http://localhost:8000/internal/v1/classify",
        method="POST",
        payload={
            "message": "My Wi-Fi keeps disconnecting every few minutes",
            "allowedIssueTypes": ["internet_connectivity"]
        }
    )

    # 4. AI Service Match Case (Port 8000)
    test_endpoint(
        "AI Match Case",
        "http://localhost:8000/internal/v1/match-case",
        method="POST",
        payload={
            "message": "It is still down like yesterday",
            "candidates": [
                {
                    "caseId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    "title": "Internet connection not working",
                    "problemSummary": "Customer reports no internet access.",
                    "status": "in_progress",
                    "lastContactAt": "2026-10-18T00:00:00Z",
                    "failedStepKeys": ["router_power_cycle"]
                }
            ]
        }
    )

    # 5. AI Service Extract Outcome (Port 8000)
    test_endpoint(
        "AI Extract Outcome",
        "http://localhost:8000/internal/v1/extract-outcome",
        method="POST",
        payload={
            "message": "I tried restarting the router but the internet is still down",
            "currentStepKey": "router_power_cycle"
        }
    )

    print("\n==========================================")
    print(" Verification complete!")
    print("==========================================")
