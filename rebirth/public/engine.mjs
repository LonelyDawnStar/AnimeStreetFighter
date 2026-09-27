/** Deterministic 60 Hz combat. Distances are world pixels; y is height above floor. */
import { saberSwordGeometry } from "./saber-motion.mjs";
export const KATJA_ART_SCALE = .84;
// Caladbolg's release sprite places its arrow at 70 native pixels above the
// feet. Share that fixed axis with the charge VFX; do not aim at the opponent.
export const ARCHER_ARROW_HEIGHT = 140;
export const INPUT = Object.freeze({
  LEFT: 1,
  RIGHT: 2,
  JUMP: 4,
  GUARD: 8,
  LIGHT: 16,
  HEAVY: 32,
  SKILL: 64,
  DASH: 128,
  ULT: 256,
});
export const characters = Object.freeze({
  saber: {
    name: "SABER",
    title: "기사왕",
    maxHp: 1000,
    speed: 4.5,
    jump: 15.2,
    color: "#7ef7ef",
    role: "근접 / 검격",
  },
  archer: {
    name: "ARCHER",
    title: "연철의 영령",
    maxHp: 920,
    speed: 4.7,
    jump: 15.5,
    color: "#ff7278",
    role: "원거리 / 투사체",
  },
  gilgamesh: {
    name: "GILGAMESH", title: "영웅왕", maxHp: 950, speed: 4.1,
    jump: 14.9, color: "#f6c45c", role: "원거리 / 무기 연사",
  },
  lancer: {
    name: "LANCER", title: "빛의 왕자", maxHp: 930, speed: 5.25,
    jump: 15.7, color: "#669bff", role: "돌격 / 창술",
  },
  medusa: {
    name: "MEDUSA", title: "마안의 라이더", maxHp: 960, speed: 5.4,
    jump: 15.8, color: "#c3a1ff", role: "기동 / 페가수스",
  },
  iskandar: {
    name: "ISKANDAR", title: "정복왕", maxHp: 1200, speed: 4.15,
    jump: 14.5, color: "#e99965", role: "중량 / 부케팔로스",
  },
  gojo: {
    name: "GOJO", title: "현대 최강의 주술사", maxHp: 950, speed: 4.65,
    jump: 15.4, color: "#b69dff", role: "원거리 / 공간 제어",
  },
  heracles: {
    name: "HERACLES", title: "대영웅", maxHp: 1180, speed: 3.35,
    jump: 13.7, color: "#bb8e65", role: "중량 / 도끼검", hurtWidth: 76, hurtHeight: 205,
  },
  allmight: {
    name: "ALL MIGHT", title: "평화의 상징", maxHp: 1120, speed: 4.4,
    jump: 15.4, color: "#ffd25a", role: "돌격 / 강펀치", hurtWidth: 72, hurtHeight: 201,
  },
  katja: {
    name: "KATJA", title: "정밀 조준", maxHp: 930, speed: 4.3,
    jump: 14.8, color: "#69c8c5", role: "원거리 / 저격",
    hurtWidth: 58 * KATJA_ART_SCALE, hurtHeight: 164 * KATJA_ART_SCALE,
  },
  magnus: {
    name: "MAGNUS", title: "폭주 바이커", maxHp: 1220, speed: 4.1,
    jump: 14.2, color: "#d9a257", role: "중량 / 바이크 돌진", hurtWidth: 70, hurtHeight: 190,
  },
  ambessa: {
    name: "AMBESSA", title: "전장의 우두머리", maxHp: 1030, speed: 4.85,
    jump: 15.2, color: "#dc354e", role: "기동 / 연계 강습", hurtWidth: 68, hurtHeight: 188,
  },
  acheron: {
    name: "ACHERON", title: "허무의 사도", maxHp: 970, speed: 5.25,
    jump: 15.5, color: "#c798ed", role: "암살 / 강화 참격",
  },
  boothill: {
    name: "BOOTHILL", title: "갤럭시 레인저", maxHp: 990, speed: 4.6,
    jump: 15.1, color: "#e8ae72", role: "원거리 / 결투 사격",
  },
});
// Measured from the final v6 firing poses, converted from native pixels to world
// coordinates (positive y is up). The renderer can share these simulation origins.
export const katjaShotOffsets = Object.freeze({
  light: Object.freeze({ x: 147.56 * KATJA_ART_SCALE, y: 155.14 * KATJA_ART_SCALE }),
  heavy: Object.freeze({ x: 132.98 * KATJA_ART_SCALE, y: 98.38 * KATJA_ART_SCALE }),
  skill: Object.freeze({ x: 84.78 * KATJA_ART_SCALE, y: 125.98 * KATJA_ART_SCALE }),
  ultimate: Object.freeze([
    Object.freeze({ x: 122.38 * KATJA_ART_SCALE, y: 103.28 * KATJA_ART_SCALE }),
    Object.freeze({ x: 106.86 * KATJA_ART_SCALE, y: 97.32 * KATJA_ART_SCALE }),
    Object.freeze({ x: 120 * KATJA_ART_SCALE, y: 105.08 * KATJA_ART_SCALE }),
  ]),
});
export function katjaShotOrigin(p, action = p.action, sequence = 0) {
  const offset = action === "ultimate" ? katjaShotOffsets.ultimate[sequence] : katjaShotOffsets[action];
  return { x: p.x + p.face * offset.x, y: p.y + offset.y };
}
export const boothillShotOffsets = Object.freeze({
  light: Object.freeze({ x: 102.8, y: 158.1 }),
  fanning: Object.freeze({ x: 102.8, y: 158.1 }),
  ultimate: Object.freeze({ x: 135.78, y: 181.44 }),
});
export function boothillShotOrigin(p, action = p.action) {
  const offset = boothillShotOffsets[action];
  return { x: p.x + p.face * offset.x, y: p.y + offset.y };
}
// The mounted front tire is 228 world pixels ahead of the rider pivot. A detached
// bike uses its chassis center and the measured wheel-to-handlebar body bounds.
export const magnusBikeShape = Object.freeze({
  front: 228, projectileWidth: 344, projectileHeight: 176, projectileY: 86, detachOffset: 54,
});
const move = (startup, active, recovery, range, damage, extra = {}) => ({
  startup,
  active,
  recovery,
  duration: startup + active + recovery,
  range,
  damage,
  ...extra,
});
export const moves = Object.freeze({
  saber: {
    light: move(7, 4, 15, 114, 64, { stun: 20, push: 5.5, low: 24, high: 150 }),
    heavy: move(17, 5, 26, 150, 136, { stun: 29, push: 9, low: 12, high: 185 }),
    skill: move(22, 1, 25, 650, 112, { release: 22, stun: 27, push: 8 }),
    ultimate: move(80, 14, 56, 404, 340, {
      release: 80,
      stun: 43,
      push: 14,
      armorEnd: 94,
      melee: true,
      name: "EXCALIBUR",
    }),
  },
  archer: {
    light: move(6, 4, 14, 98, 58, { stun: 19, push: 4.8, low: 24, high: 145 }),
    heavy: move(14, 5, 23, 122, 111, { stun: 26, push: 8, low: 16, high: 177 }),
    skill: move(25, 1, 26, 850, 119, { release: 25, stun: 28, push: 8 }),
    ultimate: move(75, 37, 43, 900, 90, {
      release: 75,
      releases: [75, 87, 99, 111],
      stun: 22,
      push: 3,
      name: "UNLIMITED BLADE WORKS",
    }),
  },
  gilgamesh: {
    light: move(12, 1, 21, 660, 55, { release: 12, stun: 18, push: 4, projectile: true }),
    heavy: move(24, 1, 33, 740, 108, { release: 24, stun: 27, push: 8, projectile: true }),
    skill: move(22, 17, 31, 850, 42, { release: 22, releases: [22, 30, 38], stun: 16, push: 3, projectile: true, cooldown: 96, meterGain: 4 }),
    ultimate: move(84, 48, 45, 860, 360, { release: 84, stun: 11, push: 1.3,
      pulseDamage: 60, pulseInterval: 8, pulseCount: 6, armorEnd: 132, name: "ENUMA ELISH" }),
  },
  lancer: {
    light: move(7, 4, 19, 156, 52, { stun: 18, push: 4.2, low: 40, high: 148 }),
    heavy: move(13, 5, 23, 204, 100, { stun: 25, push: 7, low: 16, high: 183 }),
    skill: move(13, 12, 27, 175, 120, { release: 13, stun: 26, push: 9, low: 50, high: 155, melee: true, cooldown: 92 }),
    ultimate: move(72, 18, 65, 245, 345, { release: 72, stun: 39, push: 10, launch: 10,
      armorEnd: 90, melee: true, name: "GAE BOLG" }),
  },
  medusa: {
    light: move(6, 4, 16, 102, 60, { stun: 17, push: 4, low: 28, high: 145 }),
    heavy: move(14, 5, 22, 138, 108, { stun: 25, push: 7, low: 18, high: 180 }),
    skill: move(14, 6, 24, 280, 118, { release: 14, stun: 25, push: 8, low: 54, high: 149, melee: true }),
    ultimate: move(36, 1, 0, 0, 0, { release: 36, cinematicFrames: 18, armorEnd: 24,
      transform: "pegasus", name: "BELLEROPHON" }),
  },
  iskandar: {
    light: move(10, 5, 20, 132, 78, { stun: 21, push: 6, low: 23, high: 170 }),
    heavy: move(21, 6, 30, 172, 141, { stun: 29, push: 10, low: 12, high: 202 }),
    skill: move(24, 7, 37, 225, 155, { release: 24, stun: 30, push: 12, low: 18, high: 202,
      armorStart: 12, armorEnd: 31, melee: true }),
    ultimate: move(42, 1, 0, 0, 0, { release: 42, cinematicFrames: 18, armorEnd: 28,
      transform: "bucephalus", name: "BUCEPHALUS" }),
  },
  gojo: {
    light: move(11, 1, 22, 700, 54, { release: 11, stun: 17, push: 3, projectile: true }),
    heavy: move(23, 1, 32, 760, 105, { release: 23, stun: 27, push: 12, projectile: true }),
    skill: move(24, 1, 31, 720, 115, { release: 24, stun: 26, push: -8, projectile: true, name: "BLUE" }),
    ultimate: move(60, 37, 51, 270, 320, { release: 60, releases: [60, 96], finisher: 96, cinematicFrames: 30,
      stun: 42, push: 0, armorEnd: 108, projectile: true, name: "UNLIMITED VOID · PURPLE" }),
  },
  heracles: {
    light: move(12, 5, 22, 156, 84, { stun: 22, push: 7, low: 24, high: 199 }),
    heavy: move(24, 7, 32, 207, 150, { stun: 31, push: 12, low: 12, high: 232 }),
    skill: move(26, 8, 37, 232, 158, { release: 26, stun: 32, push: 13, low: 10, high: 232,
      armorStart: 12, armorEnd: 34, melee: true }),
    ultimate: move(74, 51, 49, 225, 370, { release: 74, releases: [74, 80, 86, 92, 98, 104, 110, 116, 124],
      pulseDamage: 27, finisherDamage: 154, stun: 9, push: .8, low: 12, high: 228,
      armorEnd: 125, melee: true, name: "NINE LIVES" }),
  },
  allmight: {
    light: move(9, 4, 19, 129, 74, { stun: 21, push: 6, low: 24, high: 191 }),
    heavy: move(18, 6, 27, 173, 136, { stun: 29, push: 10, low: 12, high: 220 }),
    skill: move(22, 1, 31, 420, 116, { release: 22, stun: 27, push: 12, projectile: true, name: "DETROIT SMASH" }),
    ultimate: move(74, 14, 61, 155, 365, { release: 74, stun: 43, push: 19, low: 12, high: 230,
      armorEnd: 88, melee: true, name: "UNITED STATES OF SMASH" }),
  },
  katja: {
    light: move(16, 1, 24, 920, 64, { release: 16, stun: 18, push: 4, projectile: true }),
    heavy: move(24, 1, 30, 960, 82, { release: 24, stun: 25, push: 7, projectile: true, cooldown: 110, name: "AIMED SHOT" }),
    skill: move(18, 1, 29, 265, 90, { release: 18, stun: 20, push: 7, projectile: true, cooldown: 156, name: "NO TRESPASSING" }),
    ultimate: move(60, 43, 45, 960, 320, { release: 60, releases: [60, 81, 102],
      cinematicFrames: 24, armorEnd: 60, cooldown: 360, projectile: true, name: "PRECISION AIM" }),
  },
  magnus: {
    light: move(10, 4, 20, 125, 84, { stun: 21, push: 6, low: 24, high: 176 }),
    heavy: move(22, 6, 30, 165, 154, { stun: 29, push: 10, low: 16, high: 207 }),
    skill: move(18, 37, 29, 140, 160, { release: 18, releases: [18, 30, 42, 54], pulseDamage: 40, meterGain: 4,
      stun: 9, push: .7, low: 16, high: 190, melee: true, omni: true, cooldown: 156, name: "17 VS 1" }),
    ultimate: move(50, 61, 42, magnusBikeShape.front, 330, { release: 50, cinematicFrames: 24, armorStart: 50, armorEnd: 111,
      stun: 35, push: 16, low: 12, high: 178, melee: true, cooldown: 360, name: "RECKLESS BIKE" }),
  },
  ambessa: {
    light: move(8, 4, 17, 126, 64, { stun: 19, push: 5, low: 24, high: 168 }),
    heavy: move(14, 5, 22, 321, 80, { stun: 21, push: 4, low: 20, high: 188, cooldown: 168, name: "CUNNING SWEEP" }),
    heavyFollow: move(12, 5, 24, 416, 108, { stun: 26, push: 9, low: 0, high: 130, name: "SUNDERING SLAM" }),
    skill: move(22, 6, 31, 210, 118, { release: 22, stun: 28, push: 10, low: 16, high: 194,
      armorStart: 0, armorEnd: 28, melee: true, omni: true, cooldown: 240, shieldHp: 90, chargedDamage: 145, name: "REPUDIATION" }),
    ultimate: move(64, 18, 60, 130, 325, { release: 64, cinematicFrames: 24, armorEnd: 82,
      stun: 14, push: 0, low: 12, high: 188, melee: true, cooldown: 360, name: "PUBLIC EXECUTION" }),
  },
  acheron: {
    light: move(7, 4, 17, 132, 66, { stun: 19, push: 4.5, low: 24, high: 168, name: "TRILATERAL WILTCROSS" }),
    heavy: move(19, 5, 31, 190, 140, { stun: 27, push: 9, low: 22, high: 186, cooldown: 100, name: "QUADRIVALENT ASCENDANCE" }),
    skill: move(23, 6, 29, 255, 142, { release: 23, stun: 27, push: 8, low: 12, high: 226,
      melee: true, cooldown: 120, name: "OCTOBOLT FLASH" }),
    ultimate: move(38, 1, 0, 0, 0, { release: 38, cinematicFrames: 24, armorEnd: 30,
      cooldown: 300, name: "SLASHED DREAMS CRY IN RED" }),
    empoweredLight: move(12, 5, 19, 210, 74, { release: 12, stun: 22, push: 3, low: 14, high: 210,
      melee: true, name: "RAINBLADE" }),
    finisher: move(28, 6, 38, 330, 166, { release: 28, stun: 34, push: 15, low: 0, high: 270,
      melee: true, name: "STYGIAN RESURGE" }),
  },
  boothill: {
    light: move(11, 1, 23, 850, 56, { release: 11, stun: 17, push: 5, projectile: true, name: "REVOLVER SHOT" }),
    heavy: move(14, 5, 25, 145, 110, { stun: 26, push: 14, low: 8, high: 135, name: "SKULLCRUSH SPURS" }),
    skill: move(20, 1, 12, 850, 0, { release: 20, cooldown: 390, name: "SIZZLIN' TANGO" }),
    ultimate: move(68, 1, 45, 950, 310, { release: 68, cinematicFrames: 30, armorEnd: 68,
      cooldown: 360, projectile: true, name: "DUST DEVIL'S SUNSET RODEO" }),
    fanning: move(11, 9, 25, 850, 78, { release: 11, releases: [11, 15, 19],
      pulseDamage: 26, stun: 10, push: 1.8, projectile: true, name: "FANNING THE HAMMER" }),
  },
});

