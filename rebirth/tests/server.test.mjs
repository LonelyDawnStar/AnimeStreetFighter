import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createGameServer } from "../server.mjs";
import { INPUT, characters } from "../public/engine.mjs";
import { BUILD_VERSION } from "../public/version.mjs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fixture(t, options = {}) {
  const app = createGameServer(options);
  const address = await app.listen(0, "127.0.0.1");
  const url = `http://127.0.0.1:${address.port}`;
  const sockets = [];
  t.after(async () => {
    for (const client of sockets) client.ws.terminate();
    await app.close();
  });
  async function client() {
    const ws = new WebSocket(`${url.replace("http", "ws")}/rebirth/ws`);
    const messages = [];
    const listeners = new Set();
    ws.on("message", (raw) => {
      messages.push(JSON.parse(raw.toString()));
      for (const notify of listeners) notify();
    });
    await once(ws, "open");
    const value = {
      ws,
      messages,
      send: (packet) => ws.send(JSON.stringify(packet)),
      wait(predicate, timeout = 3000) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            listeners.delete(check);
            reject(new Error(`Timed out waiting for packet: ${predicate}`));
          }, timeout);
          function check() {
            const index = messages.findIndex(predicate);
            if (index < 0) return;
            clearTimeout(timer);
            listeners.delete(check);
            resolve(messages.splice(index, 1)[0]);
          }
          listeners.add(check);
          check();
        });
      },
    };
    sockets.push(value);
    return value;
  }
  return { app, url, client };
}

async function pair(f, chars = ["saber", "archer"]) {
  const a = await f.client();
  const b = await f.client();
  a.send({ type: "create", char: chars[0] });
  const first = await a.wait((m) => m.type === "joined");
  b.send({ type: "join", code: first.code, char: chars[1] });
  const second = await b.wait((m) => m.type === "joined");
  return { a, b, first, second };
}

