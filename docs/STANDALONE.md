# Standalone browser game

The playable game uses ordinary local HTML, JavaScript, JSON and image files.
It does not call ChatGPT, OpenAI, an AI API or a game backend while playing.
The `.openai` directory configures the existing development host and is not part
of a standalone export. Hosting access rules are separate from the game code.

## Build and verify

After the final source or asset changes, run:

```sh
python3 tools/export-standalone.py --prepare-only
python3 tools/export-standalone.py --check
node tests/save-transfer.cjs
node tests/offline.cjs
python3 tests/standalone-export.py
```

Preparation hashes the complete static game and writes `dist/offline-files.js`.
Every source/asset change produces a new release identity. Run preparation as a
build step before uploading `dist` to static hosting. URLs are relative and work
at a site root or a repository subpath.

To deliver an uploadable browser build:

```sh
python3 tools/export-standalone.py --output /path/outside/dist/blooming-quest-browser.zip
```

The ZIP has `index.html` at its root and excludes `.git`, `.openai`, credentials
and development tools. It is not a native laptop installer. Double-clicking an
HTML file is unreliable because browsers normally reject JSON fetches under
`file://`; serve the folder over HTTP(S), or use the optional offline mode after
opening the hosted game once.

## Move existing saves safely

Browser saves belong to their website origin. A different domain cannot read
the previous website's `localStorage` automatically.

1. Open the old game and choose **Save files & offline play → Export save**.
2. Open the new website and choose **Import save**.
3. Choose the exported JSON file. The game validates it, backs up the destination
   browser's current journey, imports the save and reloads into that location.

**Restore previous save** reverses an import while keeping a backup of the
current journey. The stable save key remains `blooming-world-v05`. Camp progress,
quest flags, inventory, picked plants, clock and resident state are preserved.
Save files stay local; importing does not upload them to any service.

## Optional offline play and updates

On HTTPS or localhost, **Enable offline play** downloads one complete local
release. The install is atomic: a missing file aborts the new cache and keeps the
previous release. Optional external creator-preview pictures and outbound links
still need internet access.

Offline mode serves a coherent installed release. A later version downloads in
the background and waits. **Save & apply update** saves the current journey,
clears temporary development-travel URL parameters, activates the waiting worker
and reloads once. Other game tabs must be closed first, preventing a running old
tab from receiving new-version assets mid-session. A normal browser close/open
can also finish a waiting update after all old tabs have closed.

Caches are scoped by the hosting subpath so two hosted game folders do not
delete one another's offline caches. Browser storage may be cleared or evicted;
exported save backups remain important.

Future releases still need a source edit and a deployment through the connected
hosting/repository account. The game does not need ChatGPT running to play.