export const mountedMoves = Object.freeze({
  medusa: {
    speed: 7, jump: 13.5, dashSpeed: 16,
    light: move(8, 5, 18, 152, 70, { stun: 18, push: 5, low: 35, high: 216 }),
    heavy: move(19, 6, 30, 194, 128, { stun: 27, push: 9, low: 22, high: 235 }),
    charge: move(14, 18, 28, 150, 168, { stun: 29, push: 13, low: 18, high: 225,
      speed: 20, cooldown: 105, armorStart: 14, armorEnd: 32, melee: true, name: "PEGASUS CHARGE" }),
  },
  iskandar: {
    speed: 5.5, jump: 12.8, dashSpeed: 14,
    light: move(11, 5, 22, 173, 88, { stun: 22, push: 7, low: 25, high: 225 }),
    heavy: move(24, 7, 36, 218, 160, { stun: 30, push: 12, low: 15, high: 247 }),
    charge: move(18, 20, 36, 165, 205, { stun: 33, push: 16, low: 18, high: 235,
      speed: 16, cooldown: 132, armorStart: 18, armorEnd: 38, melee: true, name: "BUCEPHALUS CHARGE" }),
  },
});

export function getMove(p, action = p.action) {
  return (p.mount && mountedMoves[p.char]?.[action]) || moves[p.char]?.[action];
}

/** Mounted fighters expose a larger body instead of becoming harder to hit. */
export function hurtbox(p) {
  const half = p.mount ? 62 : (characters[p.char].hurtWidth ?? 58) / 2;
  return { left: p.x - half, right: p.x + half, bottom: p.y + 8, top: p.y + (p.mount ? 245 : characters[p.char].hurtHeight ?? 164) };
}

/** The renderer and collision system share the same committed weapon geometry.
 * Coordinates use world space and positive-up height, as do fighter positions. */
export function attackGeometry(p) {
  if (p.action !== "ultimate") return null;
  const f = p.actionFrame;
  if (p.char === "saber") {
    return saberSwordGeometry(p);
  }
  if (p.char === "lancer") {
    const progress = clamp((f - 80) / 9, 0, 1), angle = 0.08 + progress * 0.67;
    const base = { x: p.x + p.face * 22, y: p.y + 95 };
    return { kind: "spear-thrust", base,
      tip: { x: base.x + p.face * Math.cos(angle) * 245, y: base.y + Math.sin(angle) * 245 },
      angle, radius: 18, progress, active: f >= 72 && f < 90 };
  }
  return null;
}

