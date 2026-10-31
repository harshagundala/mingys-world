import test from "node:test";
import assert from "node:assert/strict";
import { chooseLightSources } from "../src/autumn/LocalLighting.tsx";

test("local illumination remains bounded with many nearby sources", () => {
  const sources = Array.from({ length: 100 }, (_, index) => ({
    score: index + 1,
  }));
  assert.equal(chooseLightSources(sources, new Set(), 100).length, 6);
  assert.equal(chooseLightSources(sources, new Set(), 2).length, 2);
  assert.equal(chooseLightSources(sources, new Set(), 0).length, 0);
  assert.equal(sources[0].score, 1, "ranking does not reorder the registry");
});

test("small camera movement cannot churn lamps while a clearly nearer one can replace them", () => {
  const current = { score: 1 };
  const competitor = { score: 1.1 };
  const retained = new Set([current]);
  assert.deepEqual(chooseLightSources([current, competitor], retained, 1), [
    current,
  ]);
  competitor.score = 2;
  assert.deepEqual(chooseLightSources([current, competitor], retained, 1), [
    competitor,
  ]);
});

test("hidden, disabled, or invalid influence cannot reserve a real light slot", () => {
  const dark = { score: 0 };
  const valid = { score: 0.01 };
  assert.deepEqual(
    chooseLightSources(
      [dark, { score: NaN }, { score: Infinity }, valid],
      new Set([dark]),
      6,
    ),
    [valid],
  );
});
