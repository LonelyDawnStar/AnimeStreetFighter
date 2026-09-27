import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, step, INPUT } from "../public/engine.mjs";
import { ultimateScene } from "../public/renderer.mjs";

function ready(chars = ["acheron", "boothill"]) {
  const state = createMatch({ chars, training: true });
  state.phase = "fight";
  state.players[0].x = 150;
  state.players[1].x = 810;
  state.players.forEach(p => { p.meter = 100; });
  return state;
}
function until(state, condition, masks = [0, 0], limit = 350) {
  for (let n = 0; n < limit; n++) {
    if (condition()) return;
    step(state, masks);
  }
  assert.fail("Combat state did not reach the expected phase");
}

test("Acheron's eclipse spans activation, all three fresh attacks, and final recovery", () => {
  const state = ready(), p = state.players[0];
  assert.equal(ultimateScene(state), null);
  step(state, [INPUT.ULT, 0]);
  assert.equal(ultimateScene(state)?.type, "acheron");
  until(state, () => p.empower && p.action === "idle");
  for (let i = 0; i < 3; i++) {
    for (let wait = 0; wait < 25; wait++) {
      step(state, [0, 0]);
      assert.equal(ultimateScene(state)?.amount, 1, "waiting between attacks keeps the transformed stage");
    }
    step(state, [INPUT.LIGHT, 0]);
    until(state, () => p.action !== "empoweredLight");
    assert.equal(p.empower.used, i + 1);
    assert.equal(ultimateScene(state)?.type, "acheron");
  }
  until(state, () => p.action === "finisher");
  assert.equal(ultimateScene(state).priority, 400);
  until(state, () => p.actionFrame >= p.actionDuration - 12);
  assert.ok(ultimateScene(state).amount > 0 && ultimateScene(state).amount < 1, "recovery fades back to the stage");
  until(state, () => !p.empower);
  assert.equal(ultimateScene(state), null);
});

test("Boothill's western scene ends with the cast and respects interruption snapshots", () => {
  const state = ready(["boothill", "saber"]), p = state.players[0];
  step(state, [INPUT.ULT, 0]);
  until(state, () => p.actionFrame >= 24);
  assert.equal(ultimateScene(state)?.type, "boothill");
  assert.equal(ultimateScene(state)?.amount, 1);
  const interrupted = structuredClone(state);
  interrupted.players[0].action = "hurt";
  assert.equal(ultimateScene(interrupted), null);
  until(state, () => p.actionFrame >= p.actionDuration - 10);
  assert.ok(ultimateScene(state).amount < .5);
  until(state, () => p.action !== "ultimate");
  assert.equal(ultimateScene(state), null);
});

test("simultaneous casts share deterministic priority, then return to Acheron's active form", () => {
  const state = ready();
  step(state, [INPUT.ULT, INPUT.ULT]);
  assert.equal(ultimateScene(state)?.slot, 0, "same-priority casts use authoritative player order");
  until(state, () => state.players[0].empower && state.players[0].action === "idle");
  assert.equal(ultimateScene(state)?.type, "boothill", "an actual cast takes priority over an idle empowered form");
  until(state, () => state.players[1].action !== "ultimate");
  assert.equal(ultimateScene(state)?.type, "acheron");
  const snapshot = structuredClone(state), before = JSON.stringify(snapshot);
  assert.equal(ultimateScene(snapshot)?.amount, 1, "a reconnected client immediately reconstructs the eclipse");
  assert.equal(JSON.stringify(snapshot), before, "scene selection never mutates snapshots");
  const final = structuredClone(state);
  Object.assign(final.players[0], { action: "finisher", actionFrame: 22, actionDuration: 72 });
  Object.assign(final.players[1], { action: "ultimate", actionFrame: 48, actionDuration: 114 });
  assert.equal(ultimateScene(final)?.type, "acheron", "the final cut remains visible during competing casts");
});

test("interrupted activation, KO, and round changes cannot retain a cinematic background", () => {
  const state = ready();
  step(state, [INPUT.ULT, 0]);
  until(state, () => state.players[0].actionFrame >= 25);
  const interrupted = structuredClone(state);
  interrupted.players[0].action = "hurt";
  assert.equal(ultimateScene(interrupted), null, "an interrupted activation has no empowered form to keep");
  until(state, () => state.players[0].empower);
  for (const phase of ["roundover", "countdown", "ended"]) {
    const reset = structuredClone(state); reset.phase = phase;
    assert.equal(ultimateScene(reset), null, `no scene during ${phase}, even with a stale player payload`);
  }
  const ko = structuredClone(state); ko.players[0].hp = 0;
  assert.equal(ultimateScene(ko), null);
  const hurt = structuredClone(state); hurt.players[0].action = "hurt";
  assert.equal(ultimateScene(hurt)?.type, "acheron", "ordinary damage does not cancel unused charges");
  hurt.players[0].empower = null;
  assert.equal(ultimateScene(hurt), null, "an interrupted finisher with cleared charges immediately restores the stage");
});
