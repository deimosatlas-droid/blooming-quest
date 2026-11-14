# Blooming Quest: action RPG expansion design

Status: proposed design, not implemented. Browser release comes first. Finish the current consistency fixes and portable release before beginning this expansion.

## Reference and direction

The confirmed reference is [Dimraeth, by Mudtek](https://store.steampowered.com/app/2402680/Dimraeth/). Its developer description identifies deliberate stamina-based combat, readable enemy warnings, positioning, dodging, blocking and parrying. It also describes race/class skill trees, a five-spell loadout, quests, relationships and bosses. These are reference points for the feel and depth of this proposal. They are not a description of features already in Blooming Quest.

Blooming Quest will implement its own rules, encounters, skills, dialogue and story. We will retain Amaal as the protagonist, the approved Emerald-inspired presentation, Stormy, Rosepetal and the established towns. We will not copy Dimraeth's code, art, dialogue, maps or exact skill trees, and we are not promising its full content scale.

The intended loop is: prepare at home, take a town quest, travel a dangerous road, explore a dungeon, overcome an encounter, then return with resources and a new story lead. NPC schedules continue independently of quest progress. The game must run without a ChatGPT session or a paid AI service; authored dialogue and local game logic supply its NPC and quest behaviour.

## What the current build supplies

| Existing foundation | Expansion needed |
| --- | --- |
| Three timed katana combo attacks and 64 idle/attack poses | Stamina, dodge, guard/parry, equipped skills and combat feedback |
| Six long roads, 24 breakable camps and 16 approved monster species | Enemy attack warnings, varied attack patterns and authored boss encounters |
| Seven towns, the Rosepetal home estate and enterable rooms | Dedicated dungeon maps, room objectives, checkpoints and encounter completion |
| 104 distinct scheduled NPCs | Quest offers, choices, prerequisites, changing dialogue and turn-ins |
| Saved fruit, mushroom, camp and world-clock state | XP, skill choices, quest objectives and dungeon completion |
| Opening note and herbalist lead | A functioning main-quest chain and optional personal side quests |

The current engine explicitly restricts encounters to `area.kind === 'road'`. A dungeon cannot be added merely by drawing a cave or placing a larger camp. Combat permission, enemy spawning and saved completion must be extended deliberately.

## Combat

Keep Space as Amaal's three-hit basic combo. Preserve movement, sprinting and collision-aware lunges. Add these universal actions so essential defence does not depend on choosing a particular skill branch:

- **Dodge:** a short directional step with a brief protected interval, stamina cost and recovery. It cannot cross fences, camp bodies, walls or closed doors.
- **Guard:** reduces a frontal attack at a stamina cost. Holding guard slows movement and stamina recovery; attacks from behind remain dangerous.
- **Parry:** the opening portion of a guard can interrupt a parryable attack. The attack's warning and feedback must make the distinction learnable. Large ground hazards remain dodge/positioning challenges.
- **Skills:** a small equipped loadout with explicit stamina or cooldown costs. No skill may damage townspeople, animals or home objects.

Proposed laptop controls are Space for the combo, Q for dodge, C for guard/parry, 1–3 for the first equipped skills, K for the skill tree and the existing J journal for quests. These are a starting layout, subject to a keyboard playtest. Existing movement, Shift, E, H and M bindings should retain their roles. UI controls and text fields must keep their normal keyboard behaviour.

The first build should show health, stamina and available skill cooldowns clearly. Keep the playfield readable at the current 384×256 canvas size. Use short hit flashes, restrained sound and brief impact pauses; keep effects bounded so several monsters do not obscure their warnings.

Keep damage and healing compatible with the existing five-heart display during this slice. Do not introduce fractional heart damage through guard or percentage modifiers without first updating the health model and HUD together. A stamina-funded guard can fully block an ordinary frontal hit, while a clearly signalled heavy hit may still cost a whole heart.

Enemy attacks need distinct anticipation, active and recovery states. Resolve damage during the active state, not immediately on proximity. A warning freezes the intended attack position or direction at a documented point so attacks do not track the player unfairly after they have dodged. Attack shapes may be cones, lines or circles, and must respect intervening scenery. Rewards and damage use activation IDs to prevent duplicate application.

## Three original skill branches

Amaal stays Amaal. Build variety comes from mixing these branches rather than choosing a different race, replacing her sprite or adopting another game's class roster.

| Branch | First active skill | Two initial upgrade choices |
| --- | --- | --- |
| **Katana** | Petal Sweep: a costly crowd-control cut with a clear recovery window | Shorter recovery after a successful hit; stamina returned by a successful parry |
| **Bloomcraft** | Briar Bind: a small root field that slows enemies | Longer binding against ordinary enemies; a crafted coating that strengthens a limited number of strikes |
| **Stormy** | Stormy's Gust: a directed gust that pushes enemies away | A brief movement boost after the gust; a short protective wind ward |

These nine nodes are the initial tree, not a claim that nine skills are the final game's depth. Each branch has one active and two prerequisite upgrades. Branches may be mixed. Major effects must be understandable before spending a point; avoid filling the first tree with tiny percentage increases that do not change decisions.

A provisional first-slice level range is 1–5, with one skill point per level gained. Balance rewards through playing the full quest/dungeon loop before committing exact XP thresholds or damage numbers. Preserve surplus XP if the prototype has a temporary level cap. Development respecs are free so the user can compare builds without replaying the world.

Begin with three usable skill slots. Store a loadout that can grow to five, and add the other slots only when there are enough tested abilities to support meaningful choices. Do not display nonfunctional future buttons.

Poisonous mushrooms remain labelled crafting ingredients. Picking one never eats it or harms Amaal. Coatings are an explicit crafting/equipping action. Bosses may resist a full root or stun, but resistance must be clear and must not make a whole branch useless.

## Dungeons

Add the first dungeon entrance beside a long road near Lavendyr. The exact name and story text remain draft content. Use new stable map IDs; do not reuse the five retired Rosepetal room IDs that currently redirect old saves home.

The first dungeon contains three to five authored rooms:

1. An entrance and checkpoint where the new combat rules can be learned safely.
2. A small enemy encounter with room to dodge and inspect attack warnings.
3. An exploration room with an optional supply cache or simple environmental obstacle.
4. A boss arena with a visible entry and reset boundary.
5. An optional return passage, combined with another room if the dungeon uses fewer maps.

Room completion, opened caches and unlocked shortcuts persist. An unfinished boss attempt can reset on defeat or reload; tell the player and resume them at the entrance checkpoint rather than inside an immediately active attack. Gathered items, skill choices, completed quests and cleared overworld camps remain saved. No new death penalty is required for the first slice.

Keep overworld monster spawning on the long roads. Designated dungeon rooms and arenas are the new, explicit combat exception. Towns, Rosepetal, ordinary town interiors and boat crossings remain safe. A shared `isCombatScene` rule should enforce this across spawning, attacks, targeting, HUD and defeat handling. Update world metadata and tests to describe the exception honestly.

A dungeon clear unlocks its return shortcut and grants its one-time completion reward. Repeat visits must have a deliberate reset policy; opening a door must not accidentally recreate a defeated boss or duplicate a chest reward. Start with authored rooms and encounters before adding procedural generation.

## First boss

Use the already approved Road Minotaur model, unchanged, for the first mechanics prototype. Give the encounter an original draft identity such as **Thornbound Warden**, a distinct nameplate and its own arena. This is a boss behaviour prototype, not a newly supplied monster design.

The boss has three readable attacks:

- **Horn Sweep:** a frontal cone with a visible wind-up and a punishable recovery. It teaches guarding or moving around the flank.
- **Briar Charge:** a warned line attack that commits to its direction before moving. It stops at solid scenery and leaves a recovery opening.
- **Groundbreak:** marked ground circles that resolve after a short delay. It teaches movement rather than continuous blocking.

At roughly half health, change the attack sequence and add a limited pressure mechanic. For example, two approved slimes may appear at fixed safe points, with a strict alive/spawn cap. Do not make the second phase merely an unexplained damage increase, shorten warnings below a readable minimum or spawn enemies underneath Amaal.

Exact timings, stamina costs and health are tuning values. The acceptance target is a fight won by recognising patterns and finding openings, with more than one viable skill branch. It must be possible to retry without losing collected resources or erasing unrelated progress.

Unique boss art, a new monster species, a recolour or a substantially changed silhouette must be shown to the user before adding it. Continue using free assets with retained provenance. The current sixteen approved species can supply initial encounters; do not silently add unapproved monsters to populate a larger bestiary. Existing attack/idle frames may support the prototype, but missing defensive or casting poses should be identified honestly rather than described as newly authored animation.

## NPC side quests and the story lead

Use explicit quest state, not words found in a label or repeated NPC dialogue. Each quest has a stable ID, its offering/turn-in NPC IDs, prerequisites, objectives, completion conditions and a reward record.

The player can accept, inspect and complete a quest through the existing interaction/dialogue UI. The journal shows the current objective and turn-in person. Quest dialogue must remain available when an NPC moves to another work or rest location; it should not depend on catching a one-time speech line at one clock minute. Use current actor positions when showing a nearby marker.

Proposed first chains, all with original draft text:

| Chain | Loop | Purpose |
| --- | --- | --- |
| **Flowers Without Morning** — Maera | Read Raeez's note, talk to Maera, bring specified plant samples, return | Turns the existing opening lead into a real tracked objective and introduces the dungeon |
| **For the Rescue Barn** — Mira | Accept a request, gather fruit/berries, deliver a defined quantity | Connects safe home life and road gathering to a useful reward without inventing another town at Rosepetal |
| **The Cellar Below** — Maera | Enter the unlocked dungeon, investigate, defeat the Warden, bring back a clue | Connects exploration and boss completion to the next main-story lead |

These are connected prototypes, not the complete Raeez story. The first slice should actually update the journal after the herbalist lead instead of promising a trail that never progresses. Any later Sunveil direction needs authored supporting dialogue and a real objective before it appears as the next quest.

Support objective types for talking, carrying items, harvesting, defeating a named encounter, investigating an object, entering an area and rescuing an animal. A delivery checks the inventory at turn-in and consumes the required quantity atomically. Clearly distinguish “bring three berries” from “pick three new berries after accepting”; existing supplies can satisfy the former. Start with authored quests before introducing daily/random quest generation.

Quest rewards are applied once. Repeated dialogue, reloading a save or leaving and re-entering a town must not grant duplicate XP or items. NPC daily tasks and quest state remain separate, so accepting a quest cannot break workstation reservations or freeze an NPC permanently.

## Modules and integration

| Proposed module | Responsibility |
| --- | --- |
| `progression.js` and skill definitions | XP, level thresholds, points, prerequisites and derived modifiers |
| `abilities.js` | Stamina, dodge/guard/parry, equipped skills and cooldowns |
| `encounters.js` | Enemy attack states, shapes, boss phases and encounter completion |
| `dungeons.js` | Room gates, checkpoints, shortcuts and reset policy |
| `quests.js` and quest definitions | Offers, objective tracking, conditional dialogue, turn-ins and rewards |
| Small game-event dispatcher | Talk, harvest, combat defeat, camp clear, investigate, area entry and boss completion |

Keep definitions as plain data with known effect types; do not evaluate arbitrary text as game code. Reuse the current renderer, maps, pathfinding, animation controller and save functions. Avoid adding another whole engine solely to obtain an ARPG feature checklist.

Emit rewards at semantic events. Currently clearing a camp also removes its remaining live monsters. Mark that removal as camp cleanup, not a fresh player kill, so it cannot grant both a full set of kill rewards and the camp reward. Use stable monster, camp, quest, cache and boss IDs in reward ledgers.

## Save compatibility and independent releases

Continue reading the existing `blooming-world-v05` save key. Add an explicit schema version and additive fields such as:

```json
{
  "schemaVersion": 2,
  "progression": {"xp": 0, "unspentPoints": 0, "skills": {}},
  "loadout": [],
  "quests": {},
  "dungeons": {},
  "questItems": {},
  "claimedRewards": {}
}
```

This excerpt extends the existing save; it does not replace health, food, area, inventory, camp progress, harvest dates or the world clock. Derive combat modifiers from saved skill choices when loading. Do not save already-modified damage and apply the same skill bonus again after each reload.

Migrate the existing note flag into the appropriate opening-quest stage. Older players with cleared finite camps need a documented progression baseline: credit known camp clears once, without guessing how many cleanup removals were actual combat kills. Preserve identifiers and record granted migration rewards so re-importing a save cannot repeat them.

A different website origin has separate browser storage. The independent browser release therefore needs save export/import before moving the user to a new address. Preserve unknown compatible fields during migration, validate imported data and offer a backup before replacing a current save. Update releases must not reset character or world progress. These systems use local single-player saves; moving the website does not itself provide cloud synchronisation between devices.

## Delivery order and acceptance

1. **Stable independent release:** finish the current bug fixes, save transfer and portable browser package. Confirm that the game plays without ChatGPT at runtime.
2. **Combat foundation:** add stamina, defensive actions and warned enemy attacks; verify timing, scenery collision, keyboard focus and readable feedback before expanding content.
3. **Progression:** add the nine-node tree and equipped skills, free development respecs and save migration. Verify different builds against the same encounter.
4. **Complete first slice:** deliver the dungeon, boss and all three quest chains together. Every offered objective must be finishable, its reward applied once, and the next story lead supported by real content.
5. **Expansion:** add more town quest chains, personal stories, region-specific dungeons, approved bosses and the remaining skill slots after the first loop has been played and tuned.

Before expanding the world, verify save/load in each quest stage; repeated turn-ins; defeat and boss retry; leaving/re-entering a room; camp cleanup rewards; NPC schedule changes during a quest; safe-area targeting; all skill branches against the boss; and an update/import of a pre-expansion save. None of these milestones requires a paid runtime AI API, multiplayer backend or a new asset purchase.
