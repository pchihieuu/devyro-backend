// Spike test — simulates traffic spikes (e.g., viral posts, flash sales)
// Run: docker compose run --rm k6 run /scripts/spike.test.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");
const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

export const options = {
  stages: [
    { duration: "30s", target: 5 },   // Baseline normal
    { duration: "15s", target: 200 }, // SPIKE: Suddenly surges to 200 VUs
    { duration: "1m", target: 200 },  // Hold the spike
    { duration: "15s", target: 5 },   // Drop back to normal
    { duration: "2m", target: 5 },    // Observe recovery
  ],

  thresholds: {
    http_req_failed: ["rate<0.15"],     // Accept a maximum of 15% error rate when spiked.
    http_req_duration: ["p(95)<5000"],  // Spike allows for slower speeds.
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/jobs?page=1&limit=10`);
  const ok = check(res, {
    "status không phải 5xx": (r) => r.status < 500,
  });
  errorRate.add(!ok);

  sleep(1);
}