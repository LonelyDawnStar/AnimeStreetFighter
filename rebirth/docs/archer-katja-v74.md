# v7.4 Archer L / Katja collision correction

The reported miss was real: a grounded Archer's Caladbolg passed above grounded Katja at every tested distance and in both directions. The cause was its hardcoded firing height, not horizontal tunneling or an undersized collision box.

| Measurement (world pixels) | v7.3 | v7.4 |
| --- | ---: | ---: |
| Arrow center above Archer's feet | 150 | 140 |
| Arrow vertical collision span | 139–161 | 129–151 |
| Grounded Katja hurtbox top | 137.76 | 137.76 |
| Arrow width × height | 105 × 22 | 105 × 22 |
| Arrow horizontal offset / speed | 62 / 17 | 62 / 17 |
| L release frame / projectile lifetime | 25 / 85 | 25 / 85 |
| Damage / guard chip | 119 / 12 | 119 / 12 |

The old arrow's lower edge was **1.24 world pixels above Katja's head**. Independent inspection of Archer's actual release frame places its visible arrow tip approximately 70–71 native pixels above the feet (140–142 world pixels). A fixed height of 140 aligns the shot with the native pixel grid and the authored arrow. The renderer shares `ARCHER_ARROW_HEIGHT` for the charge light/ring. The projectile's existing renderer already reads its simulation height.

This is a fixed launch-axis correction for every target. It neither changes Katja's `.84` body scale nor introduces target tracking. Damage, dimensions, speed, lifetime, startup and horizontal emission position remain unchanged. The vertical airborne contact boundary consequently moves down by 10 world pixels with the visible shot; exact jump outcomes near that boundary can change.

## Reproduction and results

The deterministic tool runs **440 cases against each engine version**: 96 Katja action cases, 336 standing/guard controls covering all 14 characters, and eight precisely timed jump/dash cases. Distances are 60, 70, 180, 380, 700 and 850 world pixels, facing both directions. Results are recorded in [before](archer-katja-v74-before.json) and [after](archer-katja-v74-after.json), including engine SHA-256, emission height, contact frame and damage.

| Katja state | Cases | Before | After |
| --- | ---: | --- | --- |
| Grounded idle | 12 | All missed | All hit once for 119 |
| Standing guard | 12 | All missed | All blocked once for 12 |
| Walking toward / away | 24 | All missed | All hit once for 119 |
| K / L skill input during windup | 24 | All missed | All hit once for 119 |

Katja's visually kneeling K/Q and recoil L/E do not implement a gameplay crouch or duck state. They continue using the existing small hurtbox. At longer distances their animation can finish before the arrow arrives. The tool records the actual action at emission and the contact time rather than assuming the pose persists.

The other **13 characters' 312 standing/guard cases retain identical outcomes, damage and contact frames**. All 336 final standing/guard controls now resolve correctly, including point-blank contact. Existing horizontal swept collision already covers the moving arrow's width and previous/current X positions, so neither sweep logic nor the X origin required a change.

Defense remains conditional on actual geometry and timing:

- At distance 380, Katja jumping on input tick 18 clears the arrow in both directions; jumping late on tick 35 still takes 119 damage.
- At distance 190, dashing toward the arrow on tick 28 passes through it during five observed overlap ticks with positive invulnerability. The same dash on tick 27 remains protected while invulnerable but takes 119 damage on tick 32 after the window expires.
- The broad matrix uses fixed, deliberately unoptimized input schedules. Its twelve generic dash cases are caught after invulnerability expires; it is not a dodge success-rate or balance simulation.
- An airborne Archer's arrow stays at its original release height and can still pass above grounded Katja. It never bends toward the target.

## Validation

`node --test rebirth/tests/engine.test.mjs` passes **84/84**, including six new regression tests for standing/guard contact, grounded movement and skills, jump timing, dash invulnerability expiry, unchanged dimensions/damage across every character, and fixed airborne trajectory. Existing jump, guard, projectile startup and deterministic replay tests also pass. The final full `npm test` suite passes **118/118** with no failures or skipped tests; its output is saved in [test log](tests-v74.txt).

Independent browser evidence is saved as [comparison image](archer-katja-v74.png) and [browser measurements](archer-katja-validation-v74.json). At distance 410, the old-height control causes zero damage while the corrected arrow hits once for 119; browser page errors were zero.

To repeat the final-engine matrix from the repository root:

```sh
node rebirth/tools/repro-archer-katja-v74.mjs rebirth/public/engine.mjs rebirth/docs/archer-katja-v74-after.json
```

For the baseline, extract `rebirth/public/engine.mjs` and its sibling `saber-motion.mjs` from v7.3 commit `74fd181` into a separate directory, then pass that engine path and a different output JSON path to the same command. Input schedules are identical across versions.
