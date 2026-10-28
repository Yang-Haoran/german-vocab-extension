// Spaced repetition with a growing interval ladder.
// Each "know" moves a word one step up; "forgot" sends it back to the start.
// After the last step the word counts as learned ("graduated") and only comes back rarely.

export const STAGE_DAYS = [3, 7, 14, 30, 60, 120];
export const GRADUATED_STAGE = STAGE_DAYS.length;

export function nextReview(stage, result) {
  const current = clampStage(stage);

  if (result === "know") {
    return {
      stage: Math.min(current + 1, GRADUATED_STAGE),
      intervalDays: STAGE_DAYS[Math.min(current, STAGE_DAYS.length - 1)]
    };
  }

  if (result === "unsure") {
    return { stage: current, intervalDays: 2 };
  }

  if (result === "forgot") {
    return { stage: 0, intervalDays: 1 };
  }

  return { stage: current, intervalDays: 0 };
}

export function isGraduated(stage) {
  return clampStage(stage) >= GRADUATED_STAGE;
}

function clampStage(stage) {
  const value = Math.trunc(Number(stage) || 0);
  return Math.min(Math.max(value, 0), GRADUATED_STAGE);
}
