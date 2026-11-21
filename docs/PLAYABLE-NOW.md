# Blooming Quest: what is playable now

This guide describes the v0.18 browser game: a single-player adventure with a complete opening chapter, replayable Briarvault and the first guardian region, Lavenderway.

Play at https://deimosatlas-droid.github.io/blooming-quest/.

## Beginning and controls

The title uses the actual Rosepetal, Amaal and Stormy artwork, with dusk light and optional drifting petals. Continue shows the saved location, day and level. New Journey asks first and backs up an existing journey before replacing it. Import and Options are available on the title; recovery Options remain usable if world loading fails.

Choose **Keyboard & mouse**, **Touch landscape** or **Hybrid**. The choice is remembered and can be changed in Options; a narrow computer window does not force phone controls. Keyboard bindings can be changed. Options also provides text size, touch size/opacity, handedness, reduced motion/flashes, weather, master sound and separate sound-effect/ambient volumes. Extremely short phone screens retain 44-pixel controls rather than enlarging them into other controls.

The game fills the browser viewport. Native fullscreen is optional and requested only from a real player gesture. Sideways phones have dedicated controls; portrait has a useful fallback and rotation guidance. Single-thumb movement supports eight directions and a centre deadzone. Controls remain inside the game frame; touch camera framing includes extra scenery at world edges.

Touch movement now survives a finger crossing the joystick edge, dragging onto it from another control, and incidental viewport/capture events. Held keyboard or touch movement continues across automatic road/town boundaries. Releasing or cancelling a touch, opening a menu, hiding the page or losing focus still clears input.

| Action | Default keyboard |
| --- | --- |
| Move / run | WASD or arrows / Shift |
| Interact / gather / continue dialogue | E |
| Attack / dodge / guard and parry | Space / Q / C |
| Five equipped spells | 1–5 |
| Map / Bag / Spellbook | M / B / K |
| Journal / Options | J / O |
| Eat noodles / close a menu | H / Escape |

Modern iOS, Android, Windows, macOS and Linux browsers are the targets. Automated game-code, layout-geometry and native Canvas checks do not replace real-device/browser playtesting. This is a browser game, not an App Store or Play Store installer. Controllers are not implemented.

## One satchel, five pages

One satchel button opens Bag, Map, Spellbook, Journal and Options in a parchment panel. Menus pause the game and clear held controls; closing returns to play. Keyboard shortcuts remain available.

- **Map:** Map A, current location, town highlights and eight destinations. Development fast travel preserves progress. Short phones use a full-width map with destination details below.
- **Bag:** real saved quantities, food categories, crafting ingredients and quest keepsakes. Apples, pears and berries heal one heart; noodles heal two. Full health consumes nothing. Poisonous mushrooms cannot be eaten.
- **Spellbook:** learn, search, filter, upgrade and equip five spells.
- **Journal:** the current chapter objective, clues, home progress and replay information.
- **Options:** controls/comfort, sound, fullscreen, manual save, the actual export/import/offline/update tools, Return Home and Return to Title. Save controls stay inside the game; no duplicate listeners or external save page.

The satchel badge shows available skill points or a waiting offline update. Open Options to save and apply an update.

## Chapter one: the flowers that forgot the sun

Read Raeez’s note on the tower bookshelf. Find Maera in Lavendyr, or read her signed remedy ledger inside the herbalist cottage. Investigate her closed bluebells, resolve the first Lavender Imp Den on Lavenderway and report back. A previously cleared den is recognized; its stable save ID is unchanged.

Maera provides a root-cellar key and the next lead. **Briarvault Root Cellar**, northwest of Lavendyr, includes:

- A wind chime, a temporary frozen crossing and a living-root seal.
- Three free rank-I exploration lessons: Stormy’s Gust, Frost Shard and Briar Bind. Their base lessons do not consume skill points; upgrades retain normal costs. A lesson is equipped when granted; if all slots are full, the fifth slot is used.
- A sentry encounter, a waystone checkpoint and an unlockable shortcut. The first waystone rest in each run heals; dying after activating it returns to that checkpoint.
- The **Briarvault Guardian**, using the already-approved minotaur artwork, with poise, warned attacks and a second phase.
- Raeez’s field note, ribbon and Wayfarer’s Seed. The Seed allows the three inscriptions to activate by Interact on later trials.