const WIDTH = 960;
const ATTACKS = ["light", "heavy", "heavyFollow", "empoweredLight", "finisher", "fanning", "skill", "ultimate", "charge"];
const BUTTONS = [
  INPUT.ULT,
  INPUT.SKILL,
  INPUT.HEAVY,
  INPUT.LIGHT,
  INPUT.DASH,
  INPUT.JUMP,
];
const ACTION = {
  [INPUT.ULT]: "ultimate",
  [INPUT.SKILL]: "skill",
  [INPUT.HEAVY]: "heavy",
  [INPUT.LIGHT]: "light",
  [INPUT.DASH]: "dash",
  [INPUT.JUMP]: "jump",
};
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const attacking = (p) => ATTACKS.includes(p.action);
const free = (p) =>
  ["idle", "run", "jump", "guard"].includes(p.action) &&
  !p.hitstun &&
  !p.blockstun;
const makePlayer = (char, slot, training) => ({
  char,
  x: slot ? 670 : 290,
  y: 0,
  vx: 0,
  vy: 0,
  face: slot ? -1 : 1,
  hp: characters[char].maxHp,
  maxHp: characters[char].maxHp,
  meter: training ? 100 : 0,
  action: "idle",
  actionFrame: 0,
  actionDuration: 0,
  hitstun: 0,
  blockstun: 0,
  invuln: 0,
  input: 0,
  buffers: [],
  moveConnected: false,
  dashCooldown: 0,
  combo: 0,
  comboTimer: 0,
  damageDealt: 0,
  lastDamage: 0,
  recoverable: 0,
  grounded: true,
  cast: null,
  mount: null,
  cooldowns: {},
  slow: null,
  haste: null,
  shield: null,
  recast: null,
  bike: null,
  suppressed: null,
  empower: null,
  duel: null,
  exposed: null,
});

export function createMatch({
  chars = ["saber", "archer"],
  training = false,
  bestOf = 3,
  seed = 1,
} = {}) {
  const selected = [0, 1].map((i) =>
    Object.hasOwn(characters, chars?.[i]) ? chars[i] : i ? "archer" : "saber",
  );
  return {
    tick: 0,
    phase: "countdown",
    phaseFrame: 0,
    timer: 90 * 60,
    round: 1,
    score: [0, 0],
    winner: null,
    roundWinner: null,
    roundReason: null,
    bestOf: [1, 3, 5].includes(bestOf) ? bestOf : 3,
    training: Boolean(training),
    seed: seed >>> 0,
    players: selected.map((char, i) => makePlayer(char, i, training)),
    projectiles: [],
    effects: [],
    events: [],
    hitstop: 0,
    cinematic: null,
    nextId: 1,
  };
}

function event(state, type, owner, target = null, extra = {}) {
  const p = state.players[owner ?? 0];
  const e = {
    id: state.nextId++,
    type,
    x: p.x,
    y: p.y + 90,
    owner,
    target,
    damage: 0,
    ...extra,
  };
  state.events.push(e);
  return e;
}
function effect(state, type, x, y, owner, life = 20) {
  state.effects.push({
    id: state.nextId++,
    type,
    x,
    y,
    owner,
    life,
    maxLife: life,
  });
}
function startAction(state, p, slot, action, direction = 0) {
  p.action = action;
  p.actionFrame = -1;
  p.moveConnected = false;
  p.actionDuration =
    getMove(p, action)?.duration ?? (action === "dash" ? 15 : 0);
  if (ATTACKS.includes(action)) {
    const id = state.nextId++;
    const castSeed = hash(state.seed ^ Math.imul(state.tick, 7919) ^ Math.imul(id, 104729) ^ slot);
    p.cast = { id, action, face: p.face, seed: castSeed, emitted: [], hitPulses: [],
      weapons: Array.from({ length: 3 }, (_, i) => ["sword", "spear", "axe"][hash(castSeed + i * 65537) % 3]) };
    const m = getMove(p);
    if (m.cooldown) p.cooldowns[action] = m.cooldown;
    if (action === "heavyFollow") p.recast = null;
    if (p.char === "acheron" && action === "empoweredLight") p.cast.empoweredSequence = p.empower.used;
    if (p.char === "acheron" && action === "finisher") {
      p.empower.finisherPending = false;
      p.empower.finisherStarted = true;
      effect(state, "acheron-finish-windup", p.x, p.y + 105, slot, 28);
    }
    if (p.char === "ambessa" && action === "skill") {
      p.shield = { hp: m.shieldHp, remaining: 40, castId: id };
      effect(state, "ambessa-shield", p.x, p.y + 90, slot, 40);
    }
  }
  if (action === "jump") {
    p.vy = p.mount ? mountedMoves[p.char].jump : characters[p.char].jump;
    p.grounded = false;
    p.y = Math.max(p.y, 0.1);
    effect(state, "jump", p.x, 0, slot, 14);
  } else if (action === "dash") {
    p.vx = (direction || p.face) * (p.mount ? mountedMoves[p.char].dashSpeed : 12) * (p.slow?.multiplier ?? 1);
    p.invuln = 6;
    p.dashCooldown = 46;
    effect(state, "dash", p.x, p.y + 50, slot, 18);
  } else if (action === "ultimate") {
    const intro = getMove(p).cinematicFrames ?? 60;
    p.meter = state.training ? 100 : 0;
    p.vx = 0;
    p.invuln = intro + 4;
    if (state.cinematic) {
      state.cinematic.owners.push(slot);
      state.cinematic.ownerFrames[slot] = intro;
      state.cinematic.life = Math.max(state.cinematic.life, intro);
      state.cinematic.maxLife = Math.max(state.cinematic.maxLife, intro);
    }
    else
      state.cinematic = { owner: slot, owners: [slot], ownerFrames: { [slot]: intro }, life: intro, maxLife: intro };
    event(state, "ultimate", slot);
    effect(state, "ultimate", p.x, p.y + 95, slot, getMove(p).transform ? 40 : 145);
  } else if (action === "charge") {
    p.mount.chargeCooldown = getMove(p).cooldown;
    p.vx = 0;
    event(state, "swing", slot, null, { heavy: true, source: "mount-charge", castId: p.cast.id });
    effect(state, "mount-charge", p.x, p.y + 95, slot, getMove(p).startup);
  } else if (attacking(p)) {
    p.vx *= 0.25;
    if (action !== "skill")
      event(state, "swing", slot, null, { heavy: action === "heavy" });
  }
}

function readInput(p, mask, tick) {
  const safeMask = Number.isFinite(mask) ? (mask | 0) & 511 : 0;
  const pressed = safeMask & ~p.input;
  p.input = safeMask;
  p.buffers = p.buffers.filter((b) => b.until >= tick);
  for (const bit of BUTTONS)
    if (pressed & bit) {
      p.buffers = p.buffers.filter((b) => b.bit !== bit);
      p.buffers.push({ bit, until: tick + 7 });
    }
}

function intent(state, p, slot) {
  const opponent = state.players[1 - slot];
  const dir = (p.input & INPUT.RIGHT ? 1 : 0) - (p.input & INPUT.LEFT ? 1 : 0);
  if (free(p)) p.face = opponent.x >= p.x ? 1 : -1;
  if (p.hitstun || p.blockstun || p.suppressed || p.action === "ko") return;
  if (p.empower?.finisherPending && free(p)) {
    p.buffers = p.buffers.filter(b => b.bit !== INPUT.LIGHT && b.bit !== INPUT.ULT);
    startAction(state, p, slot, "finisher");
    return;
  }
  // A second press detaches this single bike; holding U never requests another cast.
  if (p.bike && p.actionFrame >= 58 && p.buffers.some(b => b.bit === INPUT.ULT)) {
    p.cast.bikeReleaseRequested = true;
    p.buffers = p.buffers.filter(b => b.bit !== INPUT.ULT);
  }
  const canCancel =
    p.action === "light" &&
    p.moveConnected &&
    p.actionFrame >= getMove(p, "light").startup;
  for (const bit of BUTTONS) {
    const entry = p.buffers.find((b) => b.bit === bit);
    if (!entry) continue;
    const action = p.mount && (bit === INPUT.ULT || bit === INPUT.SKILL) ? "charge"
      : bit === INPUT.HEAVY && p.recast?.action === "heavyFollow" ? "heavyFollow"
      : bit === INPUT.LIGHT && p.empower?.charges > 0 ? "empoweredLight"
      : bit === INPUT.LIGHT && p.duel ? "fanning" : ACTION[bit];
    const canRecast = action === "heavyFollow" && p.action === "heavy" && p.actionFrame >= 19;
    if (
      !free(p) &&
      !(canCancel && ["heavy", "heavyFollow", "skill", "ultimate"].includes(action)) && !canRecast
    )
      continue;
    if (action === "ultimate" && (p.meter < 100 || p.y > 0 || p.empower)) continue;
    if ((p.cooldowns[action] ?? 0) > 0) continue;
    if (p.char === "boothill" && action === "skill" && p.duel) continue;
    if (action === "charge" && (p.mount.chargeCooldown > 0 || p.y > 0)) continue;
    if (action === "skill" && ["lancer", "iskandar", "katja", "magnus", "ambessa"].includes(p.char) && p.y > 0) continue;
    if (action === "dash" && (p.dashCooldown > 0 || p.y > 0)) continue;
    if (action === "jump" && p.y > 0) continue;
    p.buffers = p.buffers.filter((b) => b !== entry);
    startAction(state, p, slot, action, dir);
    return;
  }
  if (free(p)) {
    if (p.y === 0 && p.input & INPUT.GUARD) {
      if (p.action !== "guard") p.actionFrame = -1;
      p.action = "guard";
      p.vx = 0;
    } else {
      const next = p.y > 0 ? "jump" : dir ? "run" : "idle";
      if (p.action !== next) p.actionFrame = -1;
      p.action = next;
      p.vx = dir * (p.mount ? mountedMoves[p.char].speed : characters[p.char].speed) * (p.y > 0 ? 0.87 : 1)
        * (p.slow?.multiplier ?? 1) * (p.haste?.multiplier ?? 1);
    }
  }
}

