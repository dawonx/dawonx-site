# DAWONX

A static portfolio connecting computational design, sustainability, research and industrial practice. Plain HTML, CSS and JavaScript, with Markdown for articles. No Astro, client framework or database. Build dependencies `sanitize-html` and `entities` sanitize article HTML and preserve URL character references during publication.

## Run locally

Requires Node.js 22 or newer. Install the locked build dependencies once.

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

GitHub Actions builds and checks the static artifact. `main` deploys `dist/` to the existing GitHub Pages site at https://dawonx.com. The `codex/portfolio-refresh` branch and pull requests run validation only. The workflow installs the locked build dependencies and runs the small static build script; no Astro action is used.

Every page shares the same sticky header. Published navigation links, stylesheets and scripts carry a release version derived from the build output, so navigation after an update requests fresh pages and matching assets instead of reusing old header markup.

The landing background blends three soft CSS gradients in teal, blue and green through small changes in scale, rotation and opacity. `water-surface.js` overlays ten independent wave components with unequal wavelengths, directions and phases, producing local interference rather than moving one combined pattern. Wave speeds follow deep-water dispersion, `k = 2π/λ` and `ω = √(gk)`. The longest waves have 4.3–8.9 scene-unit wavelengths; smaller components add progressively weaker slope detail. A shared time scale of 0.28 gives the large waves approximately 6–9 second periods. These sizes, directional balance, timing and exposure are artistic settings for calm water. The normal field drives broad highlights and view-dependent Schlick Fresnel reflectance (water F0 ≈ 0.02037). This is a lightweight normal-field approximation, with no image sampling, videos or rendering library. A small, static monochrome SVG noise tile adds film grain below the text shade and stays visible in fallback states.

The model follows the independent-wave and slope-detail principles in [NVIDIA GPU Gems, Chapter 1](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models), the dispersion relation in [Tessendorf's ocean course notes](https://jtessen.people.clemson.edu/reports/papers_files/coursenotes2004.pdf), and the [Schlick reflection approximation](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-17-robust-multiple-specular-reflections-and-refractions). The shader is authored for this site. Highlights favour the right side. Water rendering is capped at 30 fps and 520,000 pixels (240,000 on mobile); unsupported graphics fall back to the gradients. `ambient-motion.js` shares visibility, reduced-motion and data-saving state with both animated effects. Hidden/offscreen pages stop rendering, reduced motion freezes the background, and context restoration resumes without a time jump. The gradients and grain remain visible without JavaScript, and the landing has no motion button. Earlier fiber artwork remains in Git history and its saved image is no longer loaded by the hero.

The site currently publishes English only, with no language picker. Old Korean preferences and `?lang=ko` links do not change the displayed language. Existing `/ko/` routes redirect to the corresponding English pages, and Korean Markdown is excluded from `dist/`. Translation sources and rendering support are retained for a later relaunch. `window.basePath` keeps internal links compatible with a project subpath.

The previous Astro implementation remains in Git history. The migration retains all 20 English article entries, the existing Korean article and their metadata. Existing article claims and project descriptions are preserved from the prior source; verify authorship, contribution and outcome evidence before promoting them as portfolio achievements.
