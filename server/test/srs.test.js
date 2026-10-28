import assert from "node:assert/strict";
import test from "node:test";
import { GRADUATED_STAGE, isGraduated, nextReview, STAGE_DAYS } from "../src/learning/srs.js";

test("each correct recall waits longer", () => {
  let stage = 0;
  const waits = [];
  for (let i = 0; i < STAGE_DAYS.length; i += 1) {
    const next = nextReview(stage, "know");
    waits.push(next.intervalDays);
    stage = next.stage;
  }
  assert.deepEqual(waits, [3, 7, 14, 30, 60, 120]);
  assert.equal(stage, GRADUATED_STAGE);
  assert.ok(isGraduated(stage));
});

test("graduated words stay at the longest interval", () => {
  assert.deepEqual(nextReview(GRADUATED_STAGE, "know"), { stage: GRADUATED_STAGE, intervalDays: 120 });
});

test("forgot restarts, unsure keeps the step", () => {
  assert.deepEqual(nextReview(4, "forgot"), { stage: 0, intervalDays: 1 });
  assert.deepEqual(nextReview(4, "unsure"), { stage: 4, intervalDays: 2 });
});

test("bad stage values are clamped", () => {
  assert.deepEqual(nextReview(null, "know"), { stage: 1, intervalDays: 3 });
  assert.deepEqual(nextReview(-3, "know"), { stage: 1, intervalDays: 3 });
  assert.deepEqual(nextReview(99, "unsure"), { stage: GRADUATED_STAGE, intervalDays: 2 });
});
