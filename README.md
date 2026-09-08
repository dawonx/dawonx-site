# DAWONX

A static portfolio connecting computational design, sustainability, research and industrial practice. Plain HTML, CSS and JavaScript, with Markdown for articles. No Astro, client framework or database. A single build dependency, `sanitize-html`, sanitizes article HTML before publication.

## Run locally

Requires Node.js 22 or newer. Install the locked build dependency once.

```sh
npm ci --ignore-scripts
npm run dev
```

Open http://127.0.0.1:8765. After editing, run `npm run build` and refresh. `PORT=8766 npm run preview` can select another local port.

## Content and shared layout

- `index.html`: curated home page.
- `work.html`, `research.html`, `blog.html`: archive pages.
- `content/<section>/posts.json`: public metadata, categories, language availability and image paths.
- `content/<section>/<slug>.md`: public article text. Korean translations are retained as `<slug>.ko.md` in source but are temporarily excluded from publication.
- `templates/header.html` and `templates/footer.html`: common navigation and footer. Applied to every page during the build.
- `content-helper.js`: shared article template and validated content creation.
- `styles.css`: document primitives. `portfolio.css`: visual layout and responsive behavior.
- `assets/optimized/`: lightweight web artwork. Existing illustrated articles retain their attributed images in `assets/blog/`.

```sh
node content-helper.js add blog "Article title" "Public description" "#B8E986" computational
node content-helper.js add work "Project title" "Public description" "#B8E986" engineering
node content-helper.js validate
npm run build
npm run check
```

Category is optional and defaults to computational for notes, architecture for work, and sustainability for research. New entries declare public visibility and English language. Replace the generated text and cover with approved material before publishing. The homepage selection is curated independently from the archive lists.

## Public content boundary

This GitHub repository is public. Keep confidential research, customer information, code, original models and datasets outside the repository. An ignored folder, unpublished branch, hidden link or client-side password is not an access-control system. A file already published in Git history remains recoverable from that history.

The build includes explicit public article entries and their declared translations, selected pages, curated web assets and pinned browser libraries. It excludes repository/tooling files and unlisted Markdown. This reduces accidental publication through the site artifact; it does not make content in the public repository confidential. Restricted sharing needs a separate authenticated service and private storage, which this site does not implement.

Articles and archive links are rendered into HTML at build time so they remain readable without JavaScript. Build-time Markdown is sanitized with `sanitize-html`; language changes in the browser use a vendored DOMPurify before insertion. Marked and DOMPurify versions and licenses are recorded in `assets/vendor/`. Review these versions for security updates periodically.

## Deployment

GitHub Actions builds and checks the static artifact. `main` deploys `dist/` to the existing GitHub Pages site at https://dawonx.com. The `codex/portfolio-refresh` branch and pull requests run validation only. The workflow installs the locked sanitizer and runs the small static build script; no Astro action is used.

The site currently publishes English only, with no language picker. Old Korean preferences and `?lang=ko` links do not change the displayed language. Existing `/ko/` routes redirect to the corresponding English pages, and Korean Markdown is excluded from `dist/`. Translation sources and rendering support are retained for a later relaunch. `window.basePath` keeps internal links compatible with a project subpath.

The previous Astro implementation remains in Git history. The migration retains all 20 English article entries, the existing Korean article and their metadata. Existing article claims and project descriptions are preserved from the prior source; verify authorship, contribution and outcome evidence before promoting them as portfolio achievements.
