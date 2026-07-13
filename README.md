# Personal Notes

A zero-dependency pure frontend personal notes website. Write notes in Markdown, organize in folders, push to GitHub — the site auto-discovers and renders them.

## Quick Start

1. Fork or clone this repo
2. Edit `index.html` — replace `__NOTE_OWNER` and `__NOTE_REPO` with your GitHub credentials
3. Push `.md` files to the `notes/` folder in your repo
4. Enable GitHub Pages (Settings → Pages → deploy from `main` branch, root folder)
5. Visit `https://<your-username>.github.io/<your-repo>/`

## Features

- Yuque-inspired UI with collapsible sidebar tree
- Full-text search across all notes
- Incremental updates — only downloads changed files
- Offline-capable with localStorage cache
- Responsive: mobile, tablet, desktop
- Zero CDN dependencies — works offline after initial load

## Notes

Put `.md` files in the `notes/` folder. Use subdirectories for organization.
Images go in `assets/images/` and are referenced with relative paths.
