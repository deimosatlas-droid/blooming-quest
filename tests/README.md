Game regression checks

Run `node tests/travel.cjs`, `node tests/adventure.cjs`, `node tests/life.cjs`, and `node tests/combat.cjs` with Node.js. These exercise actual game code and map data. The travel check drives movement from the road to both ferry terminals and through the onward route.

`node tests/terrain.cjs` and `node tests/monster-art.cjs` also require the free development package `@napi-rs/canvas`; it checks actual rendered pixels, terrain determinism, boundaries, and every area. It is not a dependency for playing the browser game. Optional `--render` previews are written to the system temporary directory.

Additional checks: `node tests/world-map.cjs` covers development travel to seven towns and the home estate while preserving progress; `node tests/forage.cjs` covers fruit, poisonous crafting mushrooms, saved harvesting and daily regrowth; `node tests/routines.cjs` covers 104 residents across seven day phases and clock persistence.

`node tests/estate.cjs` checks the tower-and-barn estate, globally unique relocated NPCs, animal routes, and reachable gardens and practice targets. `node tests/hero-combat.cjs` checks the three-hit combo, contact-frame damage, collision-safe lunges, idle art timing, dummy reactions/reset and old-save migration. `node tests/npc-spacing.cjs` checks workstation capacity, reservations while approaching, separate waiting spots and human spacing across the towns. `node tests/npc-animation.cjs` checks articulated motion, attachment seams and deterministic poses; add `--render` for a native Canvas contact sheet.

`node tests/rest.cjs` checks that garden beds and signs cannot heal the player. `node tests/lighting.cjs` verifies saved-clock outdoor lighting, visible night scenes and lit interiors.

`sh tools/build-browser.sh` runs the portable release checks. The v0.13 checks add `progression.cjs` (points, prerequisites, rewards and migration), `abilities.cjs` (stamina, dodge, guard/parry and upgrades), `enemy-telegraphs.cjs` (warned attacks, scenery, skills and XP), `combat-ui.cjs` (real skill learning and modal controls), and `arpg-integration.cjs` (the actual game’s combat, skill, pause and save hooks together). DOM/VM checks do not establish real-device or browser-layout verification.

The v0.14 checks add `spell-catalog.cjs` (20 distinct spells and mechanical ranks), `spell-combat.cjs` (projectiles/statuses/fields/traps/occlusion/expiry), `animation-fluidity.cjs` (articulated poses and recovery gates), `motion.cjs` (frame-rate consistency and collision), and `fluidity-integration.cjs` (actual frame loop, held attacks, buffered casts, fifth-slot healing/wards and saves). Native render contact sheets are optional via `--render`; the automated build does not require a browser or native Canvas package.

The v0.15 checks add `traveller-ui.cjs` (real Bag/Map/Journal/Options DOM behavior, poison safety, focus and fullscreen save access) and `traveller-integration.cjs` (actual game callbacks, start availability, pauses, food consumption, scene restrictions and preserved development travel).

The v0.16 checks add `screen-layout.cjs` (fullscreen-first markup and sideways-phone geometry), `fullscreen-lifecycle.cjs` (native/Safari/orientation/race handling), `system-access.cjs` (preboot Options/update recovery and trusted Start gestures), and `rosepetal-fences.cjs` (exact joins, solid lines and six actual gate crossings). Browser/device rendering remains a separate verification step.