After completing the chapter, entering again starts an optional fresh trial with its own encounter/reward IDs. Cleared road camps remain peaceful. The Briarvault Guardian remains a separate root-cellar encounter; it is not Asterion.

## The first Thornheart: Medusa

After reading Raeez’s Briarvault cache, speak to Maera or read her next ledger in the herbalist cottage. The roadside herbalist’s ledger offers the same continuation. Lavendyr Glade stays a safe town; the separate Lavenderway Fields is the long, unsafe road with four camps and no resident population.

The road includes an abandoned apothecary wagon, herb-drying shed, old stream bridge, hidden greenhouse and ruined circular garden. Its approved regional enemies are **Lavender Imps, Violet Bramblebacks and Amethyst Wisps**. Existing camp-clear and kill records remain valid.

Medusa has two playable approaches:

- **The Herbalist’s Remedy:** gather one Silver Sage at the western fork, one Sun Rosemary near the drying shed and one Clear Thyme toward the greenhouse. Inspect the hidden greenhouse to read the recipe, then use its bench again to crush sage, steep rosemary and strain thyme into an antidote. Offer it to Medusa to expose her Thornheart without a full battle. The three quest herb beds are separate from daily food/mushroom gathering.
- **Combat:** challenge Medusa in her garden. Her warned petrifying gaze, serpent lash and crystal traps change pace in a second phase. Defeating the curse exposes the Thornheart. You can also retreat, brew the remedy and return to offer it during an unfinished battle.

**Approach the exposed Thornheart and purify it.** Both routes award **180 XP once**, the same first guardian memory and **Medusa’s Blessing**: successful parries slow nearby enemies for 2.1 seconds. The blessing is permanent and survives free spell respecs and save reloads. The story battle awards its core XP at purification, rather than separate kill/camp rewards.

Purification reopens the drying shed, clears the stream bridge and restores the greenhouse. Neighbours react, and Medusa shares a memory of the Lord of Thorns’ first appearance. Her garden remains peaceful on return; she does not respawn as an optional trial.

The campaign records six guardians, but only Medusa’s chapter is playable. The Nemean Lion, Hydra, Scylla, Asterion and Chimera remain staged definitions. Their future routes allow quests for the Lion, Scylla and Asterion; Hydra and Chimera require battle.

## The world and daily life

Explore one private estate, seven towns, six long roads, 70 active ordinary interiors, Briarvault and Medusa’s garden. Five retired room records still redirect older saves safely home.

| Place | Character |
| --- | --- |
| Rosepetal Tower | Private rose-covered tower, barn, orchard, gardens and practice glade |
| Lavendyr Glade | Safe herbalist town with 13 residents, a glass conservatory, well, herb drying and weaving frontages |
| Sunveil Grove | Golden market streets, bakery and workshops |
| Tidepetal Quay | River harbour and passenger ferry |
| Seabloom Port | Distant coast, warehouses and lighthouse |
| Hydrangea Meadows | Flower trading courts, streams and bridges |
| Thornrose Hills | Hill outpost, forge and animal paddock |
| Moonblossom Hamlet | Lantern-lit homes and evening gathering places |

Towns have smaller lanes, distinct courts, varied frontages and different central house silhouettes. The roads have separate bends, camp spacing and north/south clearing patterns; Coastroad has an inlet and Moonpath a pond. Connected boundary trees and the estate’s joined fences remain in place. Doors and ordinary interactions check approach/obstructions.

Walk onto the ship at Tidepetal or Seabloom to sail to the other port. Towns, home, ordinary interiors and boats remain safe. Briarvault and Medusa’s garden are deliberate dungeon-combat areas. Shop and workshop scenery does not provide a buying/selling or general crafting economy yet; the greenhouse antidote is a specific quest recipe.

**104 named residents retain 104 globally unique appearances** matching the approved character direction. Local schedules handle work, breaks, shopping and rest, with workstation reservations. Neighbours go to their existing homes at night and return to daytime routines; night-duty guards stay outside. Job motions, time/weather remarks, repeated greetings and chapter reactions add context. These are built-in schedules and authored dialogue, with no paid AI service.

The saved clock drives routines, lighting and plant regrowth. One game hour takes about 75 seconds of active play. Regional petals, wind, mist and occasional rain can be disabled. Night scenes add warmer window/lantern spill. Existing smoke, water movement and boat bobbing remain.

## Home and gathering

