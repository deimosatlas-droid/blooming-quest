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

## Action RPG systems

The v0.13 release implements original Dimraeth-inspired stamina combat, dodge, directional guard/parry, three warned enemy attack patterns, XP/levels, a nine-node skill tree, three equipped active abilities and an original forest/rose/brass HUD. Controls: Q dodge, hold C guard (opening window parries), K skills, 1–3 equipped abilities. Touch equivalents must remain available. Camp and actual kill rewards use stable one-time IDs; camp cleanup grants no kill XP.

docs/ARPG-SYSTEMS.md retains the expansion design. Dungeons, bosses and multi-stage NPC quests are still future work. Do not present those as implemented.
