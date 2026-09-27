import test from "node:test";
import assert from "node:assert/strict";
import { createMatch, step, aiInput, INPUT, moves, characters, attackGeometry, mountedMoves, getMove, hurtbox, katjaShotOrigin, magnusBikeShape, KATJA_ART_SCALE, boothillShotOrigin, ARCHER_ARROW_HEIGHT } from "../public/engine.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));
function ready(options = {}) {
  const s = createMatch(options);
  for (let i = 0; i < 150; i++) step(s, [0, 0]);
  assert.equal(s.phase, "fight");
  return s;
}
function frames(s, n, masks = [0, 0]) {
  for (let i = 0; i < n; i++) step(s, masks);
}
function close(s, distance = 100) {
  s.players[0].x = 400;
  s.players[1].x = 400 + distance;
  return s;
}

test("melee has real startup, one active hit, and held keys do not auto-repeat", () => {
  const s = close(ready());
  const hp = s.players[1].hp;
  step(s, [INPUT.LIGHT, 0]);
  assert.equal(s.players[0].actionFrame, 0);
  frames(s, moves.saber.light.startup - 1, [INPUT.LIGHT, 0]);
  assert.equal(s.players[1].hp, hp, "windup must cause no damage");
  step(s, [INPUT.LIGHT, 0]);
  assert.equal(s.players[1].hp, hp - moves.saber.light.damage);
  assert.ok(s.events.some((e) => e.type === "hit"));
  frames(s, 90, [INPUT.LIGHT, 0]);
  assert.equal(
    s.players[1].hp,
    hp - moves.saber.light.damage,
    "a swing only hits once",
  );
  assert.equal(s.players[0].action, "idle");
});

test("active hitboxes require horizontal and vertical contact", () => {
  const far = ready();
  frames(far, 40, [INPUT.HEAVY, 0]);
  assert.equal(far.players[1].hp, far.players[1].maxHp);
  const air = close(ready());
  air.players[1].y = 225;
  air.players[1].vy = 5;
  frames(air, 13, [INPUT.LIGHT, 0]);
  assert.equal(air.players[1].hp, air.players[1].maxHp);
});

test("simultaneous same-frame attacks trade fairly, including double KO", () => {
  const s = close(ready({ chars: ["saber", "saber"] }));
  frames(s, 8, [INPUT.LIGHT, INPUT.LIGHT]);
  assert.deepEqual(
    s.players.map((p) => p.hp),
    [936, 936],
  );
  assert.equal(s.events.filter((e) => e.type === "hit").length, 2);
  assert.deepEqual(
    s.players.map((p) => p.action),
    ["hurt", "hurt"],
  );
  const ko = close(ready({ chars: ["saber", "saber"] }));
  ko.players.forEach((p) => {
    p.hp = 60;
  });
  frames(ko, 8, [INPUT.LIGHT, INPUT.LIGHT]);
  assert.equal(ko.phase, "roundover");
  assert.equal(ko.roundWinner, null);
  assert.equal(ko.roundReason, "draw");
  assert.deepEqual(ko.score, [0, 0]);
  frames(ko, 150);
  assert.equal(ko.round, 1, "a draw replays the same round");
  assert.equal(ko.phase, "countdown");
});

test("guard reduces damage and cannot cause a chip KO", () => {
  const s = close(ready());
  frames(s, 8, [INPUT.LIGHT, INPUT.GUARD]);
  assert.equal(s.players[1].hp, s.players[1].maxHp - 6);
  assert.equal(s.players[1].action, "guard");
  assert.ok(s.events.some((e) => e.type === "block"));
  const low = close(ready());
  low.players[1].hp = 2;
  frames(low, 8, [INPUT.LIGHT, INPUT.GUARD]);
  assert.equal(low.players[1].hp, 1);
  assert.equal(low.phase, "fight");
});

test("hitstop freezes positions, action timeline and round clock", () => {
  const s = close(ready());
  frames(s, 8, [INPUT.LIGHT, 0]);
  const timer = s.timer;
  const positions = s.players.map((p) => [p.x, p.y, p.actionFrame]);
  const duration = s.hitstop;
  assert.ok(duration > 0);
  frames(s, duration, [INPUT.RIGHT, INPUT.LEFT]);
  assert.equal(s.timer, timer);
  assert.deepEqual(
    s.players.map((p) => [p.x, p.y, p.actionFrame]),
    positions,
  );
});

test("confirmed light can cancel into heavy; whiff cannot", () => {
  const s = close(ready());
  frames(s, 8, [INPUT.LIGHT, 0]);
  frames(s, s.hitstop, [0, 0]);
  step(s, [INPUT.HEAVY, 0]);
  assert.equal(s.players[0].action, "heavy");
  assert.equal(s.players[0].actionFrame, 0);
  const far = ready();
  frames(far, 9, [INPUT.LIGHT, 0]);
  step(far, [INPUT.HEAVY, 0]);
  assert.equal(far.players[0].action, "light");
});

test("projectile releases after startup then travels before dealing damage", () => {
  const s = ready({ chars: ["archer", "saber"] });
  step(s, [INPUT.SKILL, 0]);
  frames(s, moves.archer.skill.release - 1);
  assert.equal(s.projectiles.length, 0);
  step(s, [0, 0]);
  assert.equal(s.projectiles.length, 1);
  assert.equal(s.projectiles[0].type, "arrow");
  assert.equal(s.players[1].hp, s.players[1].maxHp);
  frames(s, 30);
  assert.equal(s.players[1].hp, s.players[1].maxHp - moves.archer.skill.damage);
  assert.equal(s.projectiles.length, 0);
});

test("jump clears arrows and lands with a stable floor coordinate", () => {
  const s = ready({ chars: ["archer", "saber"] });
  step(s, [INPUT.SKILL, 0]);
  frames(s, 20);
  step(s, [0, INPUT.JUMP]);
  frames(s, 40);
  assert.equal(s.players[1].hp, s.players[1].maxHp);
  frames(s, 30);
  assert.equal(s.players[1].y, 0);
  assert.equal(s.players[1].vy, 0);
});

function archerKatjaScenario(face, distance, inputAt = () => 0) {
  const s = ready({ chars: ["archer", "katja"] });
  s.players[0].x = face > 0 ? 50 : 910;
  s.players[1].x = s.players[0].x + face * distance;
  const contacts = [], emissions = [];
  let protectedOverlapTicks = 0, airborneClearTicks = 0;
  for (let tick = 0; tick < 170; tick++) {
    step(s, [tick === 0 ? INPUT.SKILL : 0, inputAt(tick)]);
    const p = s.players[1], box = hurtbox(p);
    const arrow = s.projectiles.find(q => q.type === "arrow");
    if (arrow && box.right >= arrow.x - arrow.width / 2 && box.left <= arrow.x + arrow.width / 2) {
      if (p.invuln > 0 && box.top >= arrow.y - arrow.height / 2 && box.bottom <= arrow.y + arrow.height / 2)
        protectedOverlapTicks++;
      if (box.bottom > arrow.y + arrow.height / 2) airborneClearTicks++;
    }
    contacts.push(...s.events.filter(e => ["hit", "block"].includes(e.type) && e.source === "arrow")
      .map(e => ({ ...e, tick, invuln: p.invuln })));
    emissions.push(...s.events.filter(e => e.type === "projectile" && e.projectileType === "arrow"));
  }
  return { s, contacts, emissions, protectedOverlapTicks, airborneClearTicks };
}

test("Archer L reaches the smaller standing Katja at point-blank and full-stage distances in either direction", () => {
  for (const face of [1, -1]) for (const distance of [60, 70, 180, 380, 700, 850]) {
    for (const guard of [false, true]) {
      const r = archerKatjaScenario(face, distance, () => guard ? INPUT.GUARD : 0);
      assert.equal(r.emissions.length, 1);
      assert.equal(r.contacts.length, 1, `${face}/${distance}/${guard}: one arrow must connect`);
      assert.equal(r.contacts[0].type, guard ? "block" : "hit");
      assert.equal(r.contacts[0].damage, guard ? 12 : 119, "damage and guard chip are unchanged");
      assert.equal(r.s.players[1].maxHp - r.s.players[1].hp, guard ? 12 : 119);
    }
  }
});

test("Katja's walking, kneeling Q and recoil E do not silently evade a grounded Caladbolg", () => {
  for (const face of [1, -1]) for (const distance of [180, 380]) {
    const toward = face > 0 ? INPUT.LEFT : INPUT.RIGHT;
    const away = face > 0 ? INPUT.RIGHT : INPUT.LEFT;
    for (const inputAt of [() => toward, () => away,
      tick => tick === 15 ? INPUT.HEAVY : 0, tick => tick === 15 ? INPUT.SKILL : 0]) {
      const r = archerKatjaScenario(face, distance, inputAt);
      assert.equal(r.contacts.length, 1);
      assert.equal(r.contacts[0].damage, 119);
    }
  }
  // These poses have no crouch/duck mechanic; preserve the existing small body.
  assert.equal(characters.katja.hurtWidth, 48.72);
  assert.equal(characters.katja.hurtHeight, 137.76);
});

test("Katja can still jump over Caladbolg while a late jump remains hittable", () => {
  for (const face of [1, -1]) {
    const clear = archerKatjaScenario(face, 380, tick => tick === 18 ? INPUT.JUMP : 0);
    assert.ok(clear.airborneClearTicks > 0, "the arrow actually passes below the airborne body");
    assert.equal(clear.contacts.length, 0);
    assert.equal(clear.s.players[1].hp, clear.s.players[1].maxHp);
    assert.equal(clear.s.players[1].y, 0, "the jump still lands");
    const late = archerKatjaScenario(face, 380, tick => tick === 35 ? INPUT.JUMP : 0);
    assert.equal(late.contacts.length, 1);
    assert.equal(late.contacts[0].damage, 119);
  }
});

test("Katja's dash ignores an overlapping arrow only during its existing invulnerability window", () => {
  for (const face of [1, -1]) {
    const toward = face > 0 ? INPUT.LEFT : INPUT.RIGHT;
    const clear = archerKatjaScenario(face, 190, tick => tick === 28 ? INPUT.DASH | toward : 0);
    assert.ok(clear.protectedOverlapTicks > 0, "the dash crosses the arrow while invulnerable");
    assert.equal(clear.contacts.length, 0);
    const early = archerKatjaScenario(face, 190, tick => tick === 27 ? INPUT.DASH | toward : 0);
    assert.ok(early.protectedOverlapTicks > 0);
    assert.equal(early.contacts.length, 1, "an arrow still overlapping after the window must connect");
    assert.equal(early.contacts[0].invuln, 0);
    assert.equal(early.contacts[0].damage, 119);
  }
});