function advanceStatuses(state) {
  for (const p of state.players) {
    for (const key of Object.keys(p.cooldowns)) if (p.cooldowns[key] > 0) p.cooldowns[key]--;
    for (const key of ["slow", "haste", "shield", "recast", "suppressed", "duel", "exposed"])
      if (p[key] && --p[key].remaining <= 0) p[key] = null;
    if (p.bike && (p.action !== "ultimate" || p.hp <= 0)) p.bike = null;
  }
}

function activateMount(state, p, slot, type) {
  p.mount = { type, remaining: 480, duration: 480, chargeCooldown: 0, castId: p.cast.id };
  p.vx = 0;
  p.x = clamp(p.x, 62, WIDTH - 62);
  effect(state, "mount-on", p.x, 105, slot, 34);
  event(state, "mount", slot, null, { mountType: type, remaining: 480 });
}

function endMount(state, p, slot, reason) {
  if (!p.mount) return;
  const type = p.mount.type;
  p.mount = null;
  p.meter = state.training ? 100 : 0;
  p.buffers = p.buffers.filter(b => b.bit !== INPUT.ULT && b.bit !== INPUT.SKILL);
  if (attacking(p) || p.action === "dash") {
    p.action = p.hitstun > 0 ? "hurt" : p.y > 0 ? "jump" : "idle";
    p.actionFrame = 0; p.actionDuration = 0; p.invuln = 0; p.moveConnected = true; p.cast = null;
  }
  p.vx = clamp(p.vx, -characters[p.char].speed, characters[p.char].speed);
  effect(state, "mount-off", p.x, p.y + 80, slot, 23);
  event(state, "dismount", slot, null, { mountType: type, reason });
}

function advanceMounts(state) {
  for (let slot = 0; slot < 2; slot++) {
    const p = state.players[slot];
    if (!p.mount) continue;
    if (p.mount.chargeCooldown > 0) p.mount.chargeCooldown--;
    if (--p.mount.remaining <= 0) endMount(state, p, slot, "expired");
  }
}

function projectile(state, slot, type, config) {
  const p = state.players[slot];
  const value = {
    id: state.nextId++,
    owner: slot,
    type,
    x: p.x + p.face * 62,
    y: p.y + 89,
    vx: p.face * 13,
    width: 70,
    height: 50,
    life: 85,
    damage: 100,
    stun: 25,
    push: 8,
    heavy: false,
    castId: p.cast?.id ?? 0,
    direction: p.cast?.face ?? p.face,
    ...config,
  };
  state.projectiles.push(value);
  event(state, "projectile", slot, null, {
    x: value.x,
    y: value.y,
    projectileType: type,
  });
}

function once(p, key, callback) {
  if (p.cast?.emitted.includes(key)) return;
  p.cast?.emitted.push(key);
  callback();
}

function segmentHitsBody(geometry, victim) {
  // Segment against an expanded AABB: an inexpensive deterministic capsule
  // approximation. This uses the blade's real angle, not its whole swept box.
  const { base, tip, radius } = geometry;
  const box = hurtbox(victim);
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [
    [base.x, tip.x - base.x, box.left - radius, box.right + radius],
    [base.y, tip.y - base.y, box.bottom - radius, box.top + radius],
  ]) {
    if (Math.abs(delta) < 0.000001) { if (origin < min || origin > max) return false; }
    else {
      const first = (min - origin) / delta, second = (max - origin) / delta;
      low = Math.max(low, Math.min(first, second)); high = Math.min(high, Math.max(first, second));
      if (low > high) return false;
    }
  }
  return true;
}

function melee(state, slot, hits, m, source = "melee", geometry = null, pulse = null) {
  const p = state.players[slot], victim = state.players[1 - slot];
  const box = hurtbox(victim);
  if ((pulse === null ? p.moveConnected : p.cast.hitPulses.includes(pulse)) || victim.invuln > 0) return;
  const near = m.omni ? box.right >= p.x - m.range && box.left <= p.x + m.range : p.face > 0
    ? box.right >= p.x + 20 && box.left <= p.x + m.range
    : box.left <= p.x - 20 && box.right >= p.x - m.range;
  const vertical = box.top >= p.y + m.low && box.bottom <= p.y + m.high;
  if (!(geometry ? segmentHitsBody(geometry, victim) : near && vertical)) return;
  hits.push({ owner: slot, target: 1 - slot, damage: m.damage, stun: m.stun, push: m.push,
    launch: m.launch ?? 0, direction: m.omni ? Math.sign(victim.x - p.x) || p.face : p.cast?.face ?? p.face,
    heavy: p.action !== "light", x: victim.x - p.face * 20,
    y: Math.min(victim.y + 115, p.y + 112), source, castId: p.cast?.id,
    ...(m.meterGain !== undefined ? { meterGain: m.meterGain } : {}),
    ...(m.suppress ? { suppress: m.suppress } : {}),
    ...(pulse === null ? {} : { pulse, hitstop: pulse < 8 ? 2 : 12 }) });
  p.moveConnected = true;
  if (pulse !== null) p.cast.hitPulses.push(pulse);
}

function gateWeapon(state, slot, kind, m, burst = false, sequence = 0) {
  const p = state.players[slot];
  const style = {
    sword: { width: 90, height: 28, speed: 14, damage: 42 },
    spear: { width: 128, height: 20, speed: 17, damage: 40 },
    axe: { width: 104, height: 72, speed: 11.5, damage: 46 },
  }[kind];
  const y = p.y + (burst ? [145, 112, 165][sequence] : 133);
  projectile(state, slot, `gold-${kind}`, {
    x: p.x + p.face * 45, y, vx: p.face * style.speed,
    width: style.width, height: style.height, life: 64,
    damage: burst ? style.damage : m.damage, stun: m.stun, push: m.push,
    heavy: p.action !== "light", weapon: kind, sequence,
    ...(burst ? { meterGain: m.meterGain } : {}),
  });
  effect(state, "gold-portal", p.x + p.face * 45, y, slot, 19);
}

function gojoShot(state, slot, action, m) {
  const p = state.players[slot];
  const props = {
    light: { type: "blue-orb", width: 46, height: 46, speed: 14 },
    heavy: { type: "red-orb", width: 80, height: 80, speed: 12 },
    skill: { type: "blue-pull", width: 118, height: 125, speed: 12 },
  }[action];
  projectile(state, slot, props.type, { y: p.y + 120, vx: p.face * props.speed,
    width: props.width, height: props.height, life: 64, damage: m.damage,
    stun: m.stun, push: m.push, pull: action === "skill", heavy: action !== "light" });
}

function katjaShot(state, slot, action, m) {
  const p = state.players[slot], cone = action === "skill", origin = katjaShotOrigin(p, action);
  projectile(state, slot, cone ? "katja-cone" : action === "heavy" ? "katja-aimed" : "katja-bullet", {
    ...origin,
    spawnX: p.x + p.face * 25,
    vx: p.face * (cone ? 19 : 28), width: cone ? 100 : 50, height: cone ? 126 : 15,
    life: cone ? 9 : 38, damage: m.damage, stun: m.stun, push: m.push, heavy: action !== "light",
    ...(action === "heavy" ? { traveled: 0, distanceBonus: 60, bonusDistance: 600 } : {}),
    ...(cone ? { slow: { remaining: 60, multiplier: .65 }, haste: { remaining: 90, multiplier: 1.2 } } : {}),
  });
}

function releaseBike(state, p, slot) {
  once(p, "bike-finish", () => {
    projectile(state, slot, "magnus-bike", { x: p.x + p.face * magnusBikeShape.detachOffset,
      y: magnusBikeShape.projectileY, vx: p.face * 20,
      width: magnusBikeShape.projectileWidth, height: magnusBikeShape.projectileHeight,
      life: 35, damage: 330, stun: 35, push: 16, heavy: true,
      ultimate: true, hitLedger: [] });
    effect(state, "magnus-dismount", p.x, 70, slot, 20);
  });
  p.bike = null;
  p.actionFrame = 111;
  p.vx = 0;
}

function boothillShot(state, p, slot, m, sequence = null) {
  const origin = boothillShotOrigin(p);
  projectile(state, slot, sequence === null ? "boothill-bullet" : "boothill-fanning", {
    ...origin, ...boothillPitch(p, state.players[1 - slot], origin, 23, 16),
    spawnX: p.x + p.face * 20, width: 42, height: 16, life: 43,
    damage: sequence === null ? m.damage : m.pulseDamage,
    stun: m.stun, push: m.push, heavy: false, sequence,
    ...(sequence === null ? {} : { meterGain: 3 }),
  });
  effect(state, "boothill-muzzle", origin.x, origin.y, slot, 7);
}

