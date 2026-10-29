import test from "node:test";
import assert from "node:assert/strict";
import { stationKey, stationCoordinatesFor } from "../lib/station-geocoding.mjs";

test("matches TGV Haute Picardie despite word order", () => {
  const coordinates = { "HAUTE PICARDIE TGV": { lat: 49.8, lon: 2.8 } };
  assert.deepEqual(stationCoordinatesFor("TGV HAUTE PICARDIE", coordinates), coordinates["HAUTE PICARDIE TGV"]);
});
test("normalizes accents, apostrophes and spacing", () => {
  assert.equal(stationKey("Besançon-Franche-Comté TGV"), "BESANCON FRANCHE COMTE TGV");
});
test("never invents coordinates for an unknown station", () => {
  assert.equal(stationCoordinatesFor("GARE INCONNUE", { "LYON PART DIEU": { lat: 1, lon: 2 } }), null);
});
test("does not pick a coordinate when station token aliases are ambiguous", () => {
  assert.equal(stationCoordinatesFor("TGV HAUTE PICARDIE", {
    "HAUTE PICARDIE TGV": { lat: 1, lon: 2 },
    "PICARDIE HAUTE TGV": { lat: 3, lon: 4 }
  }), null);
});
