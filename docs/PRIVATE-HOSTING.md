# Free hosting with a private GitHub repository

The user wants the development repository private while the browser game remains playable on iOS, Android and desktop browsers. GitHub Pages on GitHub Free requires a public repository. Cloudflare Pages can build a private GitHub project and serve the resulting game at a separate free `pages.dev` address.

## Migration order

1. Keep the current GitHub Pages game working until its replacement is verified. Export the latest player save from **Save files & offline play** before changing websites.
2. In a free Cloudflare account, open **Workers & Pages → Create application → Pages → Connect to Git**.
3. Connect GitHub and authorize the Cloudflare application for `deimosatlas-droid/blooming-quest`.
4. Select that repository and configure:
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: `sh tools/build-browser.sh`
   - Build output directory: `dist`
   - Root directory: leave blank
5. Deploy. Use the exact successful deployment URL returned by Cloudflare; do not assume a particular project name is available.
6. Verify the game, map, assets and save import at that URL. Import the exported journey there.
7. Only after that verification, change the GitHub repository visibility to **Private** in its settings. Keep the ChatGPT GitHub application and the Cloudflare application authorized for this repository.
8. Verify private-repository access through the connected GitHub tools, then remove the obsolete GitHub Pages deployment workflow. Record the new canonical game URL in AGENTS.md and README.md.

The available GitHub connector can edit game files, but it does not expose repository-visibility or Cloudflare-account setup actions. Those account settings require the owner's one-time action. Never request account passwords or access tokens in chat.

## Future releases

Continue editing the private repository through the existing GitHub connection. A push to main triggers Cloudflare's build, which checks the game and creates a complete content-versioned offline release. The player's browser needs neither a GitHub login nor a ChatGPT connection.

Private repository access and private game access are different settings. A private source repository does not automatically put a password on the published game. Browser-delivered JavaScript and artwork are downloaded by players in order to run it.

## Official references

- [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Cloudflare Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)
- [Cloudflare Pages free-plan limits](https://developers.cloudflare.com/pages/platform/limits/)

This is the prepared migration procedure. It is not a claim that Cloudflare is already configured or that repository visibility has already changed.
