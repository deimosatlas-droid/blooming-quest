# Blooming Quest action RPG systems

Browser v0.14 delivers the combat, spellbook and motion systems below. The reference is [Dimraeth by Mudtek](https://store.steampowered.com/app/2402680/Dimraeth/); Blooming Quest uses original rules, spell names, UI, effects, maps and story. Actual browser/device feel has not yet been compared directly with the reference.

## Delivered combat and movement

- Stamina funds attacks, dodges, guards and spells. Normal frontal hits can be blocked; the opening 0.2 seconds of a guard can parry. Heavy ground attacks call for a dodge.
- Enemies commit to visible cone, charge-lane or ground-circle warnings before an active hit, then recover. Walls and scenery block targeting and movement.
- Space or holding Attack chains Amaal’s three-hit combo. The three attacks last approximately 0.36, 0.34 and 0.46 seconds. A short late-recovery window allows movement or casting to resume without erasing the active hit.
- A short spell-input buffer accepts the next action near the end of an attack or cast. Stamina and cooldown are charged when the cast begins. Dodging, guarding or scene/UI/lifecycle cancellation prevents an interrupted cast from releasing later; paid cooldowns remain.
- Movement accelerates briefly, stops immediately on release, normalizes diagonals and sweeps collision in small steps. The camera follows a bounded float position while rendering pixel-aligned coordinates. Frame stepping processes up to 0.1 seconds in at most six substeps rather than dropping ordinary low-frame-rate time.
- Amaal has distinct runtime-articulated dodge, guard, gather/release casting and hurt poses, plus faint bounded dodge echoes. These use the approved walking/action artwork; they are not a newly drawn sprite sheet.
- Health remains five whole hearts. Healing spells clamp to that maximum; food, harvests, camps, NPC schedules and story flags retain their existing save behaviour.

Controls: WASD/arrows move, Shift runs, Space attacks, Q dodges, C guards/parries, 1–5 cast equipped spells, K opens Skills, E interacts, H eats noodles, M opens the map and J opens the journal. Touch controls expose movement, Attack hold, defence and five spell slots. Skill menus pause simulation and clear held input.

## Twenty spells and upgrades

The spellbook contains **20 active spells**, each with ranks I–III, plus six retained passive upgrades. Filters and search support five schools. Each learned spell and additional rank costs one skill point. Spell descriptions show actual current and next-rank values.

| School | Four spells | Different roles |
| --- | --- | --- |
| Katana | Petal Sweep; Rose Lance; Returning Crescent; Thorn Dance | Broad melee, piercing line, outward/return passes, orbiting cuts |
| Bloomcraft | Briar Bind; Seed Bolt; Healing Bloom; Thorn Wall | Root, ranged seed/root, healing, damaging slowing briars |
| Stormy | Stormy’s Gust; Gale Step; Cyclone; Thunder Call | Push/interrupt, collision-safe dash cut, pull field, delayed lightning |
| Frost | Frost Shard; Ice Ring; Winter Ward; Glacial Path | Slowing bolt, radial freeze, multi-hit ward, damaging frost line |
| Ember | Ember Bolt; Flame Fan; Cinder Trap; Phoenix Pulse | Burning bolt, burning cone, armed proximity trap, damage/healing pulse |

Ranks change live damage, reach, duration, pierce count, ward charges, healing or cooldowns as appropriate. The catalogue in `dist/spell-catalog.js` defines the values used by the spellbook, casting controller and combat engine. The six original passives remain: Finishing Cut, Petal Return, Lingering Roots, Deep Roots, Tailwind and Wind Ward.

Five loadout slots may mix schools. Respecs remain free during development. A new journey starts with three points and gains two points per level, at 60 XP intervals up to level 30. Surplus XP is retained. The maximum budget supports all 20 active spells at rank III; combining additional passives requires choices. Older saves retain learned choices and their original three slots, padded to five; their greater point budget becomes available automatically.

Only actual monster kills grant 12 XP, and a camp clear grants 35 XP. Stable reward IDs prevent duplicate rewards; removing live monsters when a camp breaks grants no kill XP. Known cleared camps in pre-progression saves receive their camp credit once. Finite camps and free respecs allow testing different builds without erasing the journey.

Towns, Rosepetal, ordinary interiors and boats remain safe. Projectile, field and status populations have fixed limits and expire. Effects clear when leaving a scene. No new monster art is added by this update.

## Independent saves and releases

Keep the existing `blooming-world-v05` key. `state.progression` adds XP, learned IDs, ranks, five-slot loadout and claimed reward IDs. Imports are sanitized, points are derived from valid purchases, and unrelated fields remain intact. Damage/healing, camp changes and spell choices are saved through the existing callbacks. Website/device moves use save export/import; there is no automatic cloud synchronization.

The game remains a static free browser application without ChatGPT, paid AI APIs or a gameplay backend. Publish through the canonical GitHub Pages workflow. Regenerate the complete content-derived offline manifest before release. Updates are explicit and preserve saves.

## Planned dungeon and story expansion

Dungeons, bosses and tracked multi-stage NPC quests are still planned. They are not part of the v0.14 spell/motion release.

The first dungeon should branch from the road near Lavendyr, using new stable IDs. Its authored rooms should include a safe entrance checkpoint, a small combat encounter, an exploration/cache room, an arena and a return shortcut. Room completion, caches and shortcuts persist; unfinished boss attempts reset at a stated checkpoint without losing gathered resources or unrelated progress. A shared combat-scene rule must explicitly enable designated dungeon rooms while preserving safe towns/home/boats.

The first mechanics boss may use the already approved Road Minotaur artwork unchanged, with the original draft name **Thornbound Warden**. Proposed attacks are a frontal Horn Sweep, a locked-direction Briar Charge that stops at scenery, and delayed Groundbreak circles. A second phase changes the sequence and may add a capped pair of approved slimes at safe points. Warned attacks must remain readable and retries available. Any new species, boss sprite, recolour or changed silhouette requires the user’s preview before inclusion.

The following quest prototypes remain original draft story work:

| Chain | Complete loop |
| --- | --- |
| Flowers Without Morning — Maera | Read Raeez’s note, speak to the herbalist, bring defined plant samples and return; introduce the dungeon |
| For the Rescue Barn — Mira | Accept a request, collect specified fruit/berries and deliver them for a one-time reward |
| The Cellar Below — Maera | Investigate the unlocked dungeon, defeat the Warden, return a clue and receive a supported next lead |

Quest state must be separate from daily schedules. NPCs keep offering and accepting their quest dialogue as they move through the day. Delivery checks and item consumption are atomic; rewards apply once. The journal must show a finishable current objective and turn-in person. Later story directions need authored content before appearing as promises in dialogue.

Before releasing that expansion, verify every quest stage, repeated turn-ins, boss defeat/retry, scene re-entry, saves/imports, camp cleanup rewards, NPC schedule changes and all five spell schools against the same encounters. Continue retaining free-asset provenance and user-approved monster designs.