test("Caladbolg uses a fixed sprite-aligned axis for every target with unchanged projectile dimensions and speed", () => {
  assert.equal(ARCHER_ARROW_HEIGHT, 140);
  for (const char of Object.keys(characters)) for (const face of [1, -1]) {
    const s = ready({ chars: ["archer", char] });
    const p = s.players[0];
    p.x = face > 0 ? 50 : 910;
    s.players[1].x = p.x + face * 700;
    step(s, [INPUT.SKILL, 0]);
    frames(s, moves.archer.skill.release);
    const arrow = s.projectiles[0];
    assert.equal(arrow.y, 140);
    assert.equal(arrow.x, p.x + face * (62 + 17));
    assert.deepEqual([arrow.width, arrow.height, arrow.vx, arrow.life, arrow.damage], [105, 22, face * 17, 84, 119]);
    frames(s, 70);
    assert.equal(s.players[1].maxHp - s.players[1].hp, 119);
  }
});

test("an airborne Archer's arrow retains its release height and does not bend toward grounded Katja", () => {
  const s = ready({ chars: ["archer", "katja"] });
  s.players[0].x = 50;
  s.players[1].x = 750;
  step(s, [INPUT.SKILL, 0]);
  frames(s, moves.archer.skill.release - 1);
  Object.assign(s.players[0], { y: 90, vy: 0, grounded: false });
  step(s, [0, 0]);
  assert.equal(s.projectiles[0].y, 230);
  frames(s, 20);
  assert.equal(s.projectiles[0].y, 230, "the trajectory remains horizontal after emission");
  frames(s, 100);
  assert.equal(s.players[1].hp, s.players[1].maxHp, "height-based misses remain possible");
});

test("dash has a finite invulnerability window and cooldown", () => {
  const s = ready();
  step(s, [INPUT.DASH | INPUT.RIGHT, 0]);
  assert.equal(s.players[0].action, "dash");
  assert.ok(s.players[0].invuln > 0);
  const x = s.players[0].x;
  frames(s, 15);
  assert.ok(s.players[0].x > x);
  assert.equal(s.players[0].invuln, 0);
  step(s, [INPUT.DASH, 0]);
  assert.notEqual(s.players[0].action, "dash");
});

test("ultimates cost meter, freeze the intro, then release distinct attacks", () => {
  for (const char of ["saber", "archer"]) {
    const s = ready({ chars: [char, "saber"] });
    step(s, [INPUT.ULT, 0]);
    assert.notEqual(s.players[0].action, "ultimate");
    frames(s, 10);
    s.players[0].meter = 100;
    step(s, [INPUT.ULT, INPUT.LEFT]);
    assert.equal(s.players[0].meter, 0);
    assert.equal(s.players[0].action, "ultimate");
    assert.ok(s.cinematic);
    const timer = s.timer,
      x = s.players[1].x;
    frames(s, 60, [0, INPUT.LEFT]);
    assert.equal(s.cinematic, null);
    assert.equal(s.players[1].x, x);
    assert.equal(s.timer, timer);
    const hitTypes = new Set();
    for (let i = 0; i < 180; i++) {
      step(s, [0, INPUT.GUARD]);
      for (const e of s.events) {
        if (e.type === "projectile") hitTypes.add(e.projectileType);
        if (e.type === "swing" && e.source) hitTypes.add(e.source);
      }
    }
    assert.ok(hitTypes.has(char === "saber" ? "ult-saber" : "ult-arrow"));
    if (char === "archer") assert.ok(hitTypes.has("ult-finish"));
    assert.equal(s.players[0].action, "idle");
  }
});

test("best of three ends after two wins, with round resets and limited meter carry", () => {
  const s = close(ready());
  s.players[0].meter = 95;
  s.players[1].hp = 1;
  frames(s, 8, [INPUT.LIGHT, 0]);
  assert.equal(s.phase, "roundover");
  assert.deepEqual(s.score, [1, 0]);
  frames(s, 300);
  assert.equal(s.phase, "fight");
  assert.equal(s.round, 2);
  assert.equal(s.players[0].meter, 70);
  close(s);
  s.players[1].hp = 1;
  frames(s, 8, [INPUT.LIGHT, 0]);
  frames(s, 150);
  assert.equal(s.phase, "ended");
  assert.equal(s.winner, 0);
  assert.deepEqual(s.score, [2, 0]);
});

test("timer judges health proportion and training never consumes health or meter", () => {
  const s = ready();
  s.timer = 1;
  s.players[0].hp = 500;
  s.players[1].hp = s.players[1].maxHp / 2;
  step(s, [0, 0]);
  assert.equal(
    s.roundWinner,
    null,
    "equal proportions draw despite different max HP",
  );
  const t = close(ready({ training: true }));
  frames(t, 8, [INPUT.LIGHT, 0]);
  assert.equal(t.players[1].hp, t.players[1].maxHp);
  assert.equal(t.players[0].meter, 100);
  assert.equal(t.players[1].meter, 100);
  assert.equal(t.timer, 90 * 60);
  frames(t, 70);
  step(t, [INPUT.ULT, 0]);
  assert.equal(t.players[0].meter, 100);
});

test("JSON snapshot replay and all AI difficulties are deterministic and pure", () => {
  const s = ready({ seed: 765 }),
    levels = ["easy", "normal", "hard"];
  let copy;
  for (let i = 0; i < 1600; i++) {
    if (i === 500) copy = clone(s);
    const before = JSON.stringify(s);
    const input = [
      aiInput(s, 0, levels[Math.floor(i / 300) % 3]),
      aiInput(s, 1, "hard"),
    ];
    assert.equal(JSON.stringify(s), before, "AI must not mutate snapshot");
    assert.deepEqual(input, [
      aiInput(s, 0, levels[Math.floor(i / 300) % 3]),
      aiInput(s, 1, "hard"),
    ]);
    step(s, input);
    if (copy) {
      step(copy, input);
      assert.deepEqual(copy, s);
    }
    for (const p of s.players) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.x >= 38 && p.x <= 922 && p.y >= 0);
      assert.ok(p.hp >= 0 && p.hp <= p.maxHp && p.meter >= 0 && p.meter <= 100);
    }
  }
});

function advanceTo(s, actionFrame, masks = [0, 0]) {
  for (let i = 0; i < 400 && s.players[0].actionFrame < actionFrame; i++) step(s, masks);
  assert.equal(s.players[0].actionFrame, actionFrame);
}

test("fourteen distinct fighters retain the original four-fighter seeded AI snapshot replay", () => {
  assert.deepEqual(Object.keys(characters), ["saber", "archer", "gilgamesh", "lancer", "medusa", "iskandar", "gojo", "heracles", "allmight", "katja", "magnus", "ambessa", "acheron", "boothill"]);
  const s = ready({ chars: ["gilgamesh", "lancer"], seed: 241 });
  assert.deepEqual(s.players.map(p => p.char), ["gilgamesh", "lancer"]);
  let copy;
  for (let tick = 0; tick < 2400; tick++) {
    if (tick === 400) copy = clone(s);
    const input = [aiInput(s, 0, "hard"), aiInput(s, 1, "normal")];
    step(s, input);
    if (copy) { step(copy, input); assert.deepEqual(copy, s); }
    for (const p of s.players) assert.ok(p.hp >= 0 && p.meter <= 100 && p.x >= 38 && p.x <= 922 && p.y >= 0);
  }
});

test("Saber's giant sword follows the authored hand and blade angle, hitting once without a projectile", () => {
  const s = ready(); s.players[0].meter = 100;
  step(s, [INPUT.ULT, 0]); advanceTo(s, 79);
  const windup = attackGeometry(s.players[0]);
  assert.equal(windup.active, false);
  assert.ok(windup.tip.y > windup.base.y, "the shared authored windup holds the blade above the grip");
  assert.equal(s.players[1].hp, s.players[1].maxHp);
  const hitFrames = [], projectiles = [];
  for (let i = 0; i < 120; i++) {
    step(s, [0, 0]);
    const geometry = attackGeometry(s.players[0]);
    if (geometry?.active) {
      assert.equal(geometry.base.x, s.players[0].x + geometry.hand[0] * 2);
      assert.equal(geometry.base.y, -geometry.hand[1] * 2);
      assert.equal(geometry.length, 380);
    }
    for (const e of s.events) {
      if (e.type === "hit") hitFrames.push(s.players[0].actionFrame);
      if (e.type === "projectile") projectiles.push(e.projectileType);
    }
  }
  assert.equal(hitFrames.length, 1); assert.ok(hitFrames[0] >= 80 && hitFrames[0] <= 93);
  assert.deepEqual(projectiles, []);
  assert.equal(s.players[1].hp, s.players[1].maxHp - 340);
  assert.equal(s.players[0].meter, 0);
  const outside = ready(); outside.players[0].x = 100; outside.players[1].x = 800; outside.players[0].meter = 100;
  step(outside, [INPUT.ULT, 0]); frames(outside, 200);
  assert.equal(outside.players[1].hp, outside.players[1].maxHp, "the sword is finite melee range");
});

test("Gilgamesh J and K are delayed, single traveling weapons", () => {
  for (const [button, moveName, type] of [[INPUT.LIGHT, "light", "gold-sword"], [INPUT.HEAVY, "heavy", "gold-axe"]]) {
    const s = ready({ chars: ["gilgamesh", "saber"] });
    const m = moves.gilgamesh[moveName];
    step(s, [button, 0]); advanceTo(s, m.release - 1);
    assert.equal(s.projectiles.length, 0); assert.equal(s.players[1].hp, 1000);
    step(s, [0, 0]);
    assert.equal(s.projectiles.length, 1); assert.equal(s.projectiles[0].type, type);
    assert.equal(s.players[1].hp, 1000, "a portal does not deal immediate distant damage");
    frames(s, 100, [button, 0]);
    assert.equal(s.players[1].hp, 1000 - m.damage);
  }
});

test("Gilgamesh L emits three seeded weapon choices on separate frames and replays mid-burst", () => {
  const patterns = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = ready({ chars: ["gilgamesh", "saber"], seed });
    s.players[0].x = 100; s.players[1].x = 900;
    step(s, [INPUT.SKILL, 0]);
    const planned = [...s.players[0].cast.weapons]; patterns.add(planned.join(","));
    const emissions = []; let copy;
    for (let i = 0; i < 100; i++) {
      step(s, [0, 0]);
      if (copy) { step(copy, [0, 0]); assert.deepEqual(copy, s); }
      for (const e of s.events) if (e.type === "projectile") emissions.push([s.players[0].actionFrame, e.projectileType]);
      if (s.players[0].actionFrame === 25 && !copy) copy = clone(s);
    }
    assert.deepEqual(emissions.map(e => e[0]), [22, 30, 38]);
    assert.deepEqual(emissions.map(e => e[1]), planned.map(w => `gold-${w}`));
  }
  assert.ok(patterns.size > 1, "seed changes the authored three-weapon sequence");
});

