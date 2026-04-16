// Stress test — Push the API to its limits to find breaking points
// Run: `docker compose run --rm k6 run /scripts/stress.test.js`
// Run this test after work hours or in an isolated environment

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

export const options = {
  stages: [
    { duration: "2m", target: 50 }, // Rapid increase to 50 VUs
    { duration: "3m", target: 50 }, // Hold 50 VUs — sustained stress
    { duration: "2m", target: 100 }, // Push up to 100 VUs
    { duration: "3m", target: 100 }, // Keep 100 VUs — high stress
    { duration: "2m", target: 150 }, // Peak load
    { duration: "3m", target: 150 }, // Keep peak
    { duration: "3m", target: 0 }, // Recovery — check if the API recovers automatically
  ],

  thresholds: {
    // Stress test: threshold is wider than load test
    http_req_failed: ["rate<0.1"], // < 10% error is acceptable when under stress.
    http_req_duration: ["p(95)<3000"], // 95% < 3s
    errors: ["rate<0.1"],
  },
};

export default function () {
  // Stress testing focuses on the most demanding endpoints.

  // 1. Search with filters — heavy database queries
  const searchRes = http.get(
    `${BASE_URL}/api/v1/jobs?page=1&limit=20&keyword=engineer&location=hanoi`
  );
  const searchOk = check(searchRes, {
    "search status ok": (r) => r.status < 500, // Accept 4xx, reject 5xx.
  });
  errorRate.add(!searchOk);

  sleep(0.5);

  // 2. Health endpoint — if this is also slow, the server is overloaded.
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  const healthOk = check(healthRes, {
    "health ok": (r) => r.status === 200,
    "health nhanh < 200ms": (r) => r.timings.duration < 200,
  });
  errorRate.add(!healthOk);

  sleep(0.5);
}
