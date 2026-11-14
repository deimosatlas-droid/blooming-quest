# Blooming Quest: what is playable now

This guide describes the v0.16 browser game. It is a single-player adventure in development: exploration, combat, spells, gathering and daily town life are playable; the story currently contains its opening lead.

Play at https://deimosatlas-droid.github.io/blooming-quest/.

## Amaal’s travelling kit

The interface uses physical map, bag and spellbook icons, with leather, wood, brass and parchment menus. These open the real game systems:

- **Map:** the illustrated Map A region, current location and eight selectable destinations. Development fast travel to every town and Rosepetal preserves the journey.
- **Bag:** quantities of gathered fruit, noodles and poisonous crafting mushrooms, category tabs and item descriptions. Apples, pears and berries restore one heart; noodles restore two. Food is consumed only when healing succeeds. Poisonous mushrooms have no eating action.
- **Spellbook:** learn spells, upgrade ranks, read their effects, search/filter schools and arrange five equipped slots.
- **Journal:** the current Raeez lead and journey information.
- **Options:** save, toggle sound and expand the game. Save-file and offline controls live inside Options, without leaving the game screen. System Options and corrective updates remain reachable on the start/loading screen.

Menus pause gameplay while open. Keyboard and touch controls support the same core actions.

## The world

Explore **one home estate, seven towns, six long roads and 70 active enterable interiors**. There are 84 active areas; five additional retired room records redirect old saves safely home.

| Place | Character |
| --- | --- |
| Rosepetal Tower | Amaal and Raeez’s private rose-covered tower estate, barn, gardens and practice glade |
| Lavendyr Glade | Lavender, herbal gardens and the herbalist’s settlement |
| Sunveil Grove | Golden trees, market streets, a bakery and workshops |
| Tidepetal Quay | A river harbour connecting the first roads to the ferry |
| Seabloom Port | The distant coastal harbour, warehouses and lighthouse |
| Hydrangea Meadows | Flower-filled trading streets, streams and bridges |
| Thornrose Hills | A sheltered hill outpost, forge and animal paddock |
| Moonblossom Hamlet | Lantern-lit cottages, streams and evening gathering places |

Walk the connected roads or use development travel. Walk onto the ship at Tidepetal or Seabloom to cross to the other port. The crossing is safe and arrives off the boarding trigger.

Buildings can be entered, labelled belongings inspected, neighbours spoken to and actual beds used to restore health and noodles. Market, workshop and shop scenery currently supplies places to explore and NPC work locations; player buying, selling and crafting are not implemented.

## Rosepetal and gathering

Rosepetal is a private home, not another village. It contains the tower, an enterable animal barn, connected gardens and orchard, and three hittable practice dummies that reset for another round.

Eight fixed animals live at the estate: Bramble the cow, Clover the goat, four hens, Pudding the rabbit and an orchard bird. There are 28 fixed outdoor animals across the world. **Stormy is a separate following companion**, with short dialogue; Stormy is not included in that count.

There are **109 gathering sources**, including 19 at Rosepetal: apple and pear trees, wild berry bushes and three poisonous mushroom types—Rosecap Amanita, Violet Bellcap and Inky Puffcap. Pick the fruit or collect mushrooms with Interact. The plant remains, its appearance changes, and it regrows by the saved in-game day. Gathering adds items to the Bag without automatically eating them.

Poisonous mushrooms are labelled crafting ingredients. The crafting system itself is still planned. The barn and growing beds are present, but player planting, crop tending, feeding, animal rescue, breeding and animal-management loops are not implemented.

## Combat and movement

Fight **16 approved monster species** emerging from **24 breakable camps**, four beside each long road. The roster includes slimes, horned rabbits, beetles, boars, orcs, goblins, crows, maggots, shamans, mimics, mantises, spectres, witch doctors, skeletons, minotaurs and pumpkins.

- Amaal has a three-hit katana combo. Hold Attack to chain strikes.
- Stamina governs attacking, running, dodging, guarding and spells. It recovers when Amaal catches her breath.
- Dodge through an attack’s timing window; solid fences and scenery still block movement.
- Guard protects the front. Timing the opening of the guard can parry and interrupt an enemy; heavy ground attacks call for movement or a dodge.
- Enemies show cone, charge-lane or ground-circle warnings before damage, then recover.
- Spells support travelling projectiles, piercing/return passes, roots, freeze, slows, burns, pulls, traps, healing and wards.