test("Enuma Elish stays directional, has six bounded damage pulses per cast, and resets for a new cast", () => {
  const s = ready({ chars: ["gilgamesh", "saber"] });
  s.players[0].x = 200; s.players[1].x = 650;
  const castIds = [];
  for (let cast = 0; cast < 2; cast++) {
    s.players[0].meter = 100; step(s, [INPUT.ULT, 0]);
    const id = s.players[0].cast.id; castIds.push(id);
    let emissions = 0; const pulses = []; const origins = new Set(); let total = 0;
    for (let i = 0; i < 240; i++) {
      step(s, [INPUT.LEFT, 0]);
      for (const q of s.projectiles) if (q.type === "enuma-beam") {
        assert.equal(q.vx, 0); assert.equal(q.dir, 1); assert.equal(q.castId, id); origins.add(q.originX);
      }
      for (const e of s.events) {
        if (e.type === "projectile" && e.projectileType === "enuma-beam") emissions++;
        if (e.type === "hit" && e.source === "enuma-beam") { pulses.push(e.pulse); total += e.damage; assert.equal(e.castId, id); }
      }
    }
    assert.equal(emissions, 1); assert.equal(origins.size, 1);
    assert.deepEqual(pulses, [0, 1, 2, 3, 4, 5]); assert.equal(total, 360);
    assert.equal(s.players[0].meter, 0);
    step(s, [0, 0]);
  }
  assert.notEqual(castIds[0], castIds[1]);
  assert.equal(s.players[1].hp, 280);
});

test("beam hit ledger survives a snapshot, guard limits chip, and victims behind its origin are safe", () => {
  const s = ready({ chars: ["gilgamesh", "saber"] });
  s.players[0].meter = 100; step(s, [INPUT.ULT, INPUT.GUARD]); advanceTo(s, 94, [0, INPUT.GUARD]);
  const beam = s.projectiles.find(q => q.type === "enuma-beam");
  assert.ok(beam && beam.hitLedger[1].length >= 1);
  const copy = clone(s);
  for (let i = 0; i < 160; i++) { step(s, [0, INPUT.GUARD]); step(copy, [0, INPUT.GUARD]); assert.deepEqual(copy, s); }
  assert.equal(s.players[1].hp, 1000 - 6 * 13);
  const behind = ready({ chars: ["gilgamesh", "saber"] });
  behind.players[0].meter = 100; step(behind, [INPUT.ULT, 0]); advanceTo(behind, 80);
  behind.players[1].x = behind.players[0].x - 100;
  frames(behind, 150);
  assert.equal(behind.players[1].hp, 1000);
});

test("Lancer closes distance with a single dash thrust and has punishable recovery", () => {
  const s = ready({ chars: ["lancer", "saber"] });
  s.players[0].x = 200; s.players[1].x = 550;
  step(s, [INPUT.SKILL, 0]); advanceTo(s, 12);
  assert.equal(s.players[1].hp, 1000);
  assert.ok(s.players[0].x > 200);
  const hits = [];
  for (let i = 0; i < 80; i++) { step(s, [0, 0]); hits.push(...s.events.filter(e => e.type === "hit")); }
  assert.equal(hits.length, 1); assert.equal(s.players[1].hp, 880);
  const recover = ready({ chars: ["lancer", "saber"] });
  recover.players[0].x = 100; recover.players[1].x = 900;
  step(recover, [INPUT.SKILL, 0]); advanceTo(recover, 27);
  assert.equal(recover.players[0].action, "skill"); assert.equal(recover.players[0].invuln, 0);
  recover.players[1].x = recover.players[0].x + 100;
  frames(recover, 8, [0, INPUT.LIGHT]);
  assert.equal(recover.players[0].action, "hurt");
  assert.equal(recover.players[0].hp, characters.lancer.maxHp - moves.saber.light.damage);
});

test("Gae Bolg commits to a fast advancing, rising spear strike and ends in vulnerable recovery", () => {
  const s = ready({ chars: ["lancer", "saber"] });
  s.players[0].x = 120; s.players[1].x = 650; s.players[0].meter = 100;
  step(s, [INPUT.ULT, 0]); advanceTo(s, 71);
  assert.equal(s.players[1].hp, 1000);
  assert.ok(s.players[0].x > 120);
  const hits = []; let maxHeight = 0;
  for (let i = 0; i < 80; i++) {
    step(s, [0, 0]); hits.push(...s.events.filter(e => e.type === "hit")); maxHeight = Math.max(maxHeight, s.players[1].y);
    if (s.players[0].actionFrame === 96) break;
  }
  assert.equal(hits.length, 1); assert.equal(hits[0].source, "ult-lancer");
  assert.equal(s.players[1].hp, 655); assert.ok(maxHeight > 0);
  const g = attackGeometry(s.players[0]); assert.equal(g.active, false); assert.ok(g.tip.y > g.base.y);
  assert.equal(s.players[0].action, "ultimate"); assert.equal(s.players[0].invuln, 0);
  frames(s, 95); assert.equal(s.players[0].action, "idle");
});

test("AI recognizes melee skills and ultimates, then stops guarding their recovery", () => {
  for (const [char, action, activeFrame, recoveryFrame, distance] of [
    ["lancer", "skill", 12, 25, 180],
    ["lancer", "ultimate", 72, 90, 230],
    ["saber", "ultimate", 80, 94, 300],
  ]) {
    let guarded = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const s = ready({ chars: ["archer", char], seed }); s.tick = 160;
      s.players[0].x = 300; s.players[1].x = 300 + distance;
      const foe = s.players[1]; foe.action = action; foe.actionFrame = activeFrame;
      if (aiInput(s, 0, "normal") & INPUT.GUARD) guarded++;
      foe.actionFrame = recoveryFrame;
      assert.equal(aiInput(s, 0, "normal") & INPUT.GUARD, 0, "a spent melee attack is an opening, not an active threat");
    }
    assert.ok(guarded > 0 && guarded < 24, "normal AI sometimes recognizes the telegraph without perfect defense");
  }
});

test("Lancer's long jab grants the defender a counterattack opening instead of a first-hit loop", () => {
  const s = close(ready({ chars: ["lancer", "saber"] }));
  step(s, [INPUT.LIGHT, 0]);
  advanceTo(s, moves.lancer.light.startup);
  assert.equal(s.players[1].hp, 948);
  while (s.hitstop > 0 || s.players[1].hitstun > 0) step(s, [0, 0]);
  assert.equal(s.players[0].action, "light", "long reach carries recovery after the victim can act");
  const hp = s.players[0].hp;
  step(s, [INPUT.LIGHT, INPUT.LIGHT]);
  frames(s, 8);
  assert.equal(s.players[0].hp, hp - moves.saber.light.damage);
  assert.equal(s.players[1].hp, 948, "immediately repeating the jab must lose to the defender's timely answer");
});

function mounted(char, options = {}) {
  const s = ready({ chars: [char, "saber"], ...options });
  s.players[0].meter = 100;
  step(s, [INPUT.ULT, 0]);
  for (let i = 0; !s.players[0].mount && i < 100; i++) step(s, [0, 0]);
  assert.ok(s.players[0].mount);
  return s;
}

test("Medusa and Iskandar foot skills have distinct reach and real startup", () => {
  for (const char of ["medusa", "iskandar"]) {
    const s = close(ready({ chars: [char, "saber"] }), 220);
    const m = moves[char].skill;
    step(s, [INPUT.SKILL, 0]); advanceTo(s, m.startup - 1);
    assert.equal(s.players[1].hp, 1000);
    step(s, [0, 0]);
    assert.equal(s.players[1].hp, 1000 - m.damage);
    assert.equal(s.projectiles.length, 0);
  }
});

test("Rider ultimates spend meter on a short cast and unlock a freely controlled 480-frame form", () => {
  for (const char of ["medusa", "iskandar"]) {
    const s = ready({ chars: [char, "saber"] });
    step(s, [INPUT.ULT, 0]); assert.equal(s.players[0].mount, null);
    frames(s, 10); s.players[0].meter = 100;
    step(s, [INPUT.ULT, 0]);
    assert.equal(s.cinematic.maxLife, 18); assert.equal(s.players[0].meter, 0);
    advanceTo(s, moves[char].ultimate.release - 1);
    assert.equal(s.players[0].mount, null);
    step(s, [0, 0]);
    const p = s.players[0];
    assert.equal(p.mount.remaining, 480); assert.equal(p.mount.duration, 480);
    assert.equal(p.mount.type, char === "medusa" ? "pegasus" : "bucephalus");
    assert.equal(p.action, "idle"); assert.equal(s.players[1].hp, 1000);
    const x = p.x; step(s, [INPUT.RIGHT, 0]);
    assert.equal(p.x - x, mountedMoves[char].speed);
    assert.equal(p.mount.remaining, 479);
    assert.equal(hurtbox(p).top, 245); assert.equal(hurtbox(p).right - hurtbox(p).left, 124);
  }
});

test("mounted duration pauses with hitstop/cinematics and expires exactly on the shared combat clock", () => {
  const s = mounted("medusa"); s.players[0].x = 100; s.players[1].x = 850;
  s.hitstop = 9; frames(s, 9);
  assert.equal(s.players[0].mount.remaining, 480);
  s.players[1].meter = 100; step(s, [0, INPUT.ULT]);
  const remaining = s.players[0].mount.remaining, timer = s.timer;
  frames(s, 60);
  assert.equal(s.players[0].mount.remaining, remaining); assert.equal(s.timer, timer);
  frames(s, remaining - 1);
  assert.equal(s.players[0].mount.remaining, 1);
  step(s, [0, 0]); assert.equal(s.players[0].mount, null);
  assert.equal(s.events.find(e => e.type === "dismount")?.reason, "expired");
});

test("simultaneous short and long ultimate intros cannot skip a Rider's transformation frame", () => {
  const s = ready({ chars: ["iskandar", "archer"] });
  s.players[0].x = 100; s.players[1].x = 900;
  s.players.forEach(p => { p.meter = 100; });
  step(s, [INPUT.ULT, INPUT.ULT]);
  assert.equal(s.cinematic.life, 60);
  frames(s, 60);
  assert.equal(s.players[0].actionFrame, 18); assert.equal(s.players[1].actionFrame, 60);
  for (let i = 0; !s.players[0].mount && i < 30; i++) step(s, [0, 0]);
  assert.ok(s.players[0].mount);
});

test("mounted J/K use their own moves and cannot refill the ultimate meter", () => {
  for (const char of ["medusa", "iskandar"]) for (const [button, name] of [[INPUT.LIGHT, "light"], [INPUT.HEAVY, "heavy"]]) {
    const s = close(mounted(char), 145), m = mountedMoves[char][name];
    step(s, [button, 0]);
    assert.equal(getMove(s.players[0]), m);
    advanceTo(s, m.startup - 1); assert.equal(s.players[1].hp, 1000);
    step(s, [0, 0]); frames(s, 80);
    assert.equal(s.players[1].hp, 1000 - m.damage);
    assert.equal(s.players[0].meter, 0); assert.ok(s.players[0].mount.remaining < 480);
  }
});

