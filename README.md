# Squad Finder

A small hackathon board for finding teammates. Profiles live in a [Yjs](https://docs.yjs.dev/) document stored in IndexedDB. Encrypted updates are forwarded through a public MQTT relay (HiveMQ, then EMQX if that is unreachable) so browsers on different networks merge the same board. The room code is the encryption key. The relay cannot read the profiles.
.
```bash
npm install
npm run dev
```

Open the same room in two browsers and publish a card in each.

## Host it on GitHub

GitHub-hosted runners build the app. GitHub Pages serves the static site. The workflow is `.github/workflows/pages.yml`. It runs on every push to `main`, installs dependencies, builds with Vite, and publishes the `dist` folder.

Free GitHub Pages hosting requires a **public** repository.

1. Commit these changes and push them to `main`.
2. On GitHub, open **Settings → General**. Under **Danger zone**, choose **Change repository visibility** and set the repository to **Public**.
3. Open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the **Actions** tab. The **Deploy to GitHub Pages** workflow should be running (or start it with **Run workflow**). Both jobs use `ubuntu-latest` runners.
5. When the deploy job finishes, the live URL is on that run and under **Settings → Pages**.

For this repository that URL is:

https://leonewt0n.github.io/MLH_TeamMember_Finder/

Later pushes to `main` rebuild and republish the site. Room links keep the room code in the query string (`?room=...`), so they work on the hosted site.
