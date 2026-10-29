import test from "node:test";
import assert from "node:assert/strict";
import { applyConnectionRelevance, selectDiverseJourneys, countHiddenAlternatives, withinMaximumJourneyDuration } from "../lib/route-relevance.mjs";

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

test("hides a connection 15 minutes later, but not 16 minutes later", () => {
  const atBoundary = { ...indirect(), departureMinutes: 615 };
  const outside = { ...indirect(), key: "outside", departureMinutes: 616 };
  const result = applyConnectionRelevance([direct(), atBoundary, outside], { enabled: true });
  assert.deepEqual(result.suppressed.map(route => route.key), ["indirect"]);
  assert.ok(result.visible.some(route => route.key === "outside"));
});

test("keeps a faster journey with a connection", () => {
  const result = applyConnectionRelevance([direct(), { ...indirect(), arrivalMinutes: 779 }], { enabled: true });
  assert.equal(result.visible.length, 2);
});


test("hides a slower connection even when the direct leaves hours later", () => {
  const laterDirect = { ...direct(), departureMinutes: 960, arrivalMinutes: 1080 };
  const earlyConnection = { ...indirect(), departureMinutes: 780, arrivalMinutes: 1140 };
  const result = applyConnectionRelevance([laterDirect, earlyConnection], { enabled: true });
  assert.deepEqual(result.suppressed.map(route => route.key), ["indirect"]);
});

test("keeps earlier connection when direct departs later and arrives later", () => {
  const laterDirect = { ...direct(), departureMinutes: 960, arrivalMinutes: 1200 };
  const earlyConnection = { ...indirect(), departureMinutes: 780, arrivalMinutes: 1140 };
  const result = applyConnectionRelevance([laterDirect, earlyConnection], { enabled: true });
  assert.equal(result.suppressed.length, 0);
});

test("keeps connection if later direct has no compatible return", () => {
  const laterDirect = { ...direct([]), departureMinutes: 960, arrivalMinutes: 1080 };
  const earlyConnection = { ...indirect(), departureMinutes: 780, arrivalMinutes: 1140 };
  const result = applyConnectionRelevance([laterDirect, earlyConnection], { enabled: true, returnRequired: true });
  assert.deepEqual(result.visible.map(route => route.key), ["indirect"]);
});

test("destination coverage is preserved before adding extra routes", () => {
  const journeys = [
    ...Array.from({ length: 12 }, (_, i) => ({ key: "lyon" + i, destination: "LYON", changes: 0, durationMinutes: 100 + i, departureMinutes: i })),
    { key: "narbonne", destination: "NARBONNE", changes: 1, durationMinutes: 190, departureMinutes: 400 },
    { key: "aix", destination: "AIX TGV", changes: 0, durationMinutes: 160, departureMinutes: 500 }
  ];
  const selected = selectDiverseJourneys(journeys, 4);
  assert.equal(new Set(selected.map(j => j.destination)).size, 3);
  assert.equal(selected.length, 4);
  assert.equal(selected[0].key, "lyon0");
});

test("7 hour maximum is inclusive", () => {
  assert.equal(withinMaximumJourneyDuration({ durationMinutes: 420 }), true);
  assert.equal(withinMaximumJourneyDuration({ durationMinutes: 421 }), false);
});
test("hidden alternative count matches selected destination", () => {
  const routes = [{destination:"NARBONNE"},{destination:"LYON"},{destination:"LYON"}];
  assert.equal(countHiddenAlternatives(routes, "Narbonne", value => value), 1);
  assert.equal(countHiddenAlternatives(routes, "Lyon", value => value), 2);
});