test("L and U both request one guardable mounted charge with startup, cooldown, and no recast extension", () => {
  for (const char of ["medusa", "iskandar"]) for (const button of [INPUT.SKILL, INPUT.ULT]) {
    const s = close(mounted(char), 240), p = s.players[0], m = mountedMoves[char].charge;
    const mountId = p.mount.castId;
    step(s, [button, 0]); assert.equal(p.action, "charge");
    const castId = p.cast.id;
    advanceTo(s, m.startup - 1); assert.equal(s.players[1].hp, 1000);
    const hits = [];
    for (let i = 0; i < 90; i++) { step(s, [i % 2 ? button : 0, 0]); hits.push(...s.events.filter(e => e.type === "hit")); }
    assert.equal(hits.length, 1); assert.equal(hits[0].source, "mount-charge"); assert.equal(hits[0].castId, castId);
    assert.equal(s.players[1].hp, 1000 - m.damage); assert.equal(p.mount.castId, mountId);
    assert.ok(p.mount.remaining < 480); assert.equal(p.meter, 0);
    const guarded = close(mounted(char), 240);
    step(guarded, [button, INPUT.GUARD]); frames(guarded, 100, [0, INPUT.GUARD]);
    assert.equal(guarded.players[1].hp, 1000 - Math.round(m.damage * .1));
  }
});

test("mid-charge snapshots preserve hit-once state, remaining form time, and charge cooldown", () => {
  const s = close(mounted("medusa"), 180);
  step(s, [INPUT.SKILL, 0]); advanceTo(s, 15);
  assert.equal(s.players[0].moveConnected, true);
  const copy = clone(s); const hp = s.players[1].hp;
  for (let i = 0; i < 70; i++) { step(s, [0, 0]); step(copy, [0, 0]); assert.deepEqual(copy, s); }
  assert.equal(s.players[1].hp, hp);
  assert.ok(s.players[0].mount.chargeCooldown > 0);
  step(s, [INPUT.ULT, 0]); assert.notEqual(s.players[0].action, "charge");
});

test("expiry cancels an unfinished mounted attack and clears buffered recasts", () => {
  const s = close(mounted("iskandar", { training: true }), 300);
  s.players[0].mount.remaining = 4;
  step(s, [INPUT.ULT, 0]); assert.equal(s.players[0].action, "charge");
  frames(s, 3, [INPUT.ULT, 0]);
  assert.equal(s.players[0].mount, null); assert.equal(s.players[0].action, "idle");
  frames(s, 50, [INPUT.ULT, 0]);
  assert.equal(s.players[0].mount, null, "holding U through expiry cannot silently cast another ultimate");
  assert.equal(s.players[1].hp, 1000);
});

test("interrupted transformation, KO, and round reset leave no mounted state behind", () => {
  const interrupted = close(ready({ chars: ["medusa", "saber"] }));
  interrupted.players[0].meter = 100; step(interrupted, [INPUT.ULT, 0]); advanceTo(interrupted, 24);
  frames(interrupted, 8, [0, INPUT.LIGHT]);
  assert.equal(interrupted.players[0].action, "hurt");
  frames(interrupted, 90); assert.equal(interrupted.players[0].mount, null); assert.ok(interrupted.players[0].meter < 100);
  const ko = close(mounted("medusa"), 110); ko.players[0].hp = 1;
  frames(ko, 8, [0, INPUT.LIGHT]);
  assert.equal(ko.phase, "roundover"); assert.equal(ko.players[0].mount, null); assert.equal(ko.players[0].action, "ko");
  frames(ko, 300); assert.equal(ko.phase, "fight"); assert.ok(ko.players.every(p => p.mount === null));
});

test("both Riders remain deterministic through autonomous mounted fights and dismounts", () => {
  const s = ready({ chars: ["medusa", "iskandar"], seed: 20891, training: true });
  const copy = clone(s); let mountedSeen = [false, false], charges = 0;
  for (let i = 0; i < 2200; i++) {
    const input = [aiInput(s, 0, "normal"), aiInput(s, 1, "hard")];
    step(s, input); step(copy, input); assert.deepEqual(copy, s);
    s.players.forEach((p, j) => { mountedSeen[j] ||= Boolean(p.mount); charges += p.action === "charge" ? 1 : 0; });
  }
  assert.deepEqual(mountedSeen, [true, true]); assert.ok(charges > 0);
});

test("a mounted charge resists stagger only while charging, while still taking full damage", () => {
  for (const [frame, expected] of [[3, "hurt"], [13, "charge"], [32, "hurt"]]) {
    const s = mounted("medusa"); s.players[0].x = 100; s.players[1].x = 900;
    step(s, [INPUT.SKILL, 0]); advanceTo(s, frame);
    const attacker = s.players[1];
    attacker.x = s.players[0].x + 110; attacker.face = -1;
    attacker.action = "light"; attacker.actionFrame = moves.saber.light.startup - 1;
    attacker.actionDuration = moves.saber.light.duration;
    const hp = s.players[0].hp;
    step(s, [0, 0]);
    assert.equal(s.players[0].hp, hp - moves.saber.light.damage);
    assert.equal(s.players[0].action, expected);
  }
});

test("normal AI can read close projectile windup before a point-blank shot is emitted", () => {
  for (const char of ["saber", "archer", "gilgamesh"]) {
    let guardCount = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const s = ready({ chars: ["medusa", char], seed }); s.tick = 160;
      s.players[0].x = 300; s.players[1].x = 450;
      s.players[1].action = "skill"; s.players[1].actionFrame = moves[char].skill.startup - 4;
      assert.equal(s.projectiles.length, 0);
      guardCount += (aiInput(s, 0, "normal") & INPUT.GUARD) ? 1 : 0;
      s.players[1].actionFrame = moves[char].skill.startup + moves[char].skill.active;
      assert.equal(aiInput(s, 0, "normal") & INPUT.GUARD, 0);
    }
    assert.ok(guardCount > 0 && guardCount < 24);
  }
});

test("Gojo's J/K emit distinct delayed zoning orbs that each hit once", () => {
  for (const [button, action, type] of [[INPUT.LIGHT, "light", "blue-orb"], [INPUT.HEAVY, "heavy", "red-orb"]]) {
    const s = ready({ chars: ["gojo", "saber"] }), m = moves.gojo[action];
    step(s, [button, 0]); advanceTo(s, m.startup - 1);
    assert.equal(s.projectiles.length, 0); assert.equal(s.players[1].hp, 1000);
    step(s, [0, 0]); assert.equal(s.projectiles[0].type, type);
    assert.equal(s.players[1].hp, 1000, "the distant opponent is not hit at the caster's release frame");
    frames(s, 100); assert.equal(s.players[1].hp, 1000 - m.damage);
  }
});

test("Blue pulls a struck opponent toward Gojo while guard prevents its displacement", () => {
  for (const guarding of [false, true]) {
    const s = ready({ chars: ["gojo", "saber"] });
    s.players[0].x = 250; s.players[1].x = 850;
    step(s, [INPUT.SKILL, guarding ? INPUT.GUARD : 0]);
    let connected = false;
    for (let i = 0; i < 100; i++) {
      step(s, [0, guarding ? INPUT.GUARD : 0]);
      if (s.events.some(e => e.source === "blue-pull")) {
        connected = true;
        assert.equal(s.players[1].vx, guarding ? 0 : -8);
      }
    }
    assert.equal(connected, true);
    assert.equal(s.players[1].hp, 1000 - (guarding ? 12 : 115));
    if (guarding) assert.equal(s.players[1].x, 850);
    else assert.ok(s.players[1].x < 850);
  }
});

test("Unlimited Void is a finite local stun into Purple, with guard and committed-direction counterplay", () => {
  const s = close(ready({ chars: ["gojo", "saber"] }), 175);
  s.players[0].meter = 100; step(s, [INPUT.ULT, 0]);
  assert.equal(s.cinematic.maxLife, 30);
  advanceTo(s, 59); assert.equal(s.players[1].hitstun, 0);
  step(s, [0, 0]); assert.equal(s.players[1].hitstun, 42); assert.equal(s.players[1].hp, 1000);
  const copy = clone(s);
  for (let i = 0; i < 170; i++) { step(s, [0, 0]); step(copy, [0, 0]); assert.deepEqual(copy, s); }
  assert.equal(s.players[1].hp, 680); assert.equal(s.players[0].meter, 0);
  const guard = close(ready({ chars: ["gojo", "saber"] }), 175);
  guard.players[0].meter = 100; step(guard, [INPUT.ULT, INPUT.GUARD]); frames(guard, 220, [0, INPUT.GUARD]);
  assert.equal(guard.players[1].hp, 930);
  const outside = ready({ chars: ["gojo", "saber"] });
  outside.players[0].x = 200; outside.players[1].x = 850; outside.players[0].meter = 100;
  step(outside, [INPUT.ULT, 0]); advanceTo(outside, 60);
  assert.equal(outside.players[1].hitstun, 0); assert.equal(outside.players[1].hp, 1000);
  const behind = ready({ chars: ["gojo", "saber"] });
  behind.players[0].meter = 100; step(behind, [INPUT.ULT, 0]);
  behind.players[1].x = 38; behind.players[0].x = 500;
  frames(behind, 230);
  assert.equal(behind.players[1].hp, 1000, "the domain is local and Purple does not turn or track behind its caster");
});

test("Heracles' slow advancing slam resists a hit during commitment but can be punished afterward", () => {
  for (const [frame, expected] of [[3, "hurt"], [15, "skill"], [35, "hurt"]]) {
    const s = ready({ chars: ["heracles", "saber"] }); s.players[0].x = 100; s.players[1].x = 900;
    step(s, [INPUT.SKILL, 0]); advanceTo(s, frame);
    const foe = s.players[1]; foe.x = s.players[0].x + 105; foe.face = -1;
    foe.action = "light"; foe.actionFrame = 6; foe.actionDuration = moves.saber.light.duration;
    step(s, [0, 0]);
    assert.equal(s.players[0].hp, characters.heracles.maxHp - 64); assert.equal(s.players[0].action, expected);
  }
  const s = close(ready({ chars: ["heracles", "saber"] }), 280), start = s.players[0].x;
  step(s, [INPUT.SKILL, 0]); advanceTo(s, 25); assert.equal(s.players[1].hp, 1000);
  step(s, [0, 0]); assert.equal(s.players[1].hp, 842); assert.ok(s.players[0].x > start);
  assert.equal(hurtbox(s.players[0]).top, 205); assert.equal(hurtbox(s.players[0]).right - hurtbox(s.players[0]).left, 76);
});