Rosepetal stays a private estate with one tower, one barn and three hittable practice dummies. Eight fixed home animals include Bramble the cow, Clover the goat, four hens, Pudding the rabbit and an orchard bird; 28 fixed outdoor animals exist world-wide. Stormy is a separate following companion.

There are **109 daily gathering sources**, including 19 at home: apple/pear trees, berry bushes and Rosecap Amanita, Violet Bellcap and Inky Puffcap mushrooms. Interact picks produce while leaving the plant, records it in the Bag and allows regrowth by the saved game day. Poison mushrooms are ingredients; general player crafting is still planned. Medusa’s three measured quest herbs have their own one-time gathering steps.

New small home rituals include sharing one apple with the animals once per game day, greetings remembered over several days, tending the kitchen garden through seedlings/leaves/flowers/ripe berries, harvesting three berry portions while leaving plants, and displaying earned keepsakes at the tower door. These are limited authored interactions, not a full farming, rescue, breeding or furniture-placement system.

## Combat, spells and progression

Approved road creatures spawn from **24 breakable camps**. Lavenderway uses its three new regional designs; the other roads retain their existing species. Enemy anticipation and recovery animate throughout; species use different timings and movement. Ordinary hits can cause recoil without always resetting an attack; poise and stagger resistance prevent constant interruption. Parry stun and recovery no longer stack into two sequential delays. The regional creature sheet supplies four drawn facings per design, with runtime-articulated motion.

Amaal has a three-hit katana combo, collision-safe dodge, directional guard/parry, spell casting and runtime-articulated action poses from the approved sprites. Queued follow-up attacks cost stamina when they begin. Buffered spells survive until a valid cast window; menu cancellation before spell release refunds its cost/cooldown. Sprint does not drain stamina while an attack locks walking. Blocks, parries, resistance and stamina denials give feedback. These changes do not constitute a newly drawn character or monster sprite sheet.

Ordinary kills award 12 XP. A camp awards its clear reward plus one-time mastery credit for its unfought wave slots, so clearing efficiently does not lose progression. This credit does not invent monster kills. Older cleared camps reconcile missing mastery credit once. Stable reward IDs prevent repeated XP claims. Medusa uses the separate one-time purification reward described above.

There are 20 active spells, each with three ranks, plus six retained passives. Equip five across schools:

| School | Active spells |
| --- | --- |
| Katana | Petal Sweep, Rose Lance, Returning Crescent, Thorn Dance |
| Bloomcraft | Briar Bind, Seed Bolt, Healing Bloom, Thorn Wall |
| Stormy | Stormy’s Gust, Gale Step, Cyclone, Thunder Call |
| Frost | Frost Shard, Ice Ring, Winter Ward, Glacial Path |
| Ember | Ember Bolt, Flame Fan, Cinder Trap, Phoenix Pulse |

Effects include real projectiles, piercing/return passes, roots, freeze, slows, burns, pulls, traps, healing and wards. Rank upgrades change effects. New journeys start with three skill points; levels are 60 XP apart and award two points, up to level 30. Respec remains free; gifted exploration lessons keep their free base ranks.

Bag healing remains a deliberate paused convenience, and development fast travel remains unlocked. Difficulty and normal-speed combat feel still need hands-on balancing; an integration test using injected damage is not proof of boss difficulty.

## Audio, saves and independent play

Free synthesized footsteps respond to surface and actual movement. Sword, hit, spell, parry, interaction and harvest sounds join soft ambience and harbour bells. Audio begins only after a player gesture, respects master/effect/ambient settings and falls back silently if unavailable. There is no music soundtrack or artist-song playback.

The game runs without ChatGPT, a paid API or a server account. The save key remains `blooming-world-v05`; new quest, home and campaign fields are additive. Existing camps, XP, inventory, gathering days, clock and NPC data are preserved. Progress saves in the current browser. Export/import moves a journey between devices, browsers or hosting addresses; there is no automatic cloud synchronization. Previous-save recovery and protected New Journey backups remain available.

Optional offline mode downloads a coherent release. Apply updates explicitly with Save & apply update. Keep an exported save before changing devices or websites. The repository is public and hosting remains GitHub Pages, as requested.

## Still planned

The remaining five guardian chapters and complete Raeez campaign, more dungeons and quest chains, general crafting/cooking, shop economy, equipment/loot progression, catching or monster teams, full animal/farming management, multiplayer and music remain future work. The opening chapter, replayable Briarvault and Medusa’s first region are the current playable scope.
