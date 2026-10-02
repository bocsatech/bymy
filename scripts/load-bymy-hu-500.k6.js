/**
 * 500 VU terhelés bymy.hu-ra (members-only éles).
 * Publikus végpontok (200) + listings (401 gate) keveréke.
 *
 *   ./tools/k6/k6 run -e BASE_URL=https://bymy.hu -e VUS=500 scripts/load-bymy-hu-500.k6.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const BASE_URL = String(__ENV.BASE_URL || "https://bymy.hu").replace(/\/$/, "");
const VUS = Math.max(1, Number(__ENV.VUS || 500) || 500);
const RAMP = __ENV.RAMP || "45s";
const HOLD = __ENV.HOLD || "60s";
const DOWN = __ENV.DOWN || "20s";

const failRate = new Rate("bymy_load_fail");
const duration = new Trend("bymy_load_duration", true);
const status2xx = new Counter("bymy_status_2xx");
const status3xx = new Counter("bymy_status_3xx");
const status4xx = new Counter("bymy_status_4xx");
const status5xx = new Counter("bymy_status_5xx");

export const options = {
  scenarios: {
    bymy_500: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: RAMP, target: VUS },
        { duration: HOLD, target: VUS },
        { duration: DOWN, target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    // Members-only: listings 401 várható — fail = 5xx vagy váratlan hiba
    http_req_failed: ["rate<0.2"],
    http_req_duration: ["p(95)<4000"],
    bymy_load_fail: ["rate<0.25"],
    bymy_status_5xx: ["count<50"],
  },
};

const ROUTES = [
  { path: "/api/health", expect: [200], name: "GET /api/health", weight: 3 },
  {
    path: "/api/vehicle-catalog?kind=szemelyauto",
    expect: [200],
    name: "GET /api/vehicle-catalog",
    weight: 4,
  },
  { path: "/data/vehicle-catalog.json", expect: [200], name: "GET /data/catalog", weight: 3 },
  { path: "/css/hub.css", expect: [200], name: "GET /css/hub.css", weight: 2 },
  { path: "/js/mw-app-shell.js", expect: [200], name: "GET /js/shell", weight: 2 },
  { path: "/belepes.html", expect: [200], name: "GET /belepes.html", weight: 2 },
  { path: "/", expect: [200, 302], name: "GET /", weight: 2 },
  // Gate stress — members-only: 401 OK
  {
    path: "/api/listings?limit=20&offset=0&status=feladott&tile=1",
    expect: [200, 401],
    name: "GET /api/listings",
    weight: 5,
  },
  {
    path: "/api/listings?limit=20&offset=20&status=feladott&tile=1&vertical=auto",
    expect: [200, 401],
    name: "GET /api/listings?auto",
    weight: 3,
  },
];

function pickRoute() {
  const total = ROUTES.reduce((s, r) => s + r.weight, 0);
  let n = Math.random() * total;
  for (const r of ROUTES) {
    n -= r.weight;
    if (n <= 0) return r;
  }
  return ROUTES[0];
}

export default function () {
  const route = pickRoute();
  const res = http.get(`${BASE_URL}${route.path}`, {
    tags: { name: route.name },
    timeout: "30s",
    redirects: 0,
  });

  duration.add(res.timings.duration);
  if (res.status >= 500) status5xx.add(1);
  else if (res.status >= 400) status4xx.add(1);
  else if (res.status >= 300) status3xx.add(1);
  else if (res.status >= 200) status2xx.add(1);

  const ok = check(res, {
    "expected status": (r) => route.expect.includes(r.status),
    "no 5xx": (r) => r.status < 500,
  });
  failRate.add(!ok);

  sleep(0.2 + Math.random() * 0.6);
}
