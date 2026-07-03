// Load test — simulates a normal, real-world user load
// Run: `docker script run --rm k6 run /scripts/load.test.js`

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const jobSearchDuration = new Trend("job_search_duration");
const loginDuration = new Trend("login_duration");
const totalRequests = new Counter("total_requests");

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

export const options = {
  // Ramping stages: increasing → maintaining → decreasing
  stages: [
    { duration: "1m", target: 10 }, // Warm-up: Increase from 0 to 10 VUs in 1 minute
    { duration: "3m", target: 10 }, // Sustained: giữ 10 VUs trong 3 phút (load thực tế)
    { duration: "1m", target: 20 }, // Sustained: Keep 10 VUs for 3 minutes (actual load)
    { duration: "3m", target: 20 }, // Sustained: Keep 20 VUs
    { duration: "1m", target: 0 }, // Cool down: return to 0
  ],

  thresholds: {
    http_req_failed: ["rate<0.05"], // < 5% error
    http_req_duration: ["p(95)<1000", "p(99)<2000"], // 95% requests < 1s, 99% requests < 2s
    errors: ["rate<0.05"],
    login_duration: ["p(95)<800"], // Login must be fast
    job_search_duration: ["p(95)<600"],
  },
};

function getAuthHeaders(token) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
}

function login(email, password) {
  const startTime = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json" } }
  );
  console.log(`Login status: ${res.status}, body: ${res.body}`);
  loginDuration.add(Date.now() - startTime);
  totalRequests.add(1);

  const ok = check(res, {
    "login 200": (r) => r.status === 200,
  });
  errorRate.add(!ok);

  if (!ok) return null;
  try {
    return JSON.parse(res.body).accessToken;
  } catch (e) {
    return null;
  }
}

// Script
export default function () {
  //Each VU simulates one user with a realistic flow.

  group("1. Public — Duyệt jobs", () => {
    // Search jobs
    const startSearch = Date.now();
    const searchRes = http.get(
      `${BASE_URL}/api/v1/jobs?page=1&limit=10&keyword=developer`
    );
    jobSearchDuration.add(Date.now() - startSearch);
    totalRequests.add(1);

    check(searchRes, {
      "search jobs 200": (r) => r.status === 200,
    });

    sleep(1);

    // View details of a job (assuming job ID = 1, replace with actual ID)
    const detailRes = http.get(`${BASE_URL}/api/v1/jobs?page=1&limit=1`);
    totalRequests.add(1);

    if (detailRes.status === 200) {
      try {
        const jobs = JSON.parse(detailRes.body);
        const firstJob =
          (jobs.data && jobs.data[0]) || (jobs.jobs && jobs.jobs[0]);
        if (firstJob && firstJob.id) {
          const jobRes = http.get(`${BASE_URL}/api/v1/jobs/${firstJob.id}`);
          totalRequests.add(1);
          check(jobRes, { "job detail 200": (r) => r.status === 200 });
        }
      } catch (e) {}
    }

    sleep(1);
  });

  group("2. Auth — Login", () => {
    const token = login("user-test@gmail.com", "Hieudz1221");
    if (!token) {
      sleep(2);
      return;
    }

    sleep(1);

    group("3. Authenticated — Profile & Applications", () => {
      // View profile
      const profileRes = http.get(
        `${BASE_URL}/api/v1/users/profile`,
        getAuthHeaders(token)
      );
      totalRequests.add(1);
      check(profileRes, {
        "get profile 200": (r) => r.status === 200 || r.status === 401,
      });

      sleep(1);

      // List of jobs I have applied for
      const appRes = http.get(
        `${BASE_URL}/api/v1/applications?page=1&limit=5`,
        getAuthHeaders(token)
      );
      totalRequests.add(1);
      check(appRes, {
        "applications 200 hoặc 403": (r) =>
          r.status === 200 || r.status === 403,
      });
    });
  });

  sleep(2);
}
