/**
 * 300 virtuális felhasználó: publikus hirdetéslista (feed / kereső).
 *
 * Futtatás (Vercel — ajánlott először):
 *   ./tools/k6/k6 run -e BASE_URL=https://bymy.vercel.app scripts/load-listings-search.k6.js
 *
 * Éles (csak ha kéred):
 *   ./tools/k6/k6 run -e BASE_URL=https://bymy.hu scripts/load-listings-search.k6.js
 *
 * Gyorsabb / kisebb próba:
 *   ./tools/k6/k6 run -e BASE_URL=https://bymy.vercel.app -e VUS=50 -e HOLD=30s scripts/load-listings-search.k6.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = String(__ENV.BASE_URL || "https://bymy.vercel.app").replace(/\/$/, "");
const VUS = Math.max(1, Number(__ENV.VUS || 300) || 300);
const RAMP = __ENV.RAMP || "30s";
const HOLD = __ENV.HOLD || "90s";
const DOWN = __ENV.DOWN || "20s";

const failRate = new Rate("listing_search_fail");
const listingDuration = new Trend("listing_search_duration", true);

export const options = {
  scenarios: {
    search_feed: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: RAMP, target: VUS },
        { duration: HOLD, target: VUS },
        { duration: DOWN, target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.1"],
    http_req_duration: ["p(95)<3000"],
    listing_search_fail: ["rate<0.15"],
  },
};

const VERTICALS = ["auto", "ingatlan", "teher", ""];

export default function () {
  const vertical = VERTICALS[Math.floor(Math.random() * VERTICALS.length)];
  let path = "/api/listings?limit=50&status=feladott";
  if (vertical) path += `&vertical=${encodeURIComponent(vertical)}`;

  const url = `${BASE_URL}${path}`;
  const res = http.get(url, {
    tags: { name: "GET /api/listings" },
    timeout: "30s",
  });

  listingDuration.add(res.timings.duration);

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "json listings": (r) => {
      try {
        const body = r.json();
        return Array.isArray(body?.listings);
      } catch {
        return false;
      }
    },
  });

  failRate.add(!ok);
  // Tipikus böngésző: pár másodperc nézelődés / következő keresés
  sleep(1 + Math.random() * 2);
}