function boothillPitch(p, victim, origin, speed, height) {
  const box = hurtbox(victim);
  // Only compensate for a shorter grounded body that a horizontal muzzle shot
  // would clear entirely. This one-time pitch never follows a moving opponent.
  const lower = p.grounded && victim.grounded && origin.y - height / 2 > box.top;
  const chest = box.bottom + (box.top - box.bottom) * .72;
  const forward = Math.max(speed, (victim.x - origin.x) * p.face);
  return { vx: p.face * speed, vy: lower ? (chest - origin.y) / forward * speed : 0 };
}

function emitAttacks(state, slot, hits) {
  const p = state.players[slot];
  if (!attacking(p)) return;
  const m = getMove(p);
  const f = p.actionFrame;
  if (p.char === "katja" && p.action !== "ultimate") {
    if (f === m.release) once(p, "shot", () => katjaShot(state, slot, p.action, m));
  } else if (p.char === "boothill" && p.action !== "ultimate") {
    if (p.action === "skill" && f === m.release) once(p, "standoff", () => {
      p.duel = { target: 1 - slot, remaining: 300, castId: p.cast.id };
      effect(state, "boothill-standoff", state.players[1 - slot].x, 110, slot, 30);
      event(state, "duel", slot, 1 - slot, { remaining: 300, castId: p.cast.id });
    });
    else if (p.action === "light" && f === m.release) once(p, "bullet", () => boothillShot(state, p, slot, m));
    else if (p.action === "fanning") {
      const sequence = m.releases.indexOf(f);
      if (sequence >= 0) once(p, `fanning-${sequence}`, () => boothillShot(state, p, slot, m, sequence));
    } else if (p.action === "heavy") {
      if (f === m.startup) once(p, "heel", () => effect(state, "boothill-spur", p.x + p.face * 65, 55, slot, 20));
      if (f >= m.startup && f < m.startup + m.active) melee(state, slot, hits, m, "boothill-spur");
    }
  } else if (p.char === "acheron" && p.action !== "ultimate") {
    if (f === m.startup) once(p, "slash", () => {
      if (p.action === "empoweredLight" && p.empower) {
        p.empower.charges--;
        p.empower.used++;
        p.empower.finisherPending = p.empower.charges === 0;
        event(state, "empower", slot, null, { charges: p.empower.charges, used: p.empower.used, castId: p.empower.castId });
      }
      const type = { light: "acheron-wiltcross", heavy: "acheron-ascendance", skill: "acheron-octobolt",
        empoweredLight: "acheron-rainblade", finisher: "acheron-stygian" }[p.action];
      effect(state, type, p.x + p.face * (p.action === "finisher" ? 130 : 80), p.y + 105, slot,
        p.action === "finisher" ? 34 : p.action === "skill" ? 25 : 18);
    });
    if (f >= m.startup && f < m.startup + m.active)
      melee(state, slot, hits, m, p.action === "empoweredLight" ? "ult-acheron-rainblade"
        : p.action === "finisher" ? "ult-acheron-stygian" : `acheron-${p.action}`);
  } else if (p.char === "magnus" && p.action === "skill") {
    const pulse = m.releases.indexOf(f);
    if (pulse >= 0) once(p, `spin-${pulse}`, () => {
      melee(state, slot, hits, { ...m, damage: m.pulseDamage }, "magnus-spin", null, pulse);
      effect(state, "magnus-spin", p.x, 95, slot, 12);
      event(state, "swing", slot, null, { source: "magnus-spin", pulse, heavy: true });
    });
  } else if (p.char === "ambessa" && p.action === "skill") {
    if (f === m.release) once(p, "slam", () => effect(state, "ambessa-slam", p.x, 70, slot, 24));
    if (f >= m.startup && f < m.startup + m.active)
      melee(state, slot, hits, { ...m, damage: p.cast.shieldCharged ? m.chargedDamage : m.damage }, "ambessa-slam");
  } else if (p.char === "gojo" && p.action !== "ultimate") {
    if (f === m.release) once(p, "orb", () => gojoShot(state, slot, p.action, m));
  } else if (p.action === "charge") {
    if (f >= m.startup && f < m.startup + m.active) melee(state, slot, hits, m, "mount-charge");
  } else if (p.char === "gilgamesh" && p.action !== "ultimate") {
    if (p.action === "skill") {
      const index = m.releases.indexOf(f);
      if (index !== -1) once(p, `weapon-${index}`, () => gateWeapon(state, slot, p.cast.weapons[index], m, true, index));
    } else if (f === m.release) once(p, "weapon", () => gateWeapon(state, slot, p.action === "light" ? "sword" : "axe", m));
  } else if (p.action === "skill" && m.melee) {
    if (f === m.startup) once(p, "thrust", () => effect(state,
      { lancer: "lancer-thrust", medusa: "chain-stab", iskandar: "iskandar-sweep", heracles: "heracles-slam" }[p.char], p.x, 106, slot, 18));
    if (f >= m.startup && f < m.startup + m.active) melee(state, slot, hits, m);
  } else if (p.action === "skill" && f === m.release) {
    if (p.char === "allmight") once(p, "shockwave", () => {
      projectile(state, slot, "detroit-wave", { y: p.y + 118, vx: p.face * 15, width: 130, height: 110,
        life: 20, damage: m.damage, stun: m.stun, push: m.push, heavy: true });
      effect(state, "detroit-smash", p.x + p.face * 60, p.y + 118, slot, 22);
    });
    else once(p, "projectile", () => projectile(state, slot, p.char === "saber" ? "wave" : "arrow", {
      y: p.y + (p.char === "saber" ? 89 : ARCHER_ARROW_HEIGHT),
      width: p.char === "saber" ? 72 : 105,
      height: p.char === "saber" ? 112 : 22,
      vx: p.face * (p.char === "saber" ? 10.8 : 17),
      damage: m.damage,
      stun: m.stun,
      push: m.push,
      heavy: true,
    }));
  } else if (p.action === "ultimate") {
    if (m.transform) {
      if (f === m.release) once(p, "transform", () => activateMount(state, p, slot, m.transform));
    } else if (p.char === "acheron") {
      if (f === m.release) once(p, "awaken", () => {
        p.empower = { type: "acheron", charges: 3, used: 0, castId: p.cast.id,
          finisherPending: false, finisherStarted: false };
        p.meter = state.training ? 100 : 0;
        effect(state, "acheron-awaken", p.x, p.y + 110, slot, 36);
        event(state, "empower", slot, null, { charges: 3, used: 0, castId: p.cast.id });
      });
    } else if (p.char === "boothill") {
      if (f === 38) once(p, "sight", () => {
        const origin = boothillShotOrigin(p);
        effect(state, "boothill-sight", origin.x, origin.y, slot, 30);
      });
      if (f === m.release) once(p, "deadeye", () => {
        const origin = boothillShotOrigin(p);
        projectile(state, slot, "boothill-deadeye", { ...origin,
          ...boothillPitch(p, state.players[1 - slot], origin, 27, 60), spawnX: p.x + p.face * 20,
          width: 110, height: 60, life: 42, damage: m.damage,
          stun: 24, push: 11, heavy: true, ultimate: true,
          slow: { remaining: 90, multiplier: .65 }, exposed: { remaining: 120, multiplier: 1.12 } });
        effect(state, "boothill-rodeo", origin.x, origin.y, slot, 26);
      });
    } else if (p.char === "katja") {
      if (f === 36) once(p, "scan", () => effect(state, "katja-scan", p.x, 205, slot, 68));
      const sequence = m.releases.indexOf(f);
      if (sequence >= 0) once(p, `precision-${sequence}`, () => {
        const target = state.players[1 - slot];
        const aimedY = clamp(target.y + 105, 32, 310), origin = katjaShotOrigin(p, "ultimate", sequence);
        projectile(state, slot, "katja-precision", { ...origin,
          vx: p.face * 25, width: 62, height: 22, life: 43, damage: [80, 105, 135][sequence],
          vy: clamp((aimedY - origin.y) / Math.max(80, Math.abs(target.x - origin.x)) * 25, -12, 12),
          stun: 15, push: 3, heavy: true, ultimate: true, sequence,
          slow: { remaining: 72, multiplier: .65 } });
        effect(state, "katja-muzzle", origin.x, origin.y, slot, 8);
      });
    } else if (p.char === "magnus") {
      if (f === 50) once(p, "bike", () => {
        p.bike = { castId: p.cast.id, age: 0, speed: 8, direction: p.face };
        effect(state, "magnus-bike-start", p.x, 60, slot, 18);
      });
      if (p.bike && (p.cast.bikeReleaseRequested || f >= 110 || p.face < 0 && p.x <= 39 || p.face > 0 && p.x >= WIDTH - 39)) releaseBike(state, p, slot);
      else if (p.bike) {
        const before = p.moveConnected;
        melee(state, slot, hits, m, "ult-magnus-bike");
        if (!before && p.moveConnected) {
          once(p, "bike-finish", () => effect(state, "magnus-crash", p.x + p.face * 65, 80, slot, 32));
          p.bike = null; p.actionFrame = 111; p.vx = 0;
        }
      }
    } else if (p.char === "ambessa") {
      if (f === 52) once(p, "telegraph", () => effect(state, "ambessa-rush", p.x, 95, slot, 30));
      if (!p.cast.grab && f >= 64 && f < 82) {
        const before = hits.length;
        melee(state, slot, hits, { ...m, damage: 45, suppress: 14, launch: 9 }, "ult-ambessa-grab");
        if (hits.length > before) {
          p.cast.grab = { target: 1 - slot, finishFrame: f + 14 };
          const victim = state.players[1 - slot];
          p.x = clamp(victim.x + p.face * 75, 38, WIDTH - 38);
          p.vx = 0;
          effect(state, "ambessa-catch", victim.x, 105, slot, 14);
        }
      }
      if (p.cast.grab && f === p.cast.grab.finishFrame) once(p, "finisher", () => {
        const victim = state.players[p.cast.grab.target];
        // A finite, guardable follow-up still requires the caught target to be nearby.
        if (Math.abs(victim.x - p.x) <= 190 && Math.abs(victim.y - p.y) < 200 && !victim.invuln) {
          hits.push({ owner: slot, target: p.cast.grab.target, damage: 280, stun: 22, push: 14,
            direction: Math.sign(victim.x - p.x) || p.cast.face, heavy: true, x: victim.x, y: victim.y + 100,
            source: "ult-ambessa-finish", castId: p.cast.id, slam: true });
          effect(state, "ambessa-finish", victim.x, 100, slot, 30);
        }
      });
    } else if (p.char === "gojo") {
      if (f === m.release) once(p, "domain", () => {
        projectile(state, slot, "void-domain", { x: p.x, y: 110, vx: 0, width: 540, height: 220,
          life: 2, damage: 0, stun: m.stun, push: 0, heavy: false, ultimate: true, hitstop: 2 });
        effect(state, "void-domain", p.x, 110, slot, 84);
      });
      if (f === m.finisher) once(p, "purple", () => projectile(state, slot, "hollow-purple", {
        y: 115, vx: p.face * 20, width: 140, height: 170, life: 50,
        damage: m.damage, stun: 40, push: 14, heavy: true, ultimate: true,
      }));
    } else if (p.char === "heracles") {
      const pulse = m.releases.indexOf(f);
      if (pulse !== -1) once(p, `nine-${pulse}`, () => {
        const final = pulse === 8;
        melee(state, slot, hits, { ...m, damage: final ? m.finisherDamage : m.pulseDamage,
          stun: final ? 42 : m.stun, push: final ? 17 : m.push }, "ult-nine-lives", null, pulse);
        effect(state, "nine-lives", p.x + p.face * 80, 116, slot, final ? 30 : 10);
        event(state, "swing", slot, null, { heavy: true, source: "ult-nine-lives", pulse });
      });
    } else if (p.char === "allmight") {
      if (f >= m.startup && f < m.startup + m.active) {
        const wasConnected = p.moveConnected;
        melee(state, slot, hits, m, "ult-united-states-smash");
        if (!wasConnected && p.moveConnected) effect(state, "united-states-smash", p.x + p.face * 90, 95, slot, 40);
      }
    } else if (p.char === "saber" || p.char === "lancer") {
      const geometry = attackGeometry(p);
      if (f === m.release) once(p, "sweep", () => {
        event(state, "swing", slot, null, { heavy: true, source: `ult-${p.char}`, castId: p.cast.id });
        effect(state, p.char === "saber" ? "gold-sweep" : "gaebolg", p.x, 95, slot, 26);
      });
      if (geometry.active) melee(state, slot, hits, m, `ult-${p.char}`, geometry);
    } else if (p.char === "gilgamesh" && f === m.release) {
      once(p, "enuma-beam", () => {
        const direction = p.cast.face, originX = p.x + direction * 54;
        projectile(state, slot, "enuma-beam", {
          x: originX + direction * 430, originX, y: 110, vx: 0, direction, dir: direction,
          width: 860, height: 174, life: 48, maxLife: 48, age: 0,
          damage: m.pulseDamage, stun: m.stun, push: m.push, heavy: true,
          pulseInterval: m.pulseInterval, pulseCount: m.pulseCount, hitLedger: [[], []],
        });
        effect(state, "enuma-origin", originX, 110, slot, 48);
      });
    } else if (p.char === "archer" && m.releases.includes(f)) {
      const finish = f === 111;
      once(p, `arrow-${f}`, () => projectile(state, slot, finish ? "ult-finish" : "ult-arrow", {
        y: 93,
        vx: p.face * 26,
        width: finish ? 190 : 145,
        height: finish ? 210 : 145,
        life: 45,
        damage: finish ? 154 : 70,
        stun: finish ? 38 : 20,
        push: finish ? 12 : 2,
        heavy: true,
      }));
    }
  } else if (f >= m.startup && f < m.startup + m.active && !p.moveConnected) {
    melee(state, slot, hits, m);
  }
}