test("HTTP exposes only public modules/art and rejects decoded traversal", async (t) => {
  const { url } = await fixture(t);
  const health = await fetch(`${url}/health`);
  const healthInfo = await health.json();
  assert.equal(healthInfo.ok, true);
  assert.equal(healthInfo.version, "rebirth");
  assert.equal(healthInfo.build, BUILD_VERSION);
  assert.equal(healthInfo.fighterCount, Object.keys(characters).length);
  assert.deepEqual(healthInfo.characters, Object.keys(characters));
  const module = await fetch(`${url}/engine.mjs`);
  const nested = await fetch(`${url}/rebirth/engine.mjs`);
  assert.equal(module.status, 200);
  assert.match(module.headers.get("content-type"), /javascript/);
  assert.equal(await module.text(), await nested.text());
  const cached = await fetch(`${url}/engine.mjs`, {
    headers: { "If-None-Match": module.headers.get("etag") },
  });
  assert.equal(cached.status, 304);
  for (const pathname of [
    "/server.py",
    "/package.json",
    "/rebirth/server.mjs",
    "/.git/config",
  ]) {
    assert.equal((await fetch(url + pathname)).status, 404, pathname);
  }
  for (const pathname of [
    "/assets/%2e%2e/%2e%2e/server.py",
    "/rebirth/%2e%2e/server.mjs",
    "/assets/%5c..%5cserver.py",
    "/%00",
  ]) {
    const status = await new Promise((resolve, reject) => {
      const base = new URL(url);
      const req = http.get(
        { hostname: base.hostname, port: base.port, path: pathname },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on("error", reject);
    });
    assert.equal(status, 403, pathname);
  }
  assert.equal((await fetch(url, { method: "POST" })).status, 405);
});

test("two real sockets ready, receive authoritative frames, apply validated input and clear stale controls", async (t) => {
  const f = await fixture(t);
  const { a, b, first, second } = await pair(f);
  assert.match(first.code, /^[A-Z2-9]{6}$/);
  assert.equal(first.slot, 0);
  assert.equal(second.slot, 1);
  assert.match(first.token, /^[0-9a-f]{48}$/);
  assert.notEqual(first.token, second.token);
  assert.ok(second.players.every((p) => !("token" in p)));
  a.send({ type: "ready" });
  await a.wait((m) => m.type === "room" && m.players[0].ready);
  await delay(60);
  assert.equal(
    f.app.rooms.get(first.code).state,
    null,
    "one ready player must not start simulation",
  );
  b.send({ type: "ready" });
  const startA = await a.wait((m) => m.type === "state");
  const startB = await b.wait((m) => m.type === "state");
  assert.deepEqual(startA.state, startB.state);
  assert.deepEqual(startA.ack, [-1, -1]);
  await a.wait((m) => m.type === "state" && m.state.phase === "fight", 4500);
  a.send({ type: "input", seq: 1, mask: 1024 });
  await a.wait((m) => m.type === "error" && !m.fatal);
  const before = f.app.rooms.get(first.code).state.players[0].x;
  let seq = 1;
  const controls = setInterval(
    () => a.send({ type: "input", seq: ++seq, mask: INPUT.RIGHT, hp: 999999 }),
    16,
  );
  await delay(180);
  clearInterval(controls);
  const moved = await a.wait((m) => m.type === "state" && m.ack[0] >= seq);
  assert.ok(
    moved.state.players[0].x > before + 20,
    "movement must come from real input applied by engine",
  );
  assert.equal(
    moved.state.players[0].hp,
    moved.state.players[0].maxHp,
    "untrusted HP fields have no effect",
  );
  a.send({ type: "input", seq, mask: INPUT.LEFT });
  a.send({ type: "input", seq: seq + 0.5, mask: 0 });
  await a.wait((m) => m.type === "error");
  const stale = await a.wait(
    (m) =>
      m.type === "state" &&
      m.state.tick > moved.state.tick + 16 &&
      m.inputs[0] === 0,
  );
  assert.equal(
    stale.ack[0],
    seq,
    "duplicates and invalid sequence numbers cannot advance the acknowledgement",
  );
  assert.ok(
    stale.state.players[0].x >= moved.state.players[0].x,
    "replayed old input cannot reverse movement",
  );
  a.send({ type: "ping", stamp: 123.25 });
  assert.equal((await a.wait((m) => m.type === "pong")).stamp, 123.25);
});

test("disconnect freezes the match; token reconnect resumes it; both players must accept rematch", async (t) => {
  const f = await fixture(t);
  const { a, b, first, second } = await pair(f);
  a.send({ type: "ready" });
  b.send({ type: "ready" });
  await a.wait((m) => m.type === "state" && m.state.tick > 3);
  b.ws.close();
  await a.wait((m) => m.type === "paused");
  const room = f.app.rooms.get(first.code);
  const frozenTick = room.state.tick;
  await delay(130);
  assert.equal(room.state.tick, frozenTick);
  const invalid = await f.client();
  invalid.send({ type: "resume", code: first.code, token: "f".repeat(48) });
  assert.equal((await invalid.wait((m) => m.type === "error")).fatal, true);
  const resumed = await f.client();
  resumed.send({ type: "resume", code: first.code, token: second.token });
  const joined = await resumed.wait((m) => m.type === "joined");
  assert.equal(joined.slot, 1);
  assert.equal(joined.state.tick, frozenTick);
  await a.wait((m) => m.type === "resumed");
  await resumed.wait((m) => m.type === "state" && m.state.tick > frozenTick);

  // Arrange the engine's terminal state; this test targets the network rematch handshake.
  room.state.phase = "ended";
  room.state.winner = 0;
  room.state.score = [2, 0];
  a.send({ type: "rematch" });
  await a.wait((m) => m.type === "room" && m.players[0].rematch);
  assert.equal(room.state.phase, "ended");
  resumed.send({ type: "rematch" });
  const restart = await a.wait((m) => m.type === "state" && m.state.tick === 0);
  assert.deepEqual(restart.state.score, [0, 0]);
  assert.deepEqual(restart.ack, [-1, -1]);
  assert.equal(restart.state.phase, "countdown");
  a.send({ type: "input", seq: 0, mask: INPUT.RIGHT });
  await a.wait((m) => m.type === "state" && m.ack[0] === 0);
  a.send({ type: "leave" });
  assert.equal(
    (await resumed.wait((m) => m.type === "error" && m.fatal)).fatal,
    true,
  );
  assert.equal(f.app.rooms.size, 0);
});

test("Gilgamesh and Lancer keep their roster identity through online skills, reconnect and rematch", async (t) => {
  const f = await fixture(t);
  const roster = ["gilgamesh", "lancer"];
  const { a, b, first, second } = await pair(f, roster);
  assert.deepEqual(second.players.map(p => p.char), roster);
  a.send({ type: "ready" }); b.send({ type: "ready" });
  const start = await a.wait(m => m.type === "state");
  assert.deepEqual(start.state.players.map(p => p.char), roster, "engine must not substitute a fallback fighter");
  await a.wait(m => m.type === "state" && m.state.phase === "fight", 4500);
  const before = f.app.rooms.get(first.code).state.players.map(p => p.x);
  let seqA = 0, seqB = 0;
  const movement = setInterval(() => {
    a.send({ type: "input", seq: ++seqA, mask: INPUT.RIGHT });
    b.send({ type: "input", seq: ++seqB, mask: INPUT.LEFT });
  }, 16);
  await delay(180); clearInterval(movement);
  a.send({ type: "input", seq: ++seqA, mask: 0 });
  b.send({ type: "input", seq: ++seqB, mask: 0 });
  const moved = await a.wait(m => m.type === "state" && m.ack[0] === seqA && m.ack[1] === seqB);
  assert.ok(moved.state.players[0].x > before[0] + 15);
  assert.ok(moved.state.players[1].x < before[1] - 15);

  for (const [slot, client] of [[0, a], [1, b]]) {
    const room = f.app.rooms.get(first.code);
    const previousDamage = room.state.players[slot].damageDealt;
    const previousHp = room.state.players[1 - slot].hp;
    const pressSeq = slot === 0 ? ++seqA : ++seqB;
    client.send({ type: "input", seq: pressSeq, mask: INPUT.SKILL });
    await client.wait(m => m.type === "state" && m.ack[slot] >= pressSeq && m.state.players[slot].action === "skill");
    client.send({ type: "input", seq: slot === 0 ? ++seqA : ++seqB, mask: 0 });
    const hit = await client.wait(m => m.type === "state" && m.state.players[slot].damageDealt > previousDamage, 4500);
    assert.ok(hit.state.players[1 - slot].hp < previousHp, `${roster[slot]} skill must deal authoritative damage`);
    await client.wait(m => m.type === "state" && m.state.tick > hit.state.tick && m.state.projectiles.length === 0 && m.state.players.every(p => p.action === "idle"), 4500);
  }

  b.ws.close(); await a.wait(m => m.type === "paused");
  const resumed = await f.client();
  resumed.send({ type: "resume", code: first.code, token: second.token });
  const restored = await resumed.wait(m => m.type === "joined");
  assert.deepEqual(restored.state.players.map(p => p.char), roster);
  await a.wait(m => m.type === "resumed");
  const room = f.app.rooms.get(first.code);
  room.state.phase = "ended"; room.state.winner = 0; room.state.score = [2, 0];
  a.send({ type: "rematch" });
  await a.wait(m => m.type === "room" && m.players[0].rematch);
  resumed.send({ type: "rematch" });
  const restart = await resumed.wait(m => m.type === "state" && m.state.tick === 0);
  assert.deepEqual(restart.state.players.map(p => p.char), roster);
  assert.deepEqual(restart.state.score, [0, 0]);
  assert.deepEqual(restart.ack, [-1, -1]);
  resumed.send({ type: "input", seq: 0, mask: INPUT.LEFT });
  await resumed.wait(m => m.type === "state" && m.ack[1] === 0);
});

test("mounted riders serialize independently, charge, resume and expire in mixed and mirror matches", { concurrency: 3 }, async (t) => {
  const lineups = [["medusa", "iskandar"], ["medusa", "medusa"], ["iskandar", "iskandar"]];
  await Promise.all(lineups.map(roster => t.test(roster.join(" vs "), async subtest => {
    const f = await fixture(subtest);
    const { a, b, first, second } = await pair(f, roster);
    a.send({ type: "ready" }); b.send({ type: "ready" });
    await a.wait(m => m.type === "state" && m.state.phase === "fight", 4500);
    const room = f.app.rooms.get(first.code);
    assert.deepEqual(room.state.players.map(p => p.char), roster);
    // Supply meter in the authoritative fixture; clients still use normal validated inputs.
    room.state.players.forEach(p => { p.meter = 100; });
    const seq = [0, 0];
    a.send({ type: "input", seq: ++seq[0], mask: INPUT.ULT });
    await a.wait(m => m.type === "state" && m.state.players[0].mount && m.state.players[0].action === "idle");
    b.send({ type: "input", seq: ++seq[1], mask: INPUT.ULT });
    const mounted = await a.wait(m => m.type === "state" && m.state.players.every(p => p.mount && p.action === "idle"), 3000);
    const peer = await b.wait(m => m.type === "state" && m.state.tick === mounted.state.tick);
    assert.deepEqual(peer.state.players.map(p => p.mount), mounted.state.players.map(p => p.mount), "both clients must receive identical mount data");
    for (let slot = 0; slot < 2; slot++) {
      const mount = mounted.state.players[slot].mount;
      assert.equal(mount.type, roster[slot] === "medusa" ? "pegasus" : "bucephalus");
      assert.equal(mount.duration, 480);
      assert.ok(mount.remaining > 420 && mount.remaining <= 480);
      assert.equal(mount.chargeCooldown, 0);
    }
    assert.notEqual(mounted.state.players[0].mount.castId, mounted.state.players[1].mount.castId, "mirror riders must keep separate cast identities");
    a.send({ type: "input", seq: ++seq[0], mask: 0 });
    b.send({ type: "input", seq: ++seq[1], mask: 0 });
    await a.wait(m => m.type === "state" && m.ack[0] === seq[0] && m.ack[1] === seq[1]);
    for (const [slot, client, button] of [[0, a, INPUT.SKILL], [1, b, INPUT.ULT]]) {
      const hpBefore = room.state.players[1 - slot].hp;
      const damageBefore = room.state.players[slot].damageDealt;
      const press = ++seq[slot];
      client.send({ type: "input", seq: press, mask: button });
      const charge = await client.wait(m => m.type === "state" && m.ack[slot] >= press && m.state.players[slot].action === "charge");
      assert.ok(charge.state.players[slot].mount.chargeCooldown > 0);
      client.send({ type: "input", seq: ++seq[slot], mask: 0 });
      const hit = await client.wait(m => m.type === "state" && m.state.players[slot].damageDealt > damageBefore);
      assert.ok(hit.state.players[1 - slot].hp < hpBefore, "mounted charge must apply authoritative damage");
      await client.wait(m => m.type === "state" && m.state.tick > hit.state.tick && m.state.players.every(p => p.action === "idle"));
    }

    b.ws.close(); await a.wait(m => m.type === "paused");
    const frozenTick = room.state.tick;
    const frozenMounts = structuredClone(room.state.players.map(p => p.mount));
    assert.ok(frozenMounts.every(Boolean));
    await delay(150);
    assert.equal(room.state.tick, frozenTick);
    assert.deepEqual(room.state.players.map(p => p.mount), frozenMounts, "disconnect pause must freeze mount lifetime and cooldown");
    const resumed = await f.client();
    resumed.send({ type: "resume", code: first.code, token: second.token });
    const joined = await resumed.wait(m => m.type === "joined");
    assert.deepEqual(joined.state.players.map(p => p.mount), frozenMounts);
    await a.wait(m => m.type === "resumed");
    const expired = await resumed.wait(m => m.type === "state" && m.state.players.every(p => p.mount === null), 10000);
    const expected = Math.max(...frozenMounts.map(m => m.remaining));
    assert.ok(expired.state.tick - frozenTick >= expected && expired.state.tick - frozenTick <= expected + 3, "mount must expire after its remaining simulation frames");
    assert.deepEqual(expired.state.players.map(p => p.char), roster);
    assert.ok(expired.state.players.every(p => p.action !== "charge"));
  })));
});

test("new ranged and melee casts survive reconnect without duplicating damage", { concurrency: 3 }, async (t) => {
  const cases = [
    { char: "gojo", action: "skill", button: INPUT.SKILL, damage: 115, distance: 600 },
    { char: "heracles", action: "ultimate", button: INPUT.ULT, damage: 370, distance: 175 },
    { char: "allmight", action: "ultimate", button: INPUT.ULT, damage: 365, distance: 175 },
  ];
  await Promise.all(cases.map(config => t.test(config.char, async subtest => {
    const f = await fixture(subtest);
    const { a, b, first, second } = await pair(f, [config.char, "saber"]);
    a.send({ type: "ready" }); b.send({ type: "ready" });
    await a.wait(m => m.type === "state");
    const room = f.app.rooms.get(first.code);
    // Focus on the authoritative cast/reconnect boundary; countdown has its own coverage.
    room.state.phase = "fight"; room.state.phaseFrame = 0;
    room.state.players[0].x = 160;
    room.state.players[1].x = 160 + config.distance;
    room.state.players[0].meter = 100;
    const hpBefore = room.state.players[1].hp;
    a.send({ type: "input", seq: 1, mask: config.button });
    await a.wait(m => m.type === "state" && m.ack[0] === 1 && m.state.players[0].action === config.action);
    a.send({ type: "input", seq: 2, mask: 0 });
    const during = await a.wait(m => {
      if (m.type !== "state" || m.state.players[0].action !== config.action) return false;
      if (config.char === "gojo") return m.state.projectiles.some(p => p.owner === 0);
      if (config.char === "heracles") return m.state.players[0].damageDealt > 0 && m.state.players[0].damageDealt < config.damage;
      return m.state.players[0].actionFrame >= 62 && m.state.players[0].actionFrame <= 70;
    }, 4000);
    const sameTick = await b.wait(m => m.type === "state" && m.state.tick === during.state.tick);
    assert.deepEqual(sameTick.state.projectiles, during.state.projectiles);
    assert.deepEqual(sameTick.state.players[0].cast, during.state.players[0].cast);
    b.ws.close(); await a.wait(m => m.type === "paused");
    const frozen = JSON.parse(JSON.stringify(room.state));
    await delay(100);
    assert.deepEqual(room.state, frozen);
    const resumed = await f.client();
    resumed.send({ type: "resume", code: first.code, token: second.token });
    const restored = await resumed.wait(m => m.type === "joined");
    assert.deepEqual(restored.state.players[0].cast, frozen.players[0].cast);
    assert.deepEqual(restored.state.projectiles, frozen.projectiles);
    assert.equal(restored.state.players[1].hp, frozen.players[1].hp);
    await a.wait(m => m.type === "resumed");
    // Replayed old input is rejected; a resumed in-flight cast must not become another cast.
    a.send({ type: "input", seq: 1, mask: config.button });
    const finished = await resumed.wait(m => m.type === "state" && m.state.tick > frozen.tick && m.state.players[0].action === "idle" && m.state.projectiles.length === 0 && m.state.players[0].damageDealt > 0, 5000);
    assert.equal(hpBefore - finished.state.players[1].hp, config.damage, `${config.char} must resolve its cast once within the documented damage cap`);
    assert.equal(finished.state.players[0].damageDealt, config.damage);
    const later = await resumed.wait(m => m.type === "state" && m.state.tick >= finished.state.tick + 15);
    assert.equal(later.state.players[1].hp, finished.state.players[1].hp);
    assert.equal(later.ack[0], 2, "replayed sequence cannot advance the server acknowledgement");
  })));
});

test("expired reconnect and abandoned lobby release their rooms", async (t) => {
  const f = await fixture(t, {
    disconnectGraceMs: 100,
    maintenanceMs: 10,
    roomIdleMs: 220,
  });
  const { a, b, first } = await pair(f);
  b.ws.close();
  await a.wait((m) => m.type === "error" && m.fatal);
  assert.equal(f.app.rooms.has(first.code), false);
  a.send({ type: "create", char: "archer" });
  const another = await a.wait((m) => m.type === "joined");
  assert.notEqual(another.code, first.code);
  await a.wait((m) => m.type === "error" && m.fatal);
  assert.equal(f.app.rooms.size, 0);
});

test("ready flags survive a lobby reconnect and start when both players are back", async (t) => {
  const f = await fixture(t);
  const { a, b, first, second } = await pair(f);
  b.send({ type: "ready" });
  await a.wait((m) => m.type === "room" && m.players[1]?.ready);
  b.ws.close();
  await a.wait((m) => m.type === "room" && !m.players[1]?.connected);
  a.send({ type: "ready" });
  await a.wait((m) => m.type === "room" && m.players.every((p) => p?.ready));
  assert.equal(f.app.rooms.get(first.code).state, null);
  const resumed = await f.client();
  resumed.send({ type: "resume", code: first.code, token: second.token });
  await resumed.wait((m) => m.type === "joined");
  const started = await resumed.wait((m) => m.type === "state");
  assert.equal(started.state.phase, "countdown");
  assert.equal(started.paused, false);
});

test("refresh resumes from the applied acknowledgement after unapplied packets were discarded", async (t) => {
  const f = await fixture(t);
  const { a, b, first, second } = await pair(f);
  a.send({ type: "ready" });
  b.send({ type: "ready" });
  await a.wait((m) => m.type === "state");
  b.ws.close();
  await a.wait((m) => m.type === "paused");
  a.send({ type: "input", seq: 900, mask: INPUT.LEFT });
  a.send({ type: "ping", stamp: 7 });
  await a.wait((m) => m.type === "pong");
  assert.equal(f.app.rooms.get(first.code).players[0].lastSeq, 900);
  a.ws.close();
  await once(a.ws, "close");
  const restoredA = await f.client();
  restoredA.send({ type: "resume", code: first.code, token: first.token });
  assert.equal((await restoredA.wait((m) => m.type === "joined")).paused, true);
  const applied = (await restoredA.wait((m) => m.type === "state")).ack[0];
  const restoredB = await f.client();
  restoredB.send({ type: "resume", code: first.code, token: second.token });
  await restoredA.wait((m) => m.type === "resumed");
  restoredA.send({ type: "input", seq: applied + 1, mask: INPUT.RIGHT });
  const fresh = await restoredA.wait(
    (m) => m.type === "state" && m.ack[0] === applied + 1,
  );
  assert.equal(fresh.paused, false);
  assert.equal(fresh.inputs[0], INPUT.RIGHT);
});

test("malformed messages and third-player joins cannot corrupt a room", async (t) => {
  const f = await fixture(t);
  const { first } = await pair(f);
  const stranger = await f.client();
  stranger.ws.send("{broken");
  await stranger.wait((m) => m.type === "error");
  stranger.send({ type: "create", char: "__proto__" });
  await stranger.wait((m) => m.type === "error");
  stranger.send({ type: "join", code: first.code, char: "saber" });
  await stranger.wait((m) => m.type === "error");
  stranger.send({ type: "input", seq: 1, mask: INPUT.RIGHT });
  await stranger.wait((m) => m.type === "error");
  assert.equal(f.app.rooms.size, 1);
  assert.equal(f.app.rooms.get(first.code).players.length, 2);
  stranger.send({ type: "create", char: "archer" });
  const isolated = await stranger.wait((m) => m.type === "joined");
  assert.notEqual(isolated.code, first.code);
  stranger.send({ type: "leave" });
  await stranger.wait((m) => m.type === "error" && m.fatal);
  assert.equal(f.app.rooms.size, 1);
});

test("a press and release received in one server tick still activate the action once", async t => {
  const f = await fixture(t);
  const { a, b, first } = await pair(f, ["medusa", "iskandar"]);
  a.send({ type: "ready" }); b.send({ type: "ready" });
  await a.wait(m => m.type === "state");
  const room = f.app.rooms.get(first.code);
  room.state.phase = "fight"; room.state.phaseFrame = 0;
  room.state.players[0].meter = 100;
  // A browser can send its pressed frame and released frame in the same network burst.
  a.send({ type: "input", seq: 1, mask: INPUT.ULT });
  a.send({ type: "input", seq: 2, mask: 0 });
  const applied = await a.wait(m => m.type === "state" && m.ack[0] === 2);
  assert.equal(applied.state.players[0].action, "ultimate");
  const mounted = await a.wait(m => m.type === "state" && m.state.players[0].mount);
  assert.equal(mounted.state.players[0].mount.type, "pegasus");
  assert.equal(mounted.state.players[0].meter, 0);
  assert.equal(mounted.inputs[0], 0, "the released tap must not remain held");
});

test("v6 statuses and casts remain authoritative through reconnects and mirrors", { concurrency: 4 }, async t => {
  async function setup(subtest, roster, distance = 150) {
    const f = await fixture(subtest), pairResult = await pair(f, roster);
    const { a, b, first } = pairResult;
    a.send({ type: "ready" }); b.send({ type: "ready" });
    await a.wait(m => m.type === "state");
    const room = f.app.rooms.get(first.code);
    room.state.phase = "fight"; room.state.phaseFrame = 0;
    room.state.players[0].x = 100; room.state.players[1].x = 100 + distance;
    room.state.players.forEach(p => { p.meter = 100; });
    assert.deepEqual(room.state.players.map(p => p.char), roster);
    return { ...f, ...pairResult, room };
  }
  async function reconnect(context) {
    context.b.ws.close(); await context.a.wait(m => m.type === "paused");
    const frozen = JSON.parse(JSON.stringify(context.room.state));
    await delay(100);
    assert.deepEqual(context.room.state, frozen, "status timers must not run during disconnect pause");
    const peer = await context.client();
    peer.send({ type: "resume", code: context.first.code, token: context.second.token });
    const joined = await peer.wait(m => m.type === "joined");
    assert.deepEqual(joined.state, frozen, "reconnecting player receives the complete same cast and status state");
    await context.a.wait(m => m.type === "resumed");
    return { peer, frozen };
  }
  await Promise.all([
    t.test("Katja mirror slow, haste and cooldown belong to the correct players", async subtest => {
      const c = await setup(subtest, ["katja", "katja"], 180);
      c.a.send({ type: "input", seq: 1, mask: INPUT.SKILL });
      const hit = await c.a.wait(m => m.type === "state" && m.state.players[1].slow);
      const sameTick = await c.b.wait(m => m.type === "state" && m.state.tick === hit.state.tick);
      assert.deepEqual(hit.state, sameTick.state);
      assert.equal(hit.state.players[1].slow.multiplier, .65);
      assert.equal(hit.state.players[0].haste.multiplier, 1.2);
      assert.equal(hit.state.players[0].slow, null);
      assert.equal(hit.state.players[1].haste, null);
      assert.ok(hit.state.players[0].cooldowns.skill > 0);
      c.a.send({ type: "input", seq: 2, mask: 0 });
      const { peer, frozen } = await reconnect(c);
      const ended = await peer.wait(m => m.type === "state" && m.state.tick > frozen.tick && !m.state.players[0].haste && !m.state.players[1].slow);
      assert.equal(ended.state.players[0].damageDealt, 90);
      assert.equal(ended.state.players[1].maxHp - ended.state.players[1].hp, 90);
      assert.ok(ended.state.players[0].cooldowns.skill < frozen.players[0].cooldowns.skill);
    }),
    t.test("Ambessa mirror preserves the earned follow-up and consumes it once", async subtest => {
      const c = await setup(subtest, ["ambessa", "ambessa"]);
      c.a.send({ type: "input", seq: 1, mask: INPUT.HEAVY });
      const earned = await c.a.wait(m => m.type === "state" && m.state.players[0].recast);
      assert.equal(earned.state.players[0].recast.action, "heavyFollow");
      assert.equal(earned.state.players[1].recast, null);
      c.a.send({ type: "input", seq: 2, mask: 0 });
      const { peer, frozen } = await reconnect(c);
      assert.equal(frozen.players[0].recast.castId, frozen.players[0].cast.id);
      await peer.wait(m => m.type === "state" && m.state.tick > frozen.tick && m.state.hitstop === 0 && m.state.players[0].input === 0 && (m.state.players[0].action === "idle" || m.state.players[0].actionFrame >= 19));
      c.a.send({ type: "input", seq: 3, mask: INPUT.HEAVY });
      const follow = await peer.wait(m => m.type === "state" && m.state.players[0].action === "heavyFollow");
      assert.equal(follow.state.players[0].recast, null);
      c.a.send({ type: "input", seq: 4, mask: 0 });
      const finished = await peer.wait(m => m.type === "state" && m.state.players[0].action === "idle" && m.state.players[0].damageDealt >= 188);
      assert.equal(finished.state.players[0].damageDealt, 188);
      assert.equal(finished.state.players[1].maxHp - finished.state.players[1].hp, 188);
    }),
    t.test("Ambessa shield absorption and empowered slam survive mid-shield reconnect", async subtest => {
      const c = await setup(subtest, ["ambessa", "saber"], 85);
      c.a.send({ type: "input", seq: 1, mask: INPUT.SKILL });
      await c.a.wait(m => m.type === "state" && m.state.players[0].shield);
      c.b.send({ type: "input", seq: 1, mask: INPUT.LIGHT });
      const absorbed = await c.a.wait(m => m.type === "state" && m.state.players[0].shield?.hp === 26 && m.state.players[0].cast?.shieldCharged);
      assert.equal(absorbed.state.players[0].hp, absorbed.state.players[0].maxHp);
      const { peer } = await reconnect(c);
      const slam = await peer.wait(m => m.type === "state" && m.state.players[0].damageDealt > 0);
      assert.equal(slam.state.players[0].damageDealt, 145);
      assert.equal(slam.state.players[1].maxHp - slam.state.players[1].hp, 145);
    }),
    t.test("Magnus mirror bike serializes before launch and deals one collision after resume", async subtest => {
      const c = await setup(subtest, ["magnus", "magnus"], 750);
      c.a.send({ type: "input", seq: 1, mask: INPUT.ULT });
      const riding = await c.a.wait(m => m.type === "state" && m.state.players[0].bike && m.state.players[0].actionFrame >= 58);
      assert.equal(riding.state.players[1].bike, null);
      assert.equal(riding.state.players[0].bike.castId, riding.state.players[0].cast.id);
      c.a.send({ type: "input", seq: 2, mask: 0 });
      const { peer } = await reconnect(c);
      c.a.send({ type: "input", seq: 3, mask: INPUT.ULT });
      const launched = await peer.wait(m => m.type === "state" && m.state.projectiles.some(p => p.type === "magnus-bike"));
      assert.equal(launched.state.players[0].bike, null);
      assert.equal(launched.state.projectiles.find(p => p.type === "magnus-bike").castId, riding.state.players[0].cast.id);
      c.a.send({ type: "input", seq: 4, mask: 0 });
      const finished = await peer.wait(m => m.type === "state" && m.state.players[0].action === "idle" && !m.state.projectiles.length && m.state.players[0].damageDealt > 0);
      assert.equal(finished.state.players[0].damageDealt, 330);
      assert.equal(finished.state.players[1].maxHp - finished.state.players[1].hp, 330);
      const later = await peer.wait(m => m.type === "state" && m.state.tick > finished.state.tick + 15);
      assert.equal(later.state.players[1].hp, finished.state.players[1].hp);
    }),
  ]);
});

test("v7 empowerment, duel and weakness restore through real socket reconnects", { concurrency: 2 }, async t => {
  async function setup(subtest, roster, distance) {
    const f = await fixture(subtest), joined = await pair(f, roster);
    joined.a.send({ type: "ready" }); joined.b.send({ type: "ready" });
    await joined.a.wait(m => m.type === "state");
    const room = f.app.rooms.get(joined.first.code);
    room.state.phase = "fight"; room.state.phaseFrame = 0;
    room.state.players[0].x = 100; room.state.players[1].x = 100 + distance;
    room.state.players[0].meter = 100;
    assert.deepEqual(room.state.players.map(p => p.char), roster);
    return { ...f, ...joined, room, seq: [0, 0] };
  }
  function input(c, slot, mask) {
    c[slot ? "b" : "a"].send({ type: "input", seq: ++c.seq[slot], mask });
    return c.seq[slot];
  }
  function tap(c, slot, button) {
    input(c, slot, button);
    return input(c, slot, 0);
  }
  async function reconnect(c, slot) {
    c[slot ? "b" : "a"].ws.close();
    const observer = c[slot ? "a" : "b"];
    await observer.wait(m => m.type === "paused");
    const frozen = structuredClone(c.room.state);
    await delay(110);
    assert.deepEqual(c.room.state, frozen, "disconnect pause freezes the exact action, charges and status clocks");
    const peer = await c.client();
    peer.send({ type: "resume", code: c.first.code, token: c[slot ? "second" : "first"].token });
    const restored = await peer.wait(m => m.type === "joined");
    assert.equal(restored.slot, slot); assert.deepEqual(restored.state, frozen);
    await observer.wait(m => m.type === "resumed");
    c[slot ? "b" : "a"] = peer;
    return frozen;
  }
  await Promise.all([
    t.test("Acheron consumes three fresh J presses and restores partial charges and the pending finisher once", async subtest => {
      const c = await setup(subtest, ["acheron", "saber"], 190);
      tap(c, 0, INPUT.ULT);
      const awakened = await c.a.wait(m => m.type === "state" && m.state.players[0].empower?.charges === 3 && m.state.players[0].action === "idle");
      assert.equal(awakened.state.players[0].meter, 0); assert.equal(awakened.state.players[1].empower, null);
      input(c, 0, INPUT.LIGHT);
      const held = setInterval(() => input(c, 0, INPUT.LIGHT), 45);
      subtest.after(() => clearInterval(held));
      const first = await c.a.wait(m => m.type === "state" && m.state.players[0].empower?.charges === 2);
      const stillHeld = await c.a.wait(m => m.type === "state" && m.state.tick > first.state.tick + 48 && m.state.players[0].action === "idle");
      clearInterval(held);
      assert.equal(stillHeld.state.players[0].empower.charges, 2);
      assert.equal(stillHeld.state.players[0].damageDealt, 74, "retransmitting a held key must not spend another charge");
      input(c, 0, 0);
      const frozen = await reconnect(c, 0);
      assert.equal(frozen.players[0].empower.charges, 2);
      assert.equal(frozen.players[0].empower.castId, awakened.state.players[0].empower.castId);
      await c.a.wait(m => m.type === "state" && m.state.tick > frozen.tick && m.state.players[0].input === 0);
      tap(c, 0, INPUT.LIGHT);
      const second = await c.a.wait(m => m.type === "state" && m.state.players[0].empower?.charges === 1 && m.state.players[0].action === "idle");
      assert.equal(second.state.players[0].damageDealt, 148);
      tap(c, 0, INPUT.LIGHT);
      const pending = await c.a.wait(m => m.type === "state" && m.state.players[0].empower?.finisherPending);
      assert.equal(pending.state.players[0].empower.charges, 0); assert.equal(pending.state.players[0].damageDealt, 222);
      const pendingSnapshot = await reconnect(c, 0);
      assert.equal(pendingSnapshot.players[0].empower.finisherPending, true);
      const finisher = await c.a.wait(m => m.type === "state" && m.state.tick > pendingSnapshot.tick && m.state.players[0].action === "finisher");
      const complete = await c.a.wait(m => m.type === "state" && m.state.tick > finisher.state.tick && !m.state.players[0].empower && m.state.players[0].action === "idle");
      assert.equal(complete.state.players[0].damageDealt, 388); assert.equal(complete.state.players[1].hp, 612);
      assert.equal(complete.state.players[0].cast.id, finisher.state.players[0].cast.id);
      // Retransmit an already consumed third-press sequence after reconnect.
      c.a.send({ type: "input", seq: c.seq[0] - 1, mask: INPUT.LIGHT });
      const later = await c.a.wait(m => m.type === "state" && m.state.tick > complete.state.tick + 36);
      assert.equal(later.state.players[0].damageDealt, 388); assert.equal(later.state.players[0].cast.id, finisher.state.players[0].cast.id);
      const sameTick = await c.b.wait(m => m.type === "state" && m.state.tick === later.state.tick);
      assert.deepEqual(sameTick.state, later.state);
    }),
    t.test("Boothill restores the duel and later the victim's weakness without duplicating bullets", async subtest => {
      const c = await setup(subtest, ["boothill", "saber"], 530);
      tap(c, 0, INPUT.SKILL);
      await c.a.wait(m => m.type === "state" && m.state.players[0].duel && m.state.players[0].action === "idle");
      const duel = await reconnect(c, 1);
      assert.equal(duel.players[0].duel.target, 1); assert.equal(duel.players[1].duel, null);
      const sequence = tap(c, 0, INPUT.LIGHT);
      await c.a.wait(m => m.type === "state" && m.ack[0] >= sequence && m.state.players[0].action === "fanning");
      const burst = await c.a.wait(m => m.type === "state" && m.state.players[0].damageDealt === 87 && m.state.players[0].action === "idle" && !m.state.projectiles.length);
      assert.equal(burst.state.players[0].cast.emitted.filter(key => key.startsWith("fanning-")).length, 3);
      tap(c, 0, INPUT.ULT);
      const shot = await c.a.wait(m => m.type === "state" && m.state.players[1].exposed);
      assert.equal(shot.state.players[1].slow.multiplier, .65); assert.equal(shot.state.players[1].exposed.multiplier, 1.12);
      assert.equal(shot.state.players[0].exposed, null); assert.equal(shot.state.players[0].damageDealt, 428);
      const frozen = await reconnect(c, 1);
      assert.ok(frozen.players[1].exposed.remaining > 0);
      const expired = await c.b.wait(m => m.type === "state" && m.state.tick > frozen.tick && !m.state.players[0].duel && !m.state.players[1].exposed && !m.state.players[1].slow, 5000);
      assert.equal(expired.state.players[0].damageDealt, 428); assert.equal(expired.state.players[1].hp, 572);
      assert.ok(expired.state.players[0].cooldowns.skill < frozen.players[0].cooldowns.skill);
      assert.equal(expired.state.players[0].cast.emitted.filter(key => key === "deadeye").length, 1);
      const sameTick = await c.a.wait(m => m.type === "state" && m.state.tick === expired.state.tick);
      assert.deepEqual(sameTick.state, expired.state);
    }),
  ]);
});