test("Nine Lives is exactly nine bounded melee strikes with a replayable per-cast hit ledger", () => {
  const s = close(ready({ chars: ["heracles", "saber"] }), 175);
  s.players[0].meter = 100; step(s, [INPUT.ULT, 0]); advanceTo(s, 73);
  assert.equal(s.players[1].hp, 1000);
  const hits = []; let copy;
  for (let i = 0; i < 180; i++) {
    step(s, [0, 0]);
    if (copy) { step(copy, [0, 0]); assert.deepEqual(copy, s); }
    hits.push(...s.events.filter(e => e.type === "hit"));
    if (!copy && s.players[0].actionFrame === 99) copy = clone(s);
  }
  assert.deepEqual(hits.map(e => e.pulse), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(hits.reduce((sum, e) => sum + e.damage, 0), 370);
  assert.deepEqual(s.players[0].cast.hitPulses, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(s.players[1].hp, 630); assert.equal(s.players[0].meter, 0);
  assert.equal(s.projectiles.length, 0);
  const blocked = close(ready({ chars: ["heracles", "saber"] }), 175);
  blocked.players[0].meter = 100; step(blocked, [INPUT.ULT, INPUT.GUARD]); frames(blocked, 260, [0, INPUT.GUARD]);
  assert.equal(blocked.players[1].hp, 918);
  const missed = ready({ chars: ["heracles", "saber"] });
  missed.players[0].x = 100; missed.players[1].x = 850; missed.players[0].meter = 100;
  step(missed, [INPUT.ULT, 0]); frames(missed, 240); assert.equal(missed.players[1].hp, 1000);
});

test("Detroit Smash is a short traveling pressure wave, not a full-screen hit", () => {
  for (const distance of [300, 650]) {
    const s = ready({ chars: ["allmight", "saber"] }); s.players[0].x = 150; s.players[1].x = 150 + distance;
    step(s, [INPUT.SKILL, 0]); advanceTo(s, 21); assert.equal(s.players[1].hp, 1000);
    step(s, [0, 0]); assert.equal(s.projectiles[0].type, "detroit-wave");
    frames(s, 100); assert.equal(s.players[1].hp, distance === 300 ? 884 : 1000);
  }
});

test("United States of Smash rushes into one heavy impact with vulnerable recovery", () => {
  const s = ready({ chars: ["allmight", "saber"] }); s.players[0].x = 150; s.players[1].x = 525; s.players[0].meter = 100;
  step(s, [INPUT.ULT, 0]); advanceTo(s, 73);
  assert.ok(s.players[0].x > 150); assert.equal(s.players[1].hp, 1000);
  const copy = clone(s); const hits = [];
  for (let i = 0; i < 130; i++) {
    step(s, [0, 0]); step(copy, [0, 0]); assert.deepEqual(copy, s);
    hits.push(...s.events.filter(e => e.type === "hit"));
  }
  assert.equal(hits.length, 1); assert.equal(hits[0].damage, 365); assert.equal(s.players[1].hp, 635);
  assert.equal(s.players[0].action, "idle"); assert.equal(hurtbox(s.players[0]).top, 201);
  const miss = ready({ chars: ["allmight", "saber"] }); miss.players[0].x = 50; miss.players[1].x = 900; miss.players[0].meter = 100;
  step(miss, [INPUT.ULT, 0]); advanceTo(miss, 92);
  miss.players[1].x = miss.players[0].x + 100;
  frames(miss, 8, [0, INPUT.LIGHT]); assert.equal(miss.players[0].action, "hurt");
  assert.equal(miss.players[0].hp, characters.allmight.maxHp - 64);
});

test("the three new roles remain deterministic against each other without changing Rider state", () => {
  for (const chars of [["gojo", "heracles"], ["heracles", "allmight"], ["allmight", "gojo"]]) {
    const s = ready({ chars, seed: 281 }); const copy = clone(s); let activeTicks = 0;
    for (let i = 0; i < 1400; i++) {
      const masks = [aiInput(s, 0, "normal"), aiInput(s, 1, "hard")];
      step(s, masks); step(copy, masks); assert.deepEqual(copy, s);
      for (const p of s.players) {
        assert.equal(p.mount, null); assert.ok(Number.isFinite(p.x) && p.hp >= 0 && p.hp <= p.maxHp);
        if (["light", "heavy", "skill", "ultimate"].includes(p.action)) activeTicks++;
      }
    }
    assert.ok(activeTicks > 0);
  }
});

test("Katja's sniper has startup, works at point blank, and Q rewards real travel distance", () => {
  const damageAt = (distance, input) => {
    const s = ready({ chars: ["katja", "saber"] }); s.players[0].x = 80; s.players[1].x = 80 + distance;
    step(s, [input, 0]); frames(s, 14); assert.equal(s.players[1].hp, 1000);
    frames(s, 95, [input, 0]); return 1000 - s.players[1].hp;
  };
  assert.equal(damageAt(65, INPUT.LIGHT), 64);
  const near = damageAt(200, INPUT.HEAVY), far = damageAt(760, INPUT.HEAVY);
  assert.ok(near >= 82 && near < far && far <= 142);
});

test("Katja E retreats, applies finite slow/haste only on hit, and cannot ignore its cooldown", () => {
  for (const guard of [false, true]) {
    const s = close(ready({ chars: ["katja", "saber"] }), 190), start = s.players[0].x;
    step(s, [INPUT.SKILL, guard ? INPUT.GUARD : 0]);
    for (let n = 0; n < 70 && !s.events.some(e => ["hit", "block"].includes(e.type)); n++) step(s, [0, guard ? INPUT.GUARD : 0]);
    assert.ok(s.players[0].x < start);
    assert.equal(s.players[1].hp, guard ? 991 : 910);
    assert.equal(Boolean(s.players[1].slow), !guard); assert.equal(Boolean(s.players[0].haste), !guard);
    if (!guard) {
      const before = clone(s.players[1].slow); const cooldown = s.players[0].cooldowns.skill;
      const copy = clone(s); frames(s, s.hitstop); frames(copy, copy.hitstop); assert.deepEqual(s, copy);
      assert.deepEqual(s.players[1].slow, before); assert.equal(s.players[0].cooldowns.skill, cooldown);
      frames(s, 100); assert.equal(s.players[1].slow, null); assert.equal(s.players[0].haste, null);
      step(s, [INPUT.SKILL, 0]); assert.notEqual(s.players[0].action, "skill");
    }
  }
});

test("Katja R is three delayed committed bullets with bounded damage, slow and snapshot replay", () => {
  for (const guard of [false, true]) {
    const s = ready({ chars: ["katja", "saber"] }); s.players[0].x = 100; s.players[1].x = 650; s.players[0].meter = 100;
    step(s, [INPUT.ULT, guard ? INPUT.GUARD : 0]); advanceTo(s, 59, [0, guard ? INPUT.GUARD : 0]);
    assert.equal(s.players[1].hp, 1000); const copy = clone(s); const hits = [];
    for (let i = 0; i < 180; i++) { const input = [0, guard ? INPUT.GUARD : 0]; step(s, input); step(copy, input); assert.deepEqual(copy, s); hits.push(...s.events.filter(e => e.source === "katja-precision")); }
    assert.equal(hits.length, 3); assert.equal(hits.reduce((n, h) => n + h.damage, 0), guard ? 71 : 320);
    assert.equal(s.players[0].meter, 0); assert.equal(s.players[0].cast.emitted.filter(k => k.startsWith("precision-")).length, 3);
  }
});

test("Magnus can move during four bounded spin pulses and strike on both sides", () => {
  const s = close(ready({ chars: ["magnus", "saber"] }), 95);
  step(s, [INPUT.SKILL, 0]); advanceTo(s, 17); const start = s.players[0].x; const hits = [];
  for (let n = 0; n < 105; n++) { step(s, [INPUT.RIGHT, 0]); hits.push(...s.events.filter(e => e.source === "magnus-spin" && e.type === "hit")); }
  assert.ok(s.players[0].x > start); assert.equal(hits.length, 4); assert.equal(1000 - s.players[1].hp, 160);
  assert.deepEqual(s.players[0].cast.hitPulses, [0, 1, 2, 3]);
  const rear = close(ready({ chars: ["magnus", "saber"] }), 95);
  step(rear, [INPUT.SKILL, 0]); advanceTo(rear, 17); rear.players[1].x = rear.players[0].x - 90;
  step(rear, [0, 0]); assert.equal(rear.players[1].hp, 960);
});

test("Magnus bike collision and a second U launch are mutually exclusive single impacts", () => {
  for (const launch of [false, true]) {
    const s = ready({ chars: ["magnus", "saber"] }); s.players[0].x = 80; s.players[1].x = 800; s.players[0].meter = 100;
    step(s, [INPUT.ULT, 0]); advanceTo(s, 58); assert.ok(s.players[0].bike);
    const copy = clone(s), hits = []; const start = s.players[0].x;
    for (let n = 0; n < 180; n++) {
      const masks = [launch && n === 0 ? INPUT.ULT : 0, 0]; step(s, masks); step(copy, masks); assert.deepEqual(copy, s);
      hits.push(...s.events.filter(e => e.type === "hit"));
    }
    assert.equal(hits.length, 1); assert.equal(hits[0].damage, 330);
    assert.equal(hits[0].source, launch ? "magnus-bike" : "ult-magnus-bike");
    assert.equal(s.players[0].bike, null); assert.equal(s.players[0].mount, null); assert.equal(s.players[0].meter, 0);
    if (launch) assert.equal(s.players[0].x, start + Math.min(21, 8 + 9 * .55));
  }
});

test("Ambessa Q2 requires an unblocked Q hit and a new press inside its finite window", () => {
  for (const guard of [false, true]) {
    const s = close(ready({ chars: ["ambessa", "saber"] }), 140);
    step(s, [INPUT.HEAVY, guard ? INPUT.GUARD : 0]); advanceTo(s, 19, [INPUT.HEAVY, guard ? INPUT.GUARD : 0]);
    assert.equal(Boolean(s.players[0].recast), !guard); assert.equal(s.players[0].action, "heavy");
    frames(s, 1, [0, 0]); step(s, [INPUT.HEAVY, 0]);
    assert.equal(s.players[0].action, guard ? "heavy" : "heavyFollow");
    if (!guard) { assert.equal(s.players[0].recast, null); frames(s, 70); assert.equal(s.players[1].hp, 812); }
  }
  const miss = ready({ chars: ["ambessa", "saber"] }); step(miss, [INPUT.HEAVY, 0]); frames(miss, 60); assert.equal(miss.players[0].recast, null);
  const expired = close(ready({ chars: ["ambessa", "saber"] }), 140); step(expired, [INPUT.HEAVY, 0]); frames(expired, 235);
  assert.equal(expired.players[0].recast, null); step(expired, [INPUT.HEAVY, 0]); assert.equal(expired.players[0].action, "heavy");
});

test("Ambessa's brace absorbs bounded damage and empowers only that cast's slam", () => {
  const s = close(ready({ chars: ["ambessa", "saber"] }), 100);
  step(s, [INPUT.SKILL, INPUT.LIGHT]); advanceTo(s, 8);
  assert.equal(s.players[0].hp, characters.ambessa.maxHp); assert.equal(s.players[0].shield.hp, 26);
  assert.equal(s.players[0].cast.shieldCharged, true); assert.equal(s.players[0].action, "skill");
  const copy = clone(s); for (let i = 0; i < 110; i++) { step(s, [0, 0]); step(copy, [0, 0]); assert.deepEqual(copy, s); }
  assert.equal(s.players[1].hp, 855); assert.equal(s.players[0].shield, null);
  const normal = close(ready({ chars: ["ambessa", "saber"] }), 160); step(normal, [INPUT.SKILL, 0]); frames(normal, 90); assert.equal(normal.players[1].hp, 882);
});

test("Ambessa R crosses the opponent, briefly suppresses then finishes once, and full guard works", () => {
  for (const guard of [false, true]) {
    const s = ready({ chars: ["ambessa", "saber"] }); s.players[0].x = 100; s.players[1].x = 530; s.players[0].meter = 100;
    step(s, [INPUT.ULT, guard ? INPUT.GUARD : 0]); const hits = []; let sawSuppression = false, crossed = false;
    for (let n = 0; n < 260; n++) {
      step(s, [0, guard ? INPUT.GUARD : 0]); hits.push(...s.events.filter(e => ["hit", "block"].includes(e.type)));
      sawSuppression ||= Boolean(s.players[1].suppressed); crossed ||= Boolean(s.players[0].cast?.grab) && s.players[0].x > s.players[1].x;
    }
    assert.ok(crossed); assert.equal(sawSuppression, !guard); assert.equal(hits.length, 2);
    assert.equal(hits.reduce((n, h) => n + h.damage, 0), guard ? 72 : 325);
    assert.equal(s.players[1].suppressed, null); assert.equal(s.players[0].meter, 0);
  }
});

test("new statuses share the paused combat clock and round reset clears temporary resources", () => {
  const s = ready({ chars: ["ambessa", "magnus"] });
  const p = s.players[0]; p.slow = { remaining: 2, multiplier: .6 }; p.recast = { action: "heavyFollow", remaining: 2, castId: 44 };
  p.shield = { hp: 20, remaining: 2, castId: 44 }; p.cooldowns.skill = 2;
  s.hitstop = 3; frames(s, 3); assert.equal(p.slow.remaining, 2); assert.equal(p.cooldowns.skill, 2);
  s.cinematic = { owner: 1, owners: [1], ownerFrames: { 1: 3 }, life: 3, maxLife: 3 }; frames(s, 3);
  assert.equal(p.shield.remaining, 2); frames(s, 2); assert.equal(p.slow, null); assert.equal(p.recast, null); assert.equal(p.shield, null); assert.equal(p.cooldowns.skill, 0);
  p.slow = { remaining: 100, multiplier: .6 }; p.shield = { hp: 50, remaining: 50, castId: 5 }; s.timer = 1;
  step(s, [0, 0]); assert.equal(s.phase, "roundover"); assert.equal(p.shield, null); assert.equal(p.slow, null); assert.deepEqual(p.cooldowns, {});
});

test("all twelve AI choices stay deterministic with new skills and serializable transient states", () => {
  for (const chars of [["katja", "magnus"], ["magnus", "ambessa"], ["ambessa", "katja"]]) {
    const s = ready({ chars, seed: 817 }); const copy = clone(s); let attacks = 0;
    for (let n = 0; n < 1600; n++) {
      const input = [aiInput(s, 0, "normal"), aiInput(s, 1, "hard")]; step(s, input); step(copy, input); assert.deepEqual(copy, s);
      attacks += s.events.filter(e => ["hit", "block"].includes(e.type)).length;
      for (const p of s.players) assert.ok(Number.isFinite(p.x) && p.hp >= 0 && p.meter <= 100);
    }
    assert.ok(attacks > 0);
  }
});

test("slow changes movement rather than only a HUD timer and expires on the exact combat step", () => {
  const s = ready({ chars: ["katja", "saber"] }); s.players[0].x = 100;
  const p = s.players[0]; p.slow = { remaining: 3, multiplier: .5 };
  step(s, [INPUT.RIGHT, 0]); assert.equal(p.x, 100 + characters.katja.speed * .5);
  step(s, [INPUT.RIGHT, 0]); const x = p.x;
  step(s, [INPUT.RIGHT, 0]); assert.equal(p.slow, null); assert.equal(p.x, x + characters.katja.speed);
});

test("both sides of Magnus' spin can be guarded and one bike impact chips only once", () => {
  const spin = close(ready({ chars: ["magnus", "saber"] }), 95);
  step(spin, [INPUT.SKILL, INPUT.GUARD]); advanceTo(spin, 17, [0, INPUT.GUARD]); spin.players[1].x = spin.players[0].x - 90;
  step(spin, [0, INPUT.GUARD]); assert.equal(spin.players[1].hp, 996);
  const bike = ready({ chars: ["magnus", "saber"] }); bike.players[0].x = 100; bike.players[1].x = 650; bike.players[0].meter = 100;
  step(bike, [INPUT.ULT, INPUT.GUARD]); const blocks = [];
  for (let n = 0; n < 240; n++) { step(bike, [0, INPUT.GUARD]); blocks.push(...bike.events.filter(e => e.type === "block")); }
  assert.equal(blocks.length, 1); assert.equal(bike.players[1].hp, 927);
  assert.equal(bike.players[0].bike, null); assert.equal(bike.players[0].cast.emitted.filter(k => k === "bike-finish").length, 1);
});

test("Ambessa's Q2 window survives a snapshot, while shield overflow still damages its owner", () => {
  const s = close(ready({ chars: ["ambessa", "heracles"] }), 150); step(s, [INPUT.HEAVY, 0]); advanceTo(s, 20);
  const copy = clone(s);
  for (let n = 0; n < 80; n++) { const masks = [n === 3 ? INPUT.HEAVY : 0, 0]; step(s, masks); step(copy, masks); assert.deepEqual(copy, s); }
  assert.equal(s.players[0].recast, null); assert.equal(s.players[1].hp, characters.heracles.maxHp - 188);
  const shield = close(ready({ chars: ["ambessa", "heracles"] }), 150);
  step(shield, [0, INPUT.HEAVY]); frames(shield, 3); step(shield, [INPUT.SKILL, 0]); advanceTo(shield, 25);
  assert.equal(shield.players[0].shield, null);
  assert.equal(shield.players[0].hp, characters.ambessa.maxHp - 60);
});

test("a whiffed Ambessa ultimate does not suppress globally or produce its follow-up", () => {
  const s = ready({ chars: ["ambessa", "saber"] }); s.players[0].x = 80; s.players[1].x = 900; s.players[0].meter = 100;
  step(s, [INPUT.ULT, 0]); frames(s, 210);
  assert.equal(s.players[1].hp, 1000); assert.equal(s.players[1].suppressed, null);
  assert.equal(s.players[0].cast.grab, undefined); assert.equal(s.players[0].action, "idle");
  assert.equal(s.players[0].cast.emitted.includes("finisher"), false);
});

test("Katja's six firing origins match the authored muzzle in both facing directions", () => {
  // Independent native-foot anchor measurements from v6/katja-fire-anchors.json.
  const poses = { light: [73.78, -77.57], heavy: [66.49, -49.19], skill: [42.39, -62.99],
    ultimate: [[61.19, -51.64], [53.43, -48.66], [60, -52.54]] };
  for (const face of [-1, 1]) for (const [action, button] of [["light", INPUT.LIGHT], ["heavy", INPUT.HEAVY], ["skill", INPUT.SKILL], ["ultimate", INPUT.ULT]]) {
    const s = ready({ chars: ["katja", "saber"] });
    s.players[0].x = face > 0 ? 150 : 810; s.players[1].x = face > 0 ? 880 : 80;
    s.players[0].meter = 100; s.players[1].invuln = 500;
    step(s, [button, 0]); const releases = moves.katja[action].releases ?? [moves.katja[action].release];
    for (const [sequence, frame] of releases.entries()) {
      advanceTo(s, frame);
      const p = s.players[0], measured = action === "ultimate" ? poses.ultimate[sequence] : poses[action];
      const emitted = s.events.find(e => e.type === "projectile"), origin = katjaShotOrigin(p, action, sequence);
      assert.ok(emitted); assert.equal(p.face, face);
      assert.ok(Math.abs(emitted.x - (p.x + face * measured[0] * 2 * KATJA_ART_SCALE)) < .00001);
      assert.ok(Math.abs(emitted.y - (p.y - measured[1] * 2 * KATJA_ART_SCALE)) < .00001);
      assert.equal(emitted.x, origin.x); assert.equal(emitted.y, origin.y);
      const q = s.projectiles.at(-1);
      assert.ok(Math.abs(q.x - q.vx - origin.x) < .00001);
      assert.ok(Math.abs(q.y - (q.vy ?? 0) - origin.y) < .00001);
      if (action === "ultimate") {
        const flash = s.effects.find(e => e.type === "katja-muzzle" && e.life === 8);
        assert.equal(flash.x, origin.x); assert.equal(flash.y, origin.y);
      }
    }
  }
});

test("Katja's smaller art and body retain the floor anchor and use the same one-time scale", () => {
  const s = ready({ chars: ["katja", "saber"] }), p = s.players[0], box = hurtbox(p);
  assert.equal(KATJA_ART_SCALE, .84); assert.equal(p.y, 0); assert.equal(box.bottom, 8);
  assert.equal(box.top, 164 * .84); assert.ok(Math.abs(box.right - box.left - 58 * .84) < .00001);
  const ground = katjaShotOrigin(p, "light"); p.y = 60;
  assert.equal(katjaShotOrigin(p, "light").y, ground.y + 60);
});

test("Magnus' tire contacts at the authored front and detaching preserves the visible chassis bounds", () => {
  for (const face of [-1, 1]) {
    const s = ready({ chars: ["magnus", "saber"] }); s.players[0].x = 480; s.players[1].x = 480 + face * 260; s.players[0].meter = 100;
    step(s, [INPUT.ULT, 0]); advanceTo(s, 50);
    assert.equal(s.players[1].hp, 1000, "the tire has not yet reached the opponent");
    const initial = s.players[0].x, victimNear = s.players[1].x - face * 29;
    assert.ok((victimNear - (initial + face * magnusBikeShape.front)) * face > 0);
    step(s, [0, 0]);
    assert.equal(s.players[1].hp, 670, "one forward step brings the front wheel into contact");
    assert.ok((s.players[0].x + face * magnusBikeShape.front - victimNear) * face >= 0);
    assert.equal(s.players[0].bike, null);

    const detached = ready({ chars: ["magnus", "saber"] });
    detached.players[0].x = face > 0 ? 80 : 880; detached.players[1].x = face > 0 ? 890 : 70; detached.players[0].meter = 100;
    step(detached, [INPUT.ULT, 0]); advanceTo(detached, 58); step(detached, [INPUT.ULT, 0]);
    const p = detached.players[0], q = detached.projectiles.find(projectile => projectile.type === "magnus-bike");
    assert.ok(q); const emittedX = q.x - q.vx;
    // Atlas opaque bounds: x[-85,+87], y[-87,+1] native pixels about its ground pivot.
    assert.equal(q.width, 344); assert.equal(q.height, 176); assert.equal(q.y, 86);
    assert.equal(emittedX, p.x + face * 54);
    assert.equal(q.y - q.height / 2, -2); assert.equal(q.y + q.height / 2, 174);
    assert.ok(Math.abs((emittedX + face * q.width / 2) - (p.x + face * 228)) <= 2,
      "detaching keeps the wheel front in place within the authored pivot's one-pixel asymmetry");
  }
});

function until(s, predicate, masks = [0, 0], limit = 600) {
  for (let n = 0; n < limit && !predicate(s); n++) step(s, masks);
  assert.ok(predicate(s), "expected combat state reached within the bounded timeline");
}
function awakened(distance = 200, training = false) {
  const s = close(ready({ chars: ["acheron", "saber"], training }), distance);
  s.players[0].meter = 100; step(s, [INPUT.ULT, 0]);
  until(s, state => state.players[0].empower && state.players[0].action === "idle");
  return s;
}

test("Acheron's basic, advancing technique and lightning skill have distinct delayed contacts", () => {
  for (const [button, startup, damage, distance] of [[INPUT.LIGHT, 7, 66, 115], [INPUT.HEAVY, 19, 140, 300], [INPUT.SKILL, 23, 142, 230]]) {
    const s = close(ready({ chars: ["acheron", "saber"] }), distance), start = s.players[0].x;
    step(s, [button, 0]); advanceTo(s, startup - 1); assert.equal(s.players[1].hp, 1000);
    frames(s, 90, [button, 0]); assert.equal(1000 - s.players[1].hp, damage);
    if (button === INPUT.HEAVY) assert.ok(s.players[0].x > start + 50);
    else assert.equal(s.players[0].x, start);
  }
});

test("Acheron U grants three fresh-press attacks, consumes on active, then finishes exactly once", () => {
  const s = awakened(); const p = s.players[0];
  assert.equal(p.empower.charges, 3); assert.equal(s.players[1].hp, 1000); assert.equal(p.meter, 0);
  step(s, [INPUT.LIGHT, 0]); advanceTo(s, 11, [INPUT.LIGHT, 0]); assert.equal(p.empower.charges, 3);
  step(s, [INPUT.LIGHT, 0]); assert.equal(p.empower.charges, 2);
  frames(s, 150, [INPUT.LIGHT, 0]); assert.equal(p.empower.charges, 2); assert.equal(p.damageDealt, 74);
  frames(s, 1); step(s, [INPUT.LIGHT, 0]); until(s, state => state.players[0].action === "idle");
  assert.equal(p.empower.charges, 1); assert.equal(p.damageDealt, 148);
  step(s, [INPUT.LIGHT, 0]); const copy = clone(s), hits = []; let finisherStarts = 0, previous = p.action;
  for (let n = 0; n < 210; n++) {
    step(s, [INPUT.LIGHT, 0]); step(copy, [INPUT.LIGHT, 0]); assert.deepEqual(s, copy);
    if (p.action === "finisher" && previous !== "finisher") finisherStarts++;
    previous = p.action; hits.push(...s.events.filter(e => e.type === "hit"));
  }
  assert.equal(finisherStarts, 1); assert.equal(hits.filter(e => e.source === "ult-acheron-stygian").length, 1);
  assert.equal(p.damageDealt, 388); assert.equal(p.empower, null); assert.equal(p.meter, 0);
});

test("interrupting an empowered windup preserves the unused charge and holding J cannot retry it", () => {
  const s = awakened(90); step(s, [INPUT.LIGHT, INPUT.LIGHT]); frames(s, 80, [INPUT.LIGHT, INPUT.LIGHT]);
  assert.equal(s.players[0].empower.charges, 3); assert.equal(s.players[0].damageDealt, 0);
  assert.equal(s.players[0].hp, characters.acheron.maxHp - 64);
  step(s, [0, 0]); step(s, [INPUT.LIGHT, 0]); until(s, state => state.players[0].empower.charges === 2);
  assert.equal(s.players[0].damageDealt, 74);
});

test("the third spent charge queues one finisher across interruption and reconnect snapshots", () => {
  const s = awakened(); const p = s.players[0];
  for (let n = 0; n < 2; n++) { step(s, [INPUT.LIGHT, 0]); until(s, state => state.players[0].action === "idle"); }
  s.players[1].x = 910; p.x = 200;
  step(s, [INPUT.LIGHT, 0]); advanceTo(s, 12); assert.equal(p.empower.charges, 0); assert.equal(p.empower.finisherPending, true);
  advanceTo(s, 17);
  s.players[1].x = p.x + 85; step(s, [0, INPUT.LIGHT]); until(s, state => state.players[0].action === "hurt");
  assert.equal(p.empower.finisherPending, true);
  const copy = clone(s); let starts = 0, previous = p.action; const hits = [];
  for (let n = 0; n < 200; n++) {
    step(s, [INPUT.LIGHT, 0]); step(copy, [INPUT.LIGHT, 0]); assert.deepEqual(s, copy);
    if (p.action === "finisher" && previous !== "finisher") starts++;
    previous = p.action; hits.push(...s.events.filter(e => e.source === "ult-acheron-stygian"));
  }
  assert.equal(starts, 1); assert.equal(hits.length, 1); assert.equal(hits[0].damage, 166); assert.equal(p.empower, null);
});

test("Acheron's mode cannot be refreshed, guards all four hits, and clears pending finishers at round end", () => {
  const training = awakened(220, true), castId = training.players[0].empower.castId;
  frames(training, 380, [INPUT.ULT, 0]); assert.equal(training.players[0].empower.castId, castId); assert.equal(training.players[0].empower.charges, 3);
  const s = awakened(190);
  for (let n = 0; n < 3; n++) { step(s, [INPUT.LIGHT, INPUT.GUARD]); until(s, state => state.players[0].action === "idle", [0, INPUT.GUARD]); }
  until(s, state => !state.players[0].empower, [0, INPUT.GUARD]);
  assert.equal(s.players[1].hp, 915);
  const pending = awakened(); pending.players[0].empower.charges = 0; pending.players[0].empower.finisherPending = true;
  pending.players[0].hitstun = 20; pending.players[0].action = "hurt"; pending.timer = 1;
  step(pending, [0, 0]); assert.equal(pending.phase, "roundover"); assert.equal(pending.players[0].empower, null);
  frames(pending, 151); assert.ok(pending.players.every(p => p.empower === null));
});

test("Boothill's single gunshot zones while his heel kick only reaches nearby opponents", () => {
  const s = ready({ chars: ["boothill", "saber"] }); s.players[0].x = 100; s.players[1].x = 700;
  step(s, [INPUT.LIGHT, 0]); advanceTo(s, 10); assert.equal(s.projectiles.length, 0); assert.equal(s.players[1].hp, 1000);
  frames(s, 100, [INPUT.LIGHT, 0]); assert.equal(s.players[1].hp, 944);
  const kick = close(ready({ chars: ["boothill", "saber"] }), 120); step(kick, [INPUT.HEAVY, 0]); frames(kick, 85);
  assert.equal(kick.players[1].hp, 890); assert.ok(kick.players[1].x > 520);
  const miss = ready({ chars: ["boothill", "saber"] }); step(miss, [INPUT.HEAVY, 0]); frames(miss, 85); assert.equal(miss.players[1].hp, 1000);
});

test("Boothill's finite duel grants one three-shot burst per J press and exposes both fighters", () => {
  const s = ready({ chars: ["boothill", "saber"] }); s.players[0].x = 100; s.players[1].x = 650;
  step(s, [INPUT.SKILL, 0]); advanceTo(s, 19); assert.equal(s.players[0].duel, null);
  step(s, [0, 0]); assert.equal(s.players[0].duel.remaining, 300); assert.equal(s.players[1].hp, 1000);
  until(s, state => state.players[0].action === "idle"); step(s, [INPUT.LIGHT, 0]); const copy = clone(s), shots = [];
  for (let n = 0; n < 140; n++) { step(s, [INPUT.LIGHT, 0]); step(copy, [INPUT.LIGHT, 0]); assert.deepEqual(s, copy); shots.push(...s.events.filter(e => e.projectileType === "boothill-fanning")); }
  assert.equal(shots.length, 3); assert.equal(s.players[1].hp, 913); assert.equal(s.players[0].meter, 9);
  s.players[1].x = s.players[0].x + 90; step(s, [0, INPUT.LIGHT]); frames(s, 35);
  assert.equal(s.players[0].hp, characters.boothill.maxHp - 70);
  const original = s.players[0].duel.castId; step(s, [INPUT.SKILL, 0]); frames(s, 10); assert.equal(s.players[0].duel.castId, original);
  until(s, state => !state.players[0].duel); assert.ok(s.players[0].cooldowns.skill > 0);
  step(s, [INPUT.LIGHT, 0]); assert.equal(s.players[0].action, "light");
});

test("Boothill's golden ultimate is a guardable single shot with finite slow and weakness", () => {
  for (const guard of [false, true]) {
    const s = ready({ chars: ["boothill", "saber"] }); s.players[0].x = 100; s.players[1].x = 650; s.players[0].meter = 100;
    step(s, [INPUT.ULT, guard ? INPUT.GUARD : 0]); advanceTo(s, 67, [0, guard ? INPUT.GUARD : 0]); assert.equal(s.players[1].hp, 1000);
    until(s, state => state.players[1].hp < 1000, [0, guard ? INPUT.GUARD : 0]);
    assert.equal(s.players[1].hp, guard ? 932 : 690); assert.equal(Boolean(s.players[1].slow), !guard); assert.equal(Boolean(s.players[1].exposed), !guard);
    const copy = clone(s); for (let n = 0; n < 20; n++) { step(s, [0, 0]); step(copy, [0, 0]); assert.deepEqual(s, copy); }
    if (!guard) {
      until(s, state => state.players[0].action === "idle"); step(s, [INPUT.LIGHT, 0]); until(s, state => state.players[0].damageDealt > 310);
      assert.equal(s.players[0].damageDealt, 373);
    }
    frames(s, 180); assert.equal(s.players[1].slow, null); assert.equal(s.players[1].exposed, null);
  }
});

test("duel and weakness pause on the shared clock, do not double-stack in mirrors, and reset", () => {
  const s = close(ready({ chars: ["boothill", "boothill"] }), 300);
  step(s, [INPUT.SKILL, INPUT.SKILL]); until(s, state => state.players.every(p => p.action === "idle"));
  const remaining = s.players[0].duel.remaining; s.hitstop = 5; frames(s, 5); assert.equal(s.players[0].duel.remaining, remaining);
  step(s, [INPUT.LIGHT, 0]); frames(s, 90); assert.equal(s.players[1].hp, characters.boothill.maxHp - 87);
  s.players[1].exposed = { remaining: 20, multiplier: 1.12 }; s.timer = 1; step(s, [0, 0]);
  assert.ok(s.players.every(p => !p.duel && !p.exposed));
});

test("both new roles and fourteen-character snapshots replay deterministically with real empowerment and duels", () => {
  const s = ready({ chars: ["acheron", "boothill"], seed: 302 }); s.players.forEach(p => { p.meter = 100; });
  const copy = clone(s); let empowered = false, dueling = false, hits = 0;
  for (let n = 0; n < 2600; n++) {
    const masks = [aiInput(s, 0, "hard"), aiInput(s, 1, "hard")]; step(s, masks); step(copy, masks); assert.deepEqual(s, copy);
    empowered ||= Boolean(s.players[0].empower); dueling ||= Boolean(s.players[1].duel);
    hits += s.events.filter(e => e.type === "hit").length;
    for (const p of s.players) assert.ok(Number.isFinite(p.x) && p.hp >= 0 && p.meter <= 100);
  }
  assert.ok(empowered && dueling && hits > 0);
});

test("Ambessa Q2 is a long ground strike while W can strike an opponent behind her", () => {
  const q = close(ready({ chars: ["ambessa", "saber"] }), 140);
  step(q, [INPUT.HEAVY, 0]); advanceTo(q, 20); step(q, [INPUT.HEAVY, 0]);
  assert.equal(q.players[0].action, "heavyFollow");
  q.players[1].x = q.players[0].x + 235; q.players[1].y = 185; q.players[1].vy = 5;
  const hp = q.players[1].hp; advanceTo(q, 16); assert.equal(q.players[1].hp, hp, "the low slam misses an airborne body");
  const w = close(ready({ chars: ["ambessa", "saber"] }), 140);
  step(w, [INPUT.SKILL, 0]); advanceTo(w, 21); w.players[1].x = w.players[0].x - 160;
  step(w, [0, 0]); assert.equal(w.players[1].hp, 882);
});

test("Ambessa's real grab lifts during suppression and the finisher returns the target to the floor", () => {
  const s = ready({ chars: ["ambessa", "saber"] }); s.players[0].x = 100; s.players[1].x = 540; s.players[0].meter = 100;
  step(s, [INPUT.ULT, 0]); until(s, state => state.players[1].suppressed);
  assert.equal(s.players[1].vy, 9); assert.equal(s.players[1].grounded, false);
  const copy = clone(s); let sawLift = false, sawSlam = false;
  for (let n = 0; n < 100; n++) {
    step(s, [0, INPUT.JUMP]); step(copy, [0, INPUT.JUMP]); assert.deepEqual(s, copy);
    if (s.players[1].suppressed && s.players[1].y > 20) sawLift = true;
    if (s.events.some(e => e.source === "ult-ambessa-finish")) {
      sawSlam = true; assert.equal(s.players[1].y, 0); assert.equal(s.players[1].vy, 0); assert.equal(s.players[1].grounded, true);
    }
  }
  assert.ok(sawLift && sawSlam); assert.equal(s.players[1].hp, 675);
  const guarded = ready({ chars: ["ambessa", "saber"] }); guarded.players[0].x = 100; guarded.players[1].x = 540; guarded.players[0].meter = 100;
  step(guarded, [INPUT.ULT, INPUT.GUARD]);
  for (let n = 0; n < 220; n++) { step(guarded, [0, INPUT.GUARD]); assert.equal(guarded.players[1].y, 0); assert.equal(guarded.players[1].suppressed, null); }
  assert.equal(guarded.players[1].hp, 928);
});

test("Ambessa's final chain-blade tips and attack reach agree without changing body scale", () => {
  for (const face of [-1, 1]) for (const [action, measuredTip] of [["heavy", 160.70], ["heavyFollow", 207.94]]) {
    assert.ok(Math.abs(moves.ambessa[action].range - measuredTip * 2) < 1);
    for (const extra of [-2, 3]) {
      const s = ready({ chars: ["ambessa", "saber"] }), p = s.players[0]; p.x = face > 0 ? 200 : 760;
      s.players[1].x = p.x + face * 150;
      if (action === "heavyFollow") {
        step(s, [INPUT.HEAVY, 0]); advanceTo(s, 20); step(s, [INPUT.HEAVY, 0]);
        assert.equal(p.action, "heavyFollow");
      } else step(s, [INPUT.HEAVY, 0]);
      advanceTo(s, moves.ambessa[action].startup - 1);
      const nextStep = action === "heavy" ? 2.5 : 7;
      // Put the near edge of the target body at the authored tip, then sample the
      // first active step including the character's committed forward movement.
      s.players[1].x = p.x + face * (nextStep + moves.ambessa[action].range + 29 + extra);
      s.players[1].vx = 0; s.players[1].hitstun = 0; s.players[1].action = "idle";
      const hp = s.players[1].hp; step(s, [0, 0]);
      assert.equal(hp - s.players[1].hp, extra < 0 ? moves.ambessa[action].damage : 0);
      assert.equal(hurtbox(p).top, characters.ambessa.hurtHeight);
    }
  }
});

test("Boothill's final muzzle origins match the firing art, and normal-height shots stay horizontal", () => {
  for (const face of [-1, 1]) for (const [action, button, native] of [["light", INPUT.LIGHT, [51.4, -79.05]], ["fanning", INPUT.LIGHT, [51.4, -79.05]], ["ultimate", INPUT.ULT, [67.89, -90.72]]]) {
    const s = ready({ chars: ["boothill", "saber"] }), p = s.players[0]; p.x = face > 0 ? 100 : 860;
    s.players[1].x = p.x + face * 650; s.players[1].invuln = 500; p.meter = 100;
    if (action === "fanning") { step(s, [INPUT.SKILL, 0]); until(s, state => state.players[0].action === "idle"); }
    step(s, [button, 0]);
    for (const release of moves.boothill[action].releases ?? [moves.boothill[action].release]) {
      advanceTo(s, release); const origin = boothillShotOrigin(p), event = s.events.find(e => e.type === "projectile"), q = s.projectiles.at(-1);
      assert.ok(event); assert.equal(event.x, origin.x); assert.equal(event.y, origin.y);
      assert.ok(Math.abs(event.x - (p.x + face * native[0] * 2)) < .00001);
      assert.ok(Math.abs(event.y - (p.y - native[1] * 2)) < .00001);
      assert.equal(q.vy, 0); assert.ok(Math.abs(q.x - q.vx - origin.x) < .00001);
    }
  }
});

test("Boothill's fixed lower pitch reaches a small grounded Katja at close, middle and long range", () => {
  for (const face of [-1, 1]) for (const distance of [70, 180, 550]) for (const [action, button, damage] of [["light", INPUT.LIGHT, 56], ["fanning", INPUT.LIGHT, 87], ["ultimate", INPUT.ULT, 310]]) {
    for (const guard of [false, true]) {
      const s = ready({ chars: ["boothill", "katja"] }), p = s.players[0]; p.x = face > 0 ? 100 : 860;
      s.players[1].x = p.x + face * distance; p.meter = 100;
      if (action === "fanning") { step(s, [INPUT.SKILL, 0]); until(s, state => state.players[0].action === "idle"); }
      step(s, [button, guard ? INPUT.GUARD : 0]); frames(s, 180, [button, guard ? INPUT.GUARD : 0]);
      const expected = guard ? action === "ultimate" ? 68 : action === "fanning" ? 9 : 6 : damage;
      assert.equal(characters.katja.maxHp - s.players[1].hp, expected, `${action} at ${distance}, face ${face}, guard ${guard}`);
    }
  }
});

test("Boothill fixes the lowered angle at emission and never retargets the projectile in flight", () => {
  const s = ready({ chars: ["boothill", "katja"] }); s.players[0].x = 100; s.players[1].x = 740;
  step(s, [INPUT.LIGHT, 0]); advanceTo(s, 11);
  const q = s.projectiles[0], initial = { x: q.x, y: q.y, vx: q.vx, vy: q.vy }; assert.ok(q.vy < 0);
  s.players[1].y = 200; s.players[1].vy = 0; s.players[1].grounded = false;
  frames(s, 4); const after = s.projectiles.find(p => p.id === q.id);
  assert.ok(after); assert.equal(after.vx, initial.vx); assert.equal(after.vy, initial.vy);
  assert.ok(Math.abs(after.x - initial.x - initial.vx * 4) < .00001);
  assert.ok(Math.abs(after.y - initial.y - initial.vy * 4) < .00001);
});

test("v7.2 multi-hit skills grant bounded meter without dropping damage pulses across snapshots", () => {
  for (const [char, count, meter] of [["gilgamesh", 3, 12], ["magnus", 4, 16]]) for (const guarded of [false, true]) {
    const s = close(ready({ chars: [char, "heracles"], seed: 101 }), 95);
    const masks = [0, guarded ? INPUT.GUARD : 0], contacts = [];
    step(s, [INPUT.SKILL, masks[1]]);
    let copy = null;
    for (let frame = 0; frame < 130; frame++) {
      step(s, masks);
      if (copy) { step(copy, masks); assert.deepEqual(copy, s); }
      contacts.push(...s.events.filter(e => e.owner === 0 && ["hit", "block"].includes(e.type)));
      if (!copy && contacts.length === 1) copy = clone(s);
    }
    assert.ok(copy, "a real mid-burst snapshot must be exercised");
    assert.equal(contacts.length, count, `${char} keeps all authored strikes`);
    assert.equal(s.players[0].meter, meter, `${char} cannot farm one heavy-attack award per small pulse`);
    assert.ok(contacts.every(e => e.type === (guarded ? "block" : "hit")));
    if (char === "magnus") assert.equal(contacts.reduce((sum, e) => sum + e.damage, 0), guarded ? 16 : 160);
    else {
      const damage = { sword: 42, spear: 40, axe: 46 };
      assert.equal(contacts.reduce((sum, e) => sum + e.damage, 0),
        s.players[0].cast.weapons.reduce((sum, kind) => sum + (guarded ? Math.round(damage[kind] * .1) : damage[kind]), 0));
    }
  }
});

test("v7.2 rider charge cooldown rejects early input and admits a fresh press after its exact expiry", () => {
  for (const char of ["medusa", "iskandar"]) {
    const s = mounted(char), p = s.players[0];
    p.x = 100; s.players[1].x = 900;
    step(s, [INPUT.SKILL, 0]);
    until(s, () => p.action === "idle");
    const firstCast = p.cast.id;
    assert.ok(p.mount.chargeCooldown > 0);
    step(s, [INPUT.SKILL, 0]); assert.equal(p.cast.id, firstCast);
    until(s, () => p.mount.chargeCooldown === 1);
    assert.equal(p.cast.id, firstCast, "the expired early-input buffer cannot recast automatically");
    step(s, [0, 0]); assert.equal(p.mount.chargeCooldown, 0);
    step(s, [INPUT.SKILL, 0]); assert.equal(p.action, "charge"); assert.notEqual(p.cast.id, firstCast);
  }
});