function advancePlayer(state, p, slot) {
  p.actionFrame++;
  if (p.invuln > 0) p.invuln--;
  if (p.dashCooldown > 0) p.dashCooldown--;
  if (p.comboTimer > 0) p.comboTimer--;
  else p.combo = 0;
  if (p.hitstun > 0) {
    p.hitstun--;
    if (!p.hitstun && p.action === "hurt") {
      p.action = p.y > 0 ? "jump" : "idle";
      p.actionFrame = 0;
    }
  }
  if (p.blockstun > 0) p.blockstun--;
  if (p.action === "dash") {
    if (p.actionFrame > 8) p.vx *= 0.8;
  } else if (attacking(p)) {
    p.vx *= 0.8;
    // A small committed step makes the sword follow through with its visual swing.
    if (
      p.y === 0 &&
      p.action === "heavy" &&
      !["gilgamesh", "katja"].includes(p.char) &&
      p.actionFrame >= 11 &&
      p.actionFrame < 17
    )
      p.vx = p.face * 2.5;
    if (p.char === "lancer" && p.action === "skill") {
      p.vx = !p.moveConnected && p.actionFrame >= 10 && p.actionFrame < 25 ? p.face * 14 : 0;
    } else if (p.char === "lancer" && p.action === "ultimate") {
      p.vx = !p.moveConnected && p.actionFrame >= 70 && p.actionFrame < 87 ? p.face * 24 : 0;
    } else if (p.char === "iskandar" && p.action === "skill" && p.actionFrame >= 18 && p.actionFrame < 24) {
      p.vx = p.face * 4.5;
    } else if (p.char === "heracles" && p.action === "skill" && p.actionFrame >= 16 && p.actionFrame < 26) {
      p.vx = p.face * 6;
    } else if (p.char === "heracles" && p.action === "ultimate") {
      p.vx = !p.moveConnected && p.actionFrame >= 68 && p.actionFrame < 77 ? p.face * 8 : 0;
    } else if (p.char === "allmight" && p.action === "ultimate") {
      p.vx = !p.moveConnected && p.actionFrame >= 64 && p.actionFrame < 83 ? p.face * 15 : 0;
    } else if (p.char === "katja" && p.action === "skill") {
      p.vx = p.actionFrame >= 12 && p.actionFrame < 25 ? -p.face * 8 : 0;
    } else if (p.char === "magnus" && p.action === "skill") {
      const dir = (p.input & INPUT.RIGHT ? 1 : 0) - (p.input & INPUT.LEFT ? 1 : 0);
      p.vx = p.actionFrame >= 18 && p.actionFrame < 55 ? dir * 2.3 * (p.slow?.multiplier ?? 1) : 0;
    } else if (p.char === "magnus" && p.action === "ultimate") {
      if (p.bike) { p.bike.age++; p.bike.speed = Math.min(21, 8 + p.bike.age * .55); }
      p.vx = p.bike ? p.bike.direction * p.bike.speed : 0;
    } else if (p.char === "ambessa" && p.action === "heavyFollow") {
      p.vx = p.actionFrame >= 8 && p.actionFrame < 15 && !p.moveConnected ? p.face * 7 : 0;
    } else if (p.char === "ambessa" && p.action === "ultimate") {
      p.vx = !p.cast.grab && p.actionFrame >= 60 && p.actionFrame < 82 ? p.face * 22 : 0;
    } else if (p.char === "acheron" && p.action === "heavy") {
      p.vx = !p.moveConnected && p.actionFrame >= 15 && p.actionFrame < 24 ? p.face * 15 : 0;
    } else if (p.char === "acheron" && p.action === "empoweredLight") {
      p.vx = !p.moveConnected && p.actionFrame >= 8 && p.actionFrame < 13 ? p.face * 9 : 0;
    } else if (p.action === "charge") {
      const m = getMove(p);
      p.vx = !p.moveConnected && p.actionFrame >= m.startup && p.actionFrame < m.startup + m.active ? p.face * m.speed : 0;
    }
  } else if (p.action === "hurt" || p.blockstun) p.vx *= 0.87;
  const wall = p.mount ? 62 : 38;
  p.x = clamp(p.x + p.vx, wall, WIDTH - wall);
  if (p.y > 0 || p.vy > 0) {
    p.y += p.vy;
    p.vy -= 0.67;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
      effect(state, "land", p.x, 0, slot, 12);
      if (p.action === "jump") {
        p.action = "idle";
        p.actionFrame = 0;
      }
    }
  }
}

