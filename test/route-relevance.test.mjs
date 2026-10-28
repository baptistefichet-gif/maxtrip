import test from "node:test";
import assert from "node:assert/strict";
import { applyConnectionRelevance } from "../lib/route-relevance.mjs";

const direct = (returns = [{ key: "back-direct" }]) => ({
  key: "direct", destination: "AIX EN PROVENCE TGV", changes: 0,
  departureMinutes: 600, arrivalMinutes: 780, returns
});
const indirect = (returns = [{ key: "back-indirect" }]) => ({
  key: "indirect", destination: "AIX EN PROVENCE TGV", changes: 1,
  departureMinutes: 630, arrivalMinutes: 840, returns
});

test("hides a dominated indirect while preserving access to it", () => {
  const result = applyConnectionRelevance([direct(), indirect()], { enabled: true });
  assert.deepEqual(result.visible.map(route => route.key), ["direct"]);
  assert.deepEqual(result.suppressed.map(route => route.key), ["indirect"]);
});

test("return required prevents hiding an indirect when the direct has no compatible return", () => {
  const result = applyConnectionRelevance([direct([]), indirect([{ key: "back-indirect" }])], {
    enabled: true, returnRequired: true
  });
  assert.deepEqual(result.visible.map(route => route.key), ["indirect"]);
  assert.equal(result.suppressed.length, 0);
});

test("show all restores every alternative", () => {
  const result = applyConnectionRelevance([direct(), indirect()], {
    enabled: true, showAllConnections: true
  });
  assert.equal(result.visible.length, 2);
  assert.equal(result.suppressed.length, 0);
});


test("keeps journeys to distinct stations of the same city", () => {
  const result = applyConnectionRelevance([direct(), { ...indirect(), destination: "AIX EN PROVENCE CENTRE" }], { enabled: true });
  assert.equal(result.visible.length, 2);
  assert.equal(result.suppressed.length, 0);
});

test("includes departures at exactly sixty minutes and excludes sixty-one", () => {
  const atBoundary = { ...indirect(), departureMinutes: 660 };
  const outside = { ...indirect(), key: "outside", departureMinutes: 661 };
  const result = applyConnectionRelevance([direct(), atBoundary, outside], { enabled: true });
  assert.deepEqual(result.suppressed.map(route => route.key), ["indirect"]);
  assert.ok(result.visible.some(route => route.key === "outside"));
});

test("keeps a faster journey with a connection", () => {
  const result = applyConnectionRelevance([direct(), { ...indirect(), arrivalMinutes: 779 }], { enabled: true });
  assert.equal(result.visible.length, 2);
});
