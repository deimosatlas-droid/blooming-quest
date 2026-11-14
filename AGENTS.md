# Blooming Quest project guidance

## Canonical project and hosting

- Primary repository: https://github.com/deimosatlas-droid/blooming-quest
- Primary browser game: https://deimosatlas-droid.github.io/blooming-quest/
- Publish browser updates through the repository's main branch and GitHub Pages workflow.
- The original ChatGPT Sites copy is retained for save migration. It is not the primary hosting target. Do not delete it or change its audience unless the user asks.
- Gameplay must stay independent of ChatGPT and paid AI services. The current engine is static HTML/JavaScript/Canvas with local data and artwork.

## Current hosting and device requirements

The user now requests iOS, Android and desktop browser support, and a private GitHub repository while retaining editing access. The v0.12 release provides movement, run, attack, interaction, healing, map and journal touch controls plus expanded play with controls visible. Target modern browsers; do not claim real-device verification without performing it.

Free GitHub Pages requires a public source repository. Prepare the free Cloudflare Pages migration described in docs/PRIVATE-HOSTING.md before changing repository visibility, so the playable website and save transfer remain available. Keep the existing GitHub application authorized for the repository after it becomes private. Do not claim the private-source migration is complete until the replacement host and private-repository access have both been verified.

The user has chosen to keep the repository public for now. Continue publishing to GitHub Pages; leave the private-hosting guide available for a future migration.

## Release checks

Run the relevant tests under tests/ against the actual project source. Before packaging or publishing a changed dist/, run:
python3 tools/export-standalone.py --prepare-only
python3 tools/export-standalone.py --check

The Pages workflow uploads only dist/. Keep .openai, Git metadata, credentials and local artifacts out of portable/public release packages.

## User requirements

- Laptop browser first; keep the whole game process free of paid runtime APIs.
- Preserve the save key blooming-world-v05 and migrate new fields additively. Save export/import must carry existing camps, inventory, harvest days, clock and NPC state across origins.
- Rosepetal is a private tower estate with a barn, animals, gardens and practice targets.
- Towns, home and boats stay safe. Overworld monsters spawn from camps beside long roads. Dungeon combat is planned as a deliberate new exception.
- NPC appearances are unique across the whole world and match Amaal's art style.
- Preview every new monster/boss sprite or variant for the user before adding it.
- Preserve connected impassable fences, purposeful prop placement, readable paths and dense map-edge cover.

## Travelling kit interface

The v0.15 interface uses the approved B-object-icons/A-open-menus direction: physical map, leather bag and rose-bound spellbook icons, with wood/brass/leather/parchment UI. Traveller menus open inside the game/fullscreen wrapper, pause gameplay, clear held input, and keep the existing Map A region/labels and real spell/inventory data. M Map, B Bag, K Spellbook, J Journal, O Options. Maintain modal exclusivity and refresh kit availability when starting or closing menus. Food use is explicit: apples/pears/berries heal one heart, noodles two; full health consumes nothing. Poison mushrooms are crafting only and never edible. The v0.16 game always fills the browser viewport; all controls and menus stay inside #play-area, including sideways-phone layouts. Native fullscreen is optional and entered only from a real user gesture; unsupported browsers retain the full browser game view. Keep the protagonist above the bottom spell controls (camera focus capped at180logical pixels).

Keep the actual save/import/offline/update details and Return Home button attached to hidden game parking when inactive and mount those same nodes inside Options. Never clone their listeners or send players outside the game to use save files. Options and corrective updates must remain accessible before Start or asset-load failure; other gameplay menus stay disabled. Keep the on-screen update badge and modal focus/scroll behaviour.

docs/PLAYABLE-NOW.md is the current player guide; do not describe scenery such as shops or the barn as finished commerce/animal-management systems.

## Rosepetal fences

The v0.16 estate uses fences.js with fencePiece metadata for straight joined wooden/stone segments and single corner/gate caps. Configure with the approved world atlas before entry; draw through BloomFences before ordinary objects. Existing group bounds and six gates are preserved; other maps retain their renderer. Do not return to overlapping final stamps or repeat the old T/diagonal vertical fragments.

## Action RPG systems

The v0.14 release implements 20 distinct active spells across Katana/Bloomcraft/Stormy/Frost/Ember, each with three ranks, plus six retained passives. Five equipped slots use 1–5; K opens the searchable, filterable spellbook. Load spell-catalog.js before progression.js. Existing rank-1 choices and three-slot saves migrate additively. Three starting points and two per level at 60XP intervals allow testing mixed builds; respecs remain free.

Combat uses stamina, Q dodge, directional C guard/parry, warned enemy attacks and collision-safe projectiles/fields. Movement has brief analytic acceleration, immediate stops, swept collision, clamped camera smoothing and bounded frame substeps. Amaal has faster combos and runtime-articulated dodge, guard, casting and hurt poses using the approved sprites; do not describe these as a newly drawn sprite sheet. Casting releases after its wind-up; cancelling a cast or changing scene must prevent late effects. Touch equivalents must remain available. Camp and actual kill rewards use stable one-time IDs; camp cleanup grants no kill XP.

docs/ARPG-SYSTEMS.md retains the expansion design. Dungeons, bosses and multi-stage NPC quests are still future work. Do not present those as implemented.