function separate(players) {
  const [a, b] = players;
  if (a.y - b.y > (b.mount ? 220 : (characters[b.char].hurtHeight ?? 164) - 32)
      || b.y - a.y > (a.mount ? 220 : (characters[a.char].hurtHeight ?? 164) - 32)) return;
  const minDistance = (a.mount ? 62 : Math.max(30, (characters[a.char].hurtWidth ?? 58) / 2))
    + (b.mount ? 62 : Math.max(30, (characters[b.char].hurtWidth ?? 58) / 2));
  const wallA = a.mount ? 62 : 38, wallB = b.mount ? 62 : 38;
  const dist = b.x - a.x;
  if (Math.abs(dist) >= minDistance) return;
  const direction = dist === 0 ? a.face || 1 : Math.sign(dist);
  const push = (minDistance - Math.abs(dist)) / 2;
  a.x = clamp(a.x - direction * push, wallA, WIDTH - wallA);
  b.x = clamp(b.x + direction * push, wallB, WIDTH - wallB);
  // At walls, give the unconstrained fighter the remaining displacement.
  if (Math.abs(a.x - b.x) < minDistance) {
    if (a.x === wallA) b.x = wallA + minDistance;
    else if (b.x === wallB) a.x = wallB + minDistance;
    else if (a.x === WIDTH - wallA) b.x = WIDTH - wallA - minDistance;
    else if (b.x === WIDTH - wallB) a.x = WIDTH - wallB - minDistance;
  }
}

function projectileHits(state, hits) {
  for (const q of state.projectiles) {
    const oldX = q.spawnX ?? q.x;
    delete q.spawnX;
    q.x += q.vx;
    if (q.vy) q.y += q.vy;
    if (q.distanceBonus) q.traveled += Math.abs(q.vx);
    q.life--;
    const victim = state.players[1 - q.owner];
    const box = hurtbox(victim);
    const beam = q.type === "enuma-beam";
    const pulse = beam ? Math.floor(q.age / q.pulseInterval) : 0;
    const pulseDue = !beam || (q.age % q.pulseInterval === 0 && pulse < q.pulseCount && !q.hitLedger[1 - q.owner].includes(pulse));
    const minX = Math.min(oldX, q.x) - q.width / 2,
      maxX = Math.max(oldX, q.x) + q.width / 2;
    if (
      q.life > 0 &&
      pulseDue &&
      victim.invuln <= 0 &&
      box.right >= minX &&
      box.left <= maxX &&
      box.top >= q.y - q.height / 2 &&
      box.bottom <= q.y + q.height / 2
    ) {
      hits.push({
        owner: q.owner,
        target: 1 - q.owner,
        damage: q.damage + (q.distanceBonus ? Math.round(q.distanceBonus * Math.min(1, q.traveled / q.bonusDistance)) : 0),
        stun: q.stun,
        push: q.push,
        direction: q.direction ?? Math.sign(q.vx),
        heavy: q.heavy,
        x: victim.x,
        y: Math.min(victim.y + 105, q.y),
        source: q.type,
        ultimate: Boolean(q.ultimate),
        pull: Boolean(q.pull),
        castId: q.castId,
        ...(q.slow ? { slow: q.slow } : {}),
        ...(q.haste ? { haste: q.haste } : {}),
        ...(q.exposed ? { exposed: q.exposed } : {}),
        ...(q.meterGain !== undefined ? { meterGain: q.meterGain } : {}),
        ...(beam ? { hitstop: 2, pulse } : q.hitstop !== undefined ? { hitstop: q.hitstop } : {}),
      });
      const owner = state.players[q.owner];
      if (owner.cast?.id === q.castId) owner.moveConnected = true;
      if (beam) q.hitLedger[1 - q.owner].push(pulse);
      else {
        if (q.hitLedger) q.hitLedger.push(1 - q.owner);
        q.life = 0;
      }
    }
    if (beam) q.age++;
  }
  state.projectiles = state.projectiles.filter(
    (q) => q.life > 0 && (q.type === "enuma-beam" || (q.x > -250 && q.x < WIDTH + 250)),
  );
}

function applyHits(state, hits) {
  // Capture defensive state BEFORE applying any result. A hit on slot 0 cannot erase slot 0's hit.
  const defenses = state.players.map((p) => ({
    guard: (p.action === "guard" || p.blockstun > 0) && p.y === 0,
    face: p.face,
    armor: p.action === "ultimate" ? p.actionFrame >= (getMove(p, "ultimate").armorStart ?? 0) && p.actionFrame < (getMove(p, "ultimate").armorEnd ?? 125)
      : getMove(p)?.armorStart !== undefined && p.actionFrame >= getMove(p).armorStart && p.actionFrame < getMove(p).armorEnd,
  }));
  for (const hit of hits) {
    const p = state.players[hit.target],
      source = state.players[hit.owner];
    const defense = defenses[hit.target];
    const blocked = defense.guard && defense.face === -hit.direction;
    const ultimateHit =
      hit.ultimate || hit.source.startsWith("ult") || hit.source === "enuma-beam";
    const inDuel = source.duel?.target === hit.target || p.duel?.target === hit.owner;
    const scaledDamage = Math.round(hit.damage * (inDuel ? 1.1 : 1) * (p.exposed?.multiplier ?? 1));
    const incoming = blocked
      ? Math.round(scaledDamage * (ultimateHit ? 0.22 : 0.1))
      : scaledDamage;
    const absorbed = p.shield ? Math.min(p.shield.hp, incoming) : 0;
    if (p.shield && absorbed > 0) {
      p.shield.hp -= absorbed;
      if (p.cast?.id === p.shield.castId) p.cast.shieldCharged = true;
      event(state, "shield", hit.target, hit.owner, { absorbed, remaining: p.shield.hp, castId: p.shield.castId });
      if (p.shield.hp <= 0) p.shield = null;
    }
    const damage = incoming - absorbed;
    p.hp = state.training ? p.maxHp : Math.max(blocked ? 1 : 0, p.hp - damage);
    p.lastDamage = damage;
    p.recoverable = Math.min(p.maxHp, p.recoverable + damage);
    source.damageDealt += damage;
    source.meter = state.training
      ? 100
      : source.mount || source.empower ? 0
      : clamp(
          source.meter + (ultimateHit ? 0 : hit.meterGain ?? (blocked ? 4 : hit.heavy ? 13 : 9)),
          0,
          100,
        );
    p.meter = state.training ? 100 : p.mount || p.empower ? 0 : clamp(p.meter + (blocked ? 3 : 6), 0, 100);
    if (!defense.armor) p.vx = (hit.direction * hit.push * (blocked ? hit.pull ? 0 : 0.48 : 1)) || 0;
    if (blocked) {
      p.blockstun = Math.max(p.blockstun, Math.round(hit.stun * 0.6));
      p.action = "guard";
      p.actionFrame = 0;
    } else {
      source.combo = source.comboTimer > 0 ? source.combo + 1 : 1;
      source.comboTimer = 70;
      if (hit.slow) p.slow = { ...hit.slow, remaining: Math.max(p.slow?.remaining ?? 0, hit.slow.remaining) };
      if (hit.haste) source.haste = { ...hit.haste };
      if (hit.exposed) p.exposed = { ...hit.exposed };
      if (source.char === "ambessa" && source.cast?.action === "heavy" && source.cast.id === hit.castId)
        source.recast = { action: "heavyFollow", remaining: 180, castId: hit.castId };
      if (!defense.armor) {
        const stun = p.char === "magnus" && p.action === "skill" && p.actionFrame >= 18 && p.actionFrame < 55
          ? Math.ceil(hit.stun * .6) : hit.stun;
        p.hitstun = Math.max(p.hitstun, stun);
        if (hit.suppress) p.suppressed = { remaining: hit.suppress, castId: hit.castId, owner: hit.owner };
        if (p.action === "finisher") p.empower = null;
        p.action = "hurt";
        p.bike = null;
        p.actionFrame = 0;
        p.actionDuration = stun;
        if (hit.slam) { p.y = 0; p.vy = 0; p.grounded = true; }
        else if (hit.launch) { p.y = Math.max(0.1, p.y); p.vy = Math.max(p.vy, hit.launch); p.grounded = false; }
        else if (p.y > 0) p.vy = Math.max(p.vy, 3.5);
      }
    }
    state.hitstop = Math.max(state.hitstop, hit.hitstop ?? (blocked ? 4 : hit.heavy ? 10 : 6));
    event(state, blocked ? "block" : "hit", hit.owner, hit.target, {
      x: hit.x,
      y: hit.y,
      damage,
      heavy: hit.heavy,
      source: hit.source,
      combo: source.combo,
      castId: hit.castId,
      ...(absorbed ? { absorbed } : {}),
      ...(hit.pulse !== undefined ? { pulse: hit.pulse } : {}),
    });
    effect(
      state,
      blocked ? "block" : "hit",
      hit.x,
      hit.y,
      hit.owner,
      blocked ? 14 : hit.heavy ? 23 : 17,
    );
  }
}

function finishRound(state, reason) {
  const [a, b] = state.players;
  const health = [a.hp / a.maxHp, b.hp / b.maxHp];
  const winner = health[0] === health[1] ? null : health[0] > health[1] ? 0 : 1;
  state.roundWinner = winner;
  state.roundReason = winner === null ? "draw" : reason;
  state.winner = winner;
  state.phase = "roundover";
  state.phaseFrame = 0;
  if (winner !== null) state.score[winner]++;
  state.projectiles = [];
  state.cinematic = null;
  state.hitstop = reason === "ko" ? 15 : 0;
  for (let slot = 0; slot < 2; slot++) {
    const p = state.players[slot];
    endMount(state, p, slot, "round-ended");
    p.vx = 0;
    p.buffers = [];
    p.slow = p.haste = p.shield = p.recast = p.bike = p.suppressed = p.empower = p.duel = p.exposed = null;
    p.cooldowns = {};
    if (p.hp <= 0) {
      p.action = "ko";
      p.actionFrame = 0;
      p.actionDuration = 120;
    }
  }
  event(state, reason === "ko" ? "ko" : "round", winner, null, {
    round: state.round,
    draw: winner === null,
  });
}

