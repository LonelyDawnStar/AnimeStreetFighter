/** Shared Excalibur choreography: native-pixel hand anchors, world-space hit geometry.
 * The body pose and the held weapon advance together. No second timer or
 * independent hand interpolation can detach the grip from the painted gloves.
 */
export const SABER_ACTIVE_START = 80;
export const SABER_ACTIVE_END = 94;
export const SABER_MOTION = [
  { at: 0, hand: [2.75, -46.4], angle: -0.90757 },
  { at: 12, hand: [4.39, -71.66], angle: 0.83776 },
  { at: 26, hand: [-2.47, -92.53], angle: 1.74533 },
  { at: 41, hand: [-23.06, -86.21], angle: 2.37365 },
  { at: 57, hand: [-20.59, -91.16], angle: 2.53073 },
  { at: 80, hand: [6.04, -88.14], angle: 1.78024 },
  { at: 83, hand: [30.48, -79.08], angle: 0.55851 },
  { at: 86, hand: [29.65, -50.52], angle: -0.34907 },
  { at: 89, hand: [17.57, -37.34], angle: -0.90757 },
  { at: 92, hand: [12.08, -30.48], angle: -1.34390 },
  { at: 94, hand: [36.24, -29.93], angle: -0.82030 },
  { at: 122, hand: [6.59, -44.48], angle: -0.90757 },
];
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
export function sampleSaberMotion(frame = 0) {
  const f = Math.max(0, frame);
  let poseIndex = 0;
  for (let i = 1; i < SABER_MOTION.length; i++) if (f >= SABER_MOTION[i].at) poseIndex = i;
  const pose = SABER_MOTION[poseIndex];
  // Materialize the larger blade during the lift, then let it settle after the cut.
  const growth = clamp((f - 12) / 45), dissolve = f < 94 ? 1 : 1 - clamp((f - 94) / 20);
  const length = 106 + 274 * Math.min(growth, dissolve);
  return { poseIndex, hand: pose.hand, angle: pose.angle, length,
    progress: clamp((f - SABER_ACTIVE_START) / (SABER_ACTIVE_END - SABER_ACTIVE_START - 1)),
    active: f >= SABER_ACTIVE_START && f < SABER_ACTIVE_END };
}
export function saberSwordGeometry(player) {
  if (player.char !== 'saber' || player.action !== 'ultimate') return null;
  const motion = sampleSaberMotion(player.actionFrame), face = player.face || 1;
  const base = { x: player.x + face * motion.hand[0] * 2, y: player.y - motion.hand[1] * 2 };
  return { kind: 'giant-sword', ...motion, base,
    tip: { x: base.x + face * Math.cos(motion.angle) * motion.length,
      y: base.y + Math.sin(motion.angle) * motion.length }, radius: 22 };
}
