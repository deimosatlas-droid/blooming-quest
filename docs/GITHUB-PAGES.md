# Independent browser hosting

The game is ordinary static HTML, JavaScript, JSON and local artwork. Playing it does not call ChatGPT, OpenAI or a paid AI service. The existing Sites copy can stay available during the move so the player can export their current save.

## One-time setup

1. Connect the owner's GitHub account to the editing conversation. Merely having a GitHub account does not give the conversation permission to publish through it.
2. Create a dedicated repository, such as `blooming-quest`. GitHub Pages on GitHub Free uses a public repository. Confirm the owner and intended repository before writing; do not overwrite an unrelated existing project.
3. Publish this project's source and game assets, excluding `.git`, `.openai`, credentials, temporary work files and local release archives. Keep the creator credit and provenance files with the game.
4. In the repository's Pages settings, choose **GitHub Actions** as the publishing source.
5. Run the included **Publish browser game** workflow. It checks the game, creates a content-versioned offline manifest and uploads only `dist/`.

The resulting address is supplied by the successful Pages deployment, usually `https://OWNER.github.io/REPOSITORY/`. This is an example pattern, not a claim that a particular address is already live.

## Moving an existing journey

1. Open the original game and use **Export save**. Download the JSON file before leaving the old address.
2. Open the new address and use **Import save**. The import checks the file, keeps a rollback copy of the current journey and resumes the imported location.
3. Keep the exported file as a backup. A new website cannot read another website's browser storage automatically.

Progress remains stored locally on the player's device. Updates at the same address preserve it. Changing device, browser profile or website requires another export/import; this is not cloud-save synchronization.

## Future updates

Continue editing and testing the same project through ChatGPT. With the GitHub connection available, publish the tested source to the repository's main branch. The Pages workflow publishes the new browser build. No ChatGPT connection is needed on a player's device.

The browser's optional offline cache accepts a complete release before replacing the previous one. An available update is applied only after an explicit save-and-reload action. Ordinary code updates must not rename `blooming-world-v05` or reset inventory, quests, camps, harvest dates or the saved clock.

## Portable ZIP

Run `python3 tools/export-standalone.py --output /absolute/path/blooming-quest-browser.zip`. The archive puts `index.html` at its root and excludes Sites identity and Git metadata. It can also be uploaded to another static host.

The ZIP is a hosting package, not a native laptop installer. The game loads local JSON through browser fetch requests, so double-clicking its HTML through `file://` is not a reliable way to play. Use HTTP(S), or the optional installed browser app after its first successful cache download.

## Official hosting references

- [GitHub Pages availability and static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Custom GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

External publication still requires the owner's GitHub connection and a successful deployment. A prepared ZIP or workflow is not evidence that the new website is live.
