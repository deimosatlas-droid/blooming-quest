# Blooming Quest: Amaal's Journey

A laptop-friendly pixel-art adventure with a private tower estate, seven towns, long roads, camp encounters and a companion named Stormy.

The browser game lives in `dist/`. It runs without ChatGPT, an AI API key or a game-server account. Serve that folder over HTTP(S); opening its HTML through `file://` is not supported.

## Amaal’s travelling kit

The v0.17 game fills the browser viewport. A single satchel opens the Map, Bag, Spellbook, Journal and Options in paused medieval parchment menus. The title provides Continue, protected New Journey, Import and remembered keyboard/touch/hybrid profiles. Options includes remapping, touch size/opacity, handedness, text, reduced motion/flashes, weather and separate sound/ambient volumes. Actual save/offline/update controls stay inside Options and remain accessible during loading.

See [everything playable now](docs/PLAYABLE-NOW.md) for the complete world, combat, spells, gathering, NPC routines, story, save and device guide, including unfinished systems.

## Combat and skills

Open **Skills (K)** for 20 spells across Katana, Bloomcraft, Stormy, Frost and Ember, each with three ranks. The tree retains six passives, supports school/search filters, and shows current/next-rank effects. Spend three starting points, then earn XP from actual monster kills and camp clears. Equip five spells to 1–5; Q dodges, holding C guards, and the opening guard window can parry frontal attacks. Stamina and enemy warnings make timing matter. Brief input buffering, hold-to-chain attacks, safe recovery cancels, faster combos, smooth camera tracking and dedicated runtime dodge/guard/cast/hurt poses improve responsiveness. The rose/brass HUD shows health, stamina, level, XP, cooldowns and nearby target health. Touch controls expose the same actions. The opening quest now leads through Maera’s bluebells to Briarvault: three exploration-spell puzzles, a checkpoint/shortcut, an approved-art Guardian boss, Raeez’s cache and optional repeat trials. Later chapters remain planned.

## Playing and saves

Use WASD/arrows to move, Shift to run, E to interact/harvest, Space for the katana combo, M for the map and J for the journal. Phones and tablets have single-thumb eight-way movement, combat actions, five spells and one satchel for menus. Expanded play keeps those controls visible. Modern iOS, Android and desktop browsers are the target; real-device verification is still needed.

Progress is stored in the current browser. The **Save files & offline play** panel exports/imports a journey when changing website or device. Optional offline mode downloads a complete release, and an update saves before an explicit reload.

## Releases

The included GitHub Pages workflow publishes `dist/` after its checks pass. Repository Pages settings must use **GitHub Actions**. See [independent hosting](docs/GITHUB-PAGES.md), [portable browser builds](docs/STANDALONE.md), and [free private-source hosting](docs/PRIVATE-HOSTING.md).

Prepare the offline release with:

```sh
python3 tools/export-standalone.py --prepare-only
```

Build an uploadable browser ZIP with:

```sh
python3 tools/export-standalone.py --output /tmp/blooming-quest-browser.zip
```

See [regression checks](tests/README.md). Native render checks additionally use `@napi-rs/canvas`; the player does not need that development package.

## Planned action RPG expansion

[The expansion design](docs/ARPG-SYSTEMS.md) describes original Dimraeth-inspired combat, skill branches, dungeons, bosses and NPC quest chains. Combat, 20 ranked spells, the spellbook, improved enemy animation, a complete first quest and one replayable dungeon/boss are implemented in v0.17. NPCs enter their existing homes at night; regional weather, free synthesized ambience and small garden/animal/keepsake rituals are available. Later chapters and broader systems remain proposed work.

## Artwork

Keep `dist/credits.html` and the asset provenance files with the game. Individual creator terms apply to the credited free packs. The artwork is included as part of this game, not as a standalone asset collection.