Camps and their waves are finite. Breaking a camp permanently stops its spawns and removes its surviving monsters. Actual kills grant 12 XP; clearing a camp grants 35 XP once. Camp cleanup grants no additional kill XP. Old saves receive credit for known cleared camps without resetting progress.

Towns, Rosepetal, ordinary interiors and ferries remain safe. Dummies provide practice without damaging animals or neighbours. Defeat returns Amaal to a safe home/town checkpoint with restored health and keeps collected resources, skills and cleared camps.

Motion includes brief acceleration, immediate stopping, collision-safe movement, smoother camera tracking, short buffered spell inputs, faster attack recovery and dedicated runtime-articulated dodge, guard, cast and hurt poses. Existing Amaal artwork supplies these poses; they are not a replacement sprite sheet. Automated frame-pacing checks cover 20–120 FPS, but the final feel still needs real-device playtesting.

## Twenty spells and progression

Each active spell has ranks I–III. Upgrades change actual effects such as damage, reach, duration, healing, ward charges or cooldowns.

| School | Four active spells |
| --- | --- |
| Katana | Petal Sweep, Rose Lance, Returning Crescent, Thorn Dance |
| Bloomcraft | Briar Bind, Seed Bolt, Healing Bloom, Thorn Wall |
| Stormy | Stormy’s Gust, Gale Step, Cyclone, Thunder Call |
| Frost | Frost Shard, Ice Ring, Winter Ward, Glacial Path |
| Ember | Ember Bolt, Flame Fan, Cinder Trap, Phoenix Pulse |

Six passive upgrades remain available: Finishing Cut, Petal Return, Lingering Roots, Deep Roots, Tailwind and Wind Ward. Equip any five learned spells across schools. Learning a spell and buying each additional rank cost one skill point.

A new journey starts with three points, earns two per level and currently reaches level 30. Levels are 60 XP apart. Surplus XP is retained, and development respecs are free, so different builds can be tried without restarting.

## Town life, story and audio

**104 named residents have 104 distinct appearances** across the seven towns. Free built-in schedules send them between work, breaks, shopping and evening rest. They animate tasks such as watering, crafting, sweeping, carrying cargo, reading and tending lamps. Workstations have reservations and waiting positions. These routines and authored dialogue run locally without an AI service.

A saved in-game clock drives routines, outdoor light and plant regrowth. One in-game hour takes about 75 seconds of active play. Stormy follows Amaal and can be spoken to; nearby animals have short interactions.

The story starts with **Raeez’s note on the tower bookshelf**. It points Amaal toward Maera, the herbalist in Lavendyr, who acknowledges his visit. The complete Raeez campaign, tracked NPC side quests, dungeon exploration and boss encounters are still planned. Ordinary minotaurs on the road are not a released boss fight.

Options can enable synthesized interaction and combat sound effects. There is currently no music soundtrack or artist-song playback.

## Controls, saves and devices

| Action | Keyboard |
| --- | --- |
| Move / run | WASD or arrows / Shift |
| Interact / gather / continue dialogue | E |
| Attack / dodge / guard and parry | Space / Q / C |
| Equipped spells | 1–5 |
| Map / Bag / Spellbook | M / B / K |
| Journal / Options | J / O |
| Eat noodles / close a menu | H / Escape |

Phones and tablets provide a D-pad, action buttons, five spell slots and travelling-kit icons. The game fills the browser viewport by default, with all menus and controls inside it. Sideways phones have a dedicated landscape layout. Native fullscreen is requested from a real Start click where supported; Safari can keep the full browser view. Modern iOS, Android, Windows, macOS and Linux browsers are the target; actual hardware/browser layout verification is still needed. The release is a browser game, not an App Store or Play Store native installer.

The game plays independently of ChatGPT, with no paid runtime APIs or gameplay-server account. Progress saves locally in the current browser, automatically and manually. Export/import save files to move between browsers, devices or hosting addresses; there is no automatic cloud save synchronization. Import retains a previous-save backup, and compatible older journeys migrate additively.

Optional offline play downloads a complete game release. Updates are applied through **Save & apply update** rather than interrupting a journey. Keep an exported save when changing devices or websites.

## Still planned

The present build does not yet include a finished campaign, tracked side-quest chains, dungeons, boss arenas, player crafting/cooking, shop economy, equipment/loot progression, creature catching or teams, animal management, multiplayer or a music soundtrack. The current map and assets provide locations for that expansion; their presence is not a claim that those systems are already playable.