function nextRound(state) {
  const old = state.players;
  state.players = old.map((p, i) => ({
    ...makePlayer(p.char, i, state.training),
    meter: Math.min(p.meter, 70),
    input: p.input,
  }));
  if (state.roundWinner !== null) state.round++;
  state.phase = "countdown";
  state.phaseFrame = 0;
  state.timer = 90 * 60;
  state.winner = null;
  state.roundWinner = null;
  state.roundReason = null;
  state.effects = [];
  state.projectiles = [];
  state.hitstop = 0;
}

export function step(state, inputs = [0, 0]) {
  state.tick++;
  state.events = [];
  for (let i = 0; i < 2; i++)
    readInput(state.players[i], inputs[i] ?? 0, state.tick);
  state.effects = state.effects.filter((e) => --e.life > 0);
  if (state.phase === "ended") return state;
  if (state.phase === "countdown") {
    state.phaseFrame++;
    for (const p of state.players) p.buffers = [];
    if (state.phaseFrame >= 150) {
      state.phase = "fight";
      state.phaseFrame = 0;
      event(state, "round", 0, null, { round: state.round });
    }
    return state;
  }
  if (state.phase === "roundover") {
    state.phaseFrame++;
    for (const p of state.players) p.actionFrame++;
    if (state.hitstop > 0) state.hitstop--;
    if (state.phaseFrame >= 150) {
      if (state.score.some((s) => s >= Math.ceil(state.bestOf / 2))) {
        state.phase = "ended";
        state.phaseFrame = 0;
      } else nextRound(state);
    }
    return state;
  }
  if (state.hitstop > 0) {
    state.hitstop--;
    return state;
  }
  if (state.cinematic) {
    for (const i of state.cinematic.owners) {
      if (!state.cinematic.ownerFrames || state.cinematic.ownerFrames[i] > 0) {
        state.players[i].actionFrame++;
        if (state.players[i].invuln > 0) state.players[i].invuln--;
        if (state.cinematic.ownerFrames) state.cinematic.ownerFrames[i]--;
      }
    }
    if (--state.cinematic.life <= 0) state.cinematic = null;
    return state;
  }
  state.phaseFrame++;
  advanceStatuses(state);
  advanceMounts(state);
  if (!state.training) state.timer = Math.max(0, state.timer - 1);
  // Resolve both intentions and move both bodies before computing any collisions.
  for (let i = 0; i < 2; i++) intent(state, state.players[i], i);
  for (let i = 0; i < 2; i++) advancePlayer(state, state.players[i], i);
  separate(state.players);
  const hits = [];
  for (let i = 0; i < 2; i++) emitAttacks(state, i, hits);
  projectileHits(state, hits);
  applyHits(state, hits);
  for (const p of state.players) {
    if (
      (attacking(p) || p.action === "dash") &&
      p.actionFrame >= p.actionDuration - 1
    ) {
      if (p.action === "finisher") p.empower = null;
      p.action = p.y > 0 ? "jump" : "idle";
      p.actionFrame = 0;
      p.actionDuration = 0;
    }
    if (state.training) {
      p.hp = p.maxHp;
      p.meter = 100;
    }
  }
  if (
    !state.training &&
    (state.players.some((p) => p.hp <= 0) || state.timer <= 0)
  )
    finishRound(state, state.timer <= 0 ? "time" : "ko");
  return state;
}

function hash(value) {
  let n = value | 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

/** Stateless AI: repeat calls with identical snapshots always return identical input. */
export function aiInput(state, slot, difficulty = "normal") {
  if (state.phase !== "fight" || !state.players[slot]) return 0;
  const level = difficulty === "hard" ? 2 : difficulty === "easy" ? 0 : 1;
  const p = state.players[slot],
    foe = state.players[1 - slot];
  const distance = Math.abs(foe.x - p.x),
    direction = foe.x > p.x ? INPUT.RIGHT : INPUT.LEFT;
  const away = direction === INPUT.RIGHT ? INPUT.LEFT : INPUT.RIGHT;
  const period = [40, 26, 17][level];
  const frame = state.tick + slot * 11;
  const roll =
    hash(state.seed + Math.floor(frame / period) * 7919 + slot * 67) % 100;
  const enemyMove = getMove(foe);
  const threateningMelee =
    enemyMove &&
    (["light", "heavy", "heavyFollow"].includes(foe.action) || enemyMove.melee) &&
    !enemyMove.projectile &&
    (!foe.moveConnected || (enemyMove.melee && enemyMove.releases)) &&
    foe.actionFrame < enemyMove.startup + enemyMove.active &&
    distance < enemyMove.range + 36 &&
    foe.actionFrame >= [enemyMove.startup + 1, 4, 1][level];
  const projectileWindup = enemyMove && (enemyMove.projectile || (foe.action === "skill" && ["saber", "archer"].includes(foe.char)))
    && distance < 240 && foe.actionFrame >= Math.max(1, enemyMove.startup - [0, 8, 12][level])
    && foe.actionFrame <= (enemyMove.releases?.at(-1) ?? enemyMove.release ?? enemyMove.startup);
  const threateningProjectile = projectileWindup || state.projectiles.some(
    (q) =>
      q.owner !== slot &&
      ((q.type === "enuma-beam" && Math.abs(q.x - p.x) < q.width / 2 + 35)
        || ((q.x - p.x) * q.vx < 0 && Math.abs(q.x - p.x) < [80, 180, 270][level])),
  );
  if ((threateningMelee || threateningProjectile) && roll < [28, 68, 91][level])
    return INPUT.GUARD;
  let mask = 0;
  const preferred = p.mount ? (p.char === "medusa" ? 142 : 160)
    : { saber: 91, archer: 255, gilgamesh: 350, lancer: 142, medusa: 82, iskandar: 112,
      gojo: 325, heracles: 134, allmight: 107, katja: 430, magnus: 110, ambessa: 136,
      acheron: 120, boothill: 315 }[p.char];
  if (distance > preferred + 20) mask |= direction;
  else if (["archer", "gilgamesh", "gojo", "katja", "boothill"].includes(p.char)
      && distance < (p.char === "katja" ? 300 : p.char === "boothill" ? 230 : p.char === "gilgamesh" ? 240 : p.char === "gojo" ? 220 : 165) && roll < 65) mask |= away;
  if (frame % period >= 2) return mask;
  const ultimateRange = { saber: 370, archer: 650, gilgamesh: 820, lancer: 550, medusa: 700, iskandar: 650,
    gojo: 285, heracles: 290, allmight: 380, katja: 920, magnus: 800, ambessa: 610,
    acheron: 600, boothill: 920 }[p.char];
  if (p.bike && p.actionFrame >= 58 && distance > 230 && roll < 55) return mask | INPUT.ULT;
  if (!p.mount && !p.empower && !p.cooldowns.ultimate && p.meter >= 100 && distance < ultimateRange && roll < [25, 60, 85][level])
    return mask | INPUT.ULT;
  if (p.mount && p.mount.chargeCooldown === 0 && distance < 520 && roll < 60)
    mask |= INPUT.SKILL;
  else if (p.char === "katja" && distance < 920)
    mask |= distance < 250 && !p.cooldowns.skill ? INPUT.SKILL
      : !p.cooldowns.heavy && roll < 50 ? INPUT.HEAVY : INPUT.LIGHT;
  else if (p.char === "boothill" && distance < 850)
    mask |= distance < 130 ? INPUT.HEAVY : !p.duel && !p.cooldowns.skill && roll < 60 ? INPUT.SKILL : INPUT.LIGHT;
  else if (p.char === "acheron" && p.empower?.charges > 0 && distance < 260) mask |= INPUT.LIGHT;
  else if (p.char === "acheron" && distance < 310)
    mask |= distance > 180 && !p.cooldowns.heavy ? INPUT.HEAVY
      : !p.cooldowns.skill && roll < 42 ? INPUT.SKILL : distance < 150 ? INPUT.LIGHT : INPUT.DASH;
  else if (p.char === "ambessa" && p.recast && distance < 315) mask |= INPUT.HEAVY;
  else if (["magnus", "ambessa"].includes(p.char) && distance < 200)
    mask |= !p.cooldowns.skill && roll < 38 ? INPUT.SKILL
      : !p.cooldowns.heavy && roll > 60 ? INPUT.HEAVY : INPUT.LIGHT;
  else if (p.char === "gojo" && distance < 740)
    mask |= distance < 210 ? INPUT.HEAVY : roll < 30 ? INPUT.SKILL : roll < 76 ? INPUT.LIGHT : INPUT.HEAVY;
  else if (p.char === "gilgamesh" && distance < 760)
    mask |= roll < 43 ? INPUT.SKILL : roll < 82 ? INPUT.LIGHT : INPUT.HEAVY;
  else if (distance < getMove(p, "light").range + 10)
    mask |= roll < 65 ? INPUT.LIGHT : INPUT.HEAVY;
  else if (!p.mount && distance < ({ lancer: 430, medusa: 280, iskandar: 245, heracles: 300, allmight: 420 }[p.char] ?? 650) && roll < (p.char === "archer" ? 86 : 51))
    mask |= INPUT.SKILL;
  else if (distance > 290 && roll < 30 + level * 15) mask |= INPUT.DASH;
  if (level > 0 && threateningProjectile && roll > 75) mask |= INPUT.JUMP;
  return mask;
}
