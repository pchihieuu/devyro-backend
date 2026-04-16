// Smoke test — checks if the API is still alive, loads very lightly
// Run: docker compose run --rm k6 run /scripts/smoke.test.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

//Get BASE_URL from the environment variable (set in docker-compose).
const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

export const options = {
  vus: 1, // 1 virtual user
  duration: "30s", // run for 30 seconds

  thresholds: {
    // The smoke test must pass almost completely.
    http_req_failed: ["rate<0.01"], // < 1% request error
    http_req_duration: ["p(95)<500"], // 95% requests under 500ms
    errors: ["rate<0.01"],
  },
};


function login() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: "test@example.com",
      password: "Test@123456",
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  const success = check(res, {
    "login status 200": (r) => r.status === 200,
    "login có token": (r) => {
      try {
        return JSON.parse(r.body).accessToken !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (!success) return null;

  return JSON.parse(res.body).accessToken;
}

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  const healthOk = check(healthRes, {
    "health check status 200": (r) => r.status === 200,
  });
  errorRate.add(!healthOk);

  sleep(1);

  // 2. List jobs (public endpoint)
  const jobsRes = http.get(`${BASE_URL}/api/v1/jobs?page=1&limit=10`);
  const jobsOk = check(jobsRes, {
    "jobs list status 200": (r) => r.status === 200,
    "jobs list có data": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) || Array.isArray(body.jobs);
      } catch (e) {
        return false;
      }
    },
  });
  errorRate.add(!jobsOk);

  sleep(1);
}
