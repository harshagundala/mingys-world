import test from "node:test";
import assert from "node:assert/strict";
import { chooseSeat } from "../server/seats.ts";
test("new browsers receive their preferred available puppy, or the other free puppy", () => {
  assert.equal(chooseSeat({}, [false, false], "first", 1), 1);
  assert.equal(
    chooseSeat({ 0: { id: "first" } }, [true, false], "second", 0),
    1,
  );
  assert.equal(
    chooseSeat({ 1: { id: "first" } }, [false, true], "second", 1),
    0,
  );
});
test("a returning browser keeps its puppy even when both seats are occupied", () => {
  assert.equal(
    chooseSeat(
      { 0: { id: "first" }, 1: { id: "second" } },
      [true, true],
      "second",
      0,
    ),
    1,
  );
});
test("a third browser cannot replace either active puppy", () => {
  assert.equal(
    chooseSeat(
      { 0: { id: "first" }, 1: { id: "second" } },
      [true, true],
      "third",
      0,
    ),
    null,
  );
});
test("a disconnected puppy can be claimed without discarding the saved case", () => {
  assert.equal(
    chooseSeat(
      { 0: { id: "first" }, 1: { id: "second" } },
      [false, true],
      "third",
      1,
    ),
    0,
  );
});
