import test from "node:test";
import assert from "node:assert/strict";
import { geocodeHungaryAddress } from "./geocode.mjs";

test("geocodeHungaryAddress: 7083 Tolnanémedi pin", async () => {
  const hit = await geocodeHungaryAddress({
    query: "Tovarosi Ind 57., 7083 Tolnanémedi, Magyarország",
    addressLines: ["Tovarosi Ind 57.", "7083 Tolnanémedi"],
  });
  assert.ok(hit, "várható találat");
  assert.ok(Math.abs(hit.lat - 46.72) < 0.15, `lat=${hit.lat}`);
  assert.ok(Math.abs(hit.lon - 18.49) < 0.15, `lon=${hit.lon}`);
});
