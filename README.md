# Blooming Quest: Amaal's Journey

A laptop-friendly pixel-art adventure with a private tower estate, seven towns, long roads, camp encounters and a companion named Stormy.

The browser game lives in `dist/`. It runs without ChatGPT, an AI API key or a game-server account. Serve that folder over HTTP(S); opening its HTML through `file://` is not supported.

## Amaal’s travelling kit

The medieval object toolbar opens an in-game Map (M), Bag (B), Spellbook (K), Journal (J) and Options (O). Wood, leather, brass and parchment panels match the approved visual concepts. The Map retains Map A with current location, hover highlights and development travel to all seven towns plus home. The Bag reads real saved quantities; explicitly eat apples/pears/berries for one heart or noodles for two. Poison mushrooms remain crafting-only and full health consumes nothing. Menus pause gameplay and save current position.

See [everything playable now](docs/PLAYABLE-NOW.md) for the complete world, combat, spells, gathering, NPC routines, story, save and device guide, including unfinished systems.

## Combat and skills

Open **Skills (K)** for 20 spells across Katana, Bloomcraft, Stormy, Frost and Ember, each with three ranks. The tree retains six passives, supports school/search filters, and shows current/next-rank effects. Spend three starting points, then earn XP from actual monster kills and camp clears. Equip five spells to 1–5; Q dodges, holding C guards, and the opening guard window can parry frontal attacks. Stamina and enemy warnings make timing matter. Brief input buffering, hold-to-chain attacks, safe recovery cancels, faster combos, smooth camera tracking and dedicated runtime dodge/guard/cast/hurt poses improve responsiveness. The rose/brass HUD shows health, stamina, level, XP, cooldowns and nearby target health. Touch controls expose the same actions. Dungeons, bosses and expanded NPC quest chains remain planned.

## Playing and saves

Use WASD/arrows to move, Shift to run, E to interact/harvest, Space for the katana combo, M for the map and J for the journal. Phones and tablets have a D-pad plus Interact, Attack, Run, Heal, Map and Journal buttons. Expanded play keeps those controls visible. Modern iOS, Android and desktop browsers are the target; real-device verification is still needed.

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

[The expansion design](docs/ARPG-SYSTEMS.md) describes original Dimraeth-inspired combat, skill branches, dungeons, bosses and NPC quest chains. Combat, 20 ranked spells, the spellbook interface and smoother motion are implemented in v0.14. Dungeons, bosses and tracked multi-stage NPC quest chains remain proposed work.

## Artwork

Keep `dist/credits.html` and the asset provenance files with the game. Individual creator terms apply to the credited free packs. The artwork is included as part of this game, not as a standalone asset collection.
