# Blooming Quest: Amaal's Journey

A laptop-friendly pixel-art adventure with a private tower estate, seven towns, long roads, camp encounters and a companion named Stormy.

The browser game lives in `dist/`. It runs without ChatGPT, an AI API key or a game-server account. Serve that folder over HTTP(S); opening its HTML through `file://` is not supported.

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

[The expansion design](docs/ARPG-SYSTEMS.md) describes original Dimraeth-inspired combat, skill branches, dungeons, bosses and NPC quest chains. Those progression systems are proposed work, not implemented features of this browser release.

## Artwork

Keep `dist/credits.html` and the asset provenance files with the game. Individual creator terms apply to the credited free packs. The artwork is included as part of this game, not as a standalone asset collection.
