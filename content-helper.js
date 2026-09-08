#!/usr/bin/env node
/**
 * Static content helper. Run from the site root:
 * node content-helper.js add blog "My Post" "Description" "#B8E986" computational
 * node content-helper.js add work "Project" "Description"
 * node content-helper.js validate
 * All generated content is public when deployed. Keep confidential source files elsewhere.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SECTION_CATEGORIES = Object.freeze({
    blog: ['computational', 'ai', 'experiments'],
    work: ['architecture', 'branding', 'engineering', 'publications', 'development'],
    research: ['cross-industry', 'sustainability', 'modular', 'fabrication']
});
const DEFAULT_CATEGORIES = Object.freeze({
    blog: 'computational', work: 'architecture', research: 'sustainability'
});
const SECTIONS = Object.keys(SECTION_CATEGORIES);
const SLUG_PATTERN = /^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u;
const COLOR_PATTERN = /^#[\da-f]{6}$/i;

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

class ContentHelper {
    constructor(baseDir = process.cwd()) {
        this.baseDir = fs.realpathSync(path.resolve(baseDir));
    }

    // Also check existing ancestors so a symlink cannot point outside the site.
    resolveLocal(relativePath) {
        if (typeof relativePath !== 'string' || !relativePath ||
            /[\\\u0000-\u001f?#]/u.test(relativePath) || path.isAbsolute(relativePath) ||
            /^[a-z][a-z\d+.-]*:/i.test(relativePath)) {
            throw new Error(`Invalid local path: ${String(relativePath)}`);
        }
        let decoded;
        try { decoded = decodeURIComponent(relativePath); }
        catch { throw new Error(`Invalid URL encoding in path: ${relativePath}`); }
        if (decoded !== relativePath || relativePath.split('/').some(part => part === '.' || part === '..')) {
            throw new Error(`Encoded or traversing paths are not allowed: ${relativePath}`);
        }
        const absolutePath = path.resolve(this.baseDir, relativePath);
        const insideRoot = candidate => candidate === this.baseDir || candidate.startsWith(`${this.baseDir}${path.sep}`);
        if (!insideRoot(absolutePath)) throw new Error(`Path leaves the site: ${relativePath}`);
        let ancestor = absolutePath;
        while (!fs.existsSync(ancestor)) {
            // existsSync returns false for dangling symlinks, which must also be rejected.
            try {
                if (fs.lstatSync(ancestor).isSymbolicLink()) throw new Error(`Dangling symlink: ${relativePath}`);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
            const parent = path.dirname(ancestor);
            if (parent === ancestor) throw new Error(`Cannot resolve path: ${relativePath}`);
            ancestor = parent;
        }
        if (!insideRoot(fs.realpathSync(ancestor))) throw new Error(`Symlink leaves the site: ${relativePath}`);
        return absolutePath;
    }

    ensureDirectories() {
        for (const section of SECTIONS) {
            fs.mkdirSync(this.resolveLocal(`content/${section}`), { recursive: true });
        }
    }

    slugify(text) {
        return String(text).normalize('NFC').toLowerCase()
            .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
            .replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    }

    generateMarkdownTemplate(title, description) {
        return `# ${escapeHTML(title)}

${escapeHTML(description)}

<!-- PUBLIC CONTENT: This Markdown file and every linked asset are publicly accessible after deployment.
Use only approved summaries and images. Do not include client data, credentials, source algorithms,
original models, or confidential research. Deleting this note does not change access permissions. -->

## Question

공개 가능한 연구 질문이나 프로젝트의 문제를 작성하세요.

## Approach

공개해도 되는 계산적 접근과 본인의 역할을 설명하세요.

## Process

공개 승인을 받은 제작 과정, 실험과 이미지를 추가하세요.

## Results

검증한 결과와 비교 기준을 작성하세요. 수치가 없으면 정성적인 관찰임을 밝히세요.

## References

공개 논문과 자료를 연결하세요.
`;
    }

    generateDetailPageHTML(section, slug, title, description = title) {
        const safeTitle = escapeHTML(title);
        const sectionLabel = { blog: 'Notes', work: 'Work', research: 'Research' }[section];
        const header = fs.readFileSync(path.join(__dirname, 'templates/header.html'), 'utf8').replaceAll('{{base}}', '../../').replace('#main-content', '#post-detail');
        const footer = fs.readFileSync(path.join(__dirname, 'templates/footer.html'), 'utf8').replaceAll('{{base}}', '../../');
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle} | DAWONX</title>
    <meta name="description" content="${escapeHTML(description)}">
    <meta name="color-scheme" content="dark">
    <link rel="icon" href="../../favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
    <link rel="stylesheet" href="../../styles.css">
    <link rel="stylesheet" href="../../portfolio.css">
</head>
<body>
    <!-- site-header:start -->${header}<!-- site-header:end -->
    <div class="content-page">
        <a href="../../${section}.html" class="back-button">← ${sectionLabel}</a>
        <div class="post-container">
            <aside id="toc-container" class="toc-container" aria-label="On this page"></aside>
            <main id="post-detail" class="content-body" tabindex="-1" aria-busy="true">
                <h1>${safeTitle}</h1>
                <p>${escapeHTML(description)}</p>
                <noscript><p><a href="../../content/${section}/${slug}.md">Read the public Markdown document</a></p></noscript>
            </main>
        </div>
    </div>
    <!-- site-footer:start -->${footer}<!-- site-footer:end -->
    <script>window.basePath = '../../';</script>
    <script src="../../assets/vendor/marked.umd.js" defer></script>
    <script src="../../assets/vendor/purify.min.js" defer></script>
    <script src="../../script.js" defer></script>
</body>
</html>
`;
    }

    inspectPosts(section, posts, checkFiles = true) {
        const issues = [];
        if (!Array.isArray(posts)) return [`content/${section}/posts.json must contain an array`];
        const seenPaths = new Set();
        posts.forEach((post, index) => {
            const label = `content/${section}/posts.json[${index}]`;
            const issue = message => issues.push(`${label}: ${message}`);
            if (!post || typeof post !== 'object' || Array.isArray(post)) {
                issue('Entry must be an object');
                return;
            }
            for (const field of ['title', 'description', 'image', 'path', 'color', 'category']) {
                if (typeof post[field] !== 'string' || !post[field].trim()) issue(`Missing or invalid ${field}`);
            }
            if (!SECTION_CATEGORIES[section].includes(post.category)) {
                issue(`category must be one of: ${SECTION_CATEGORIES[section].join(', ')}`);
            }
            if (!COLOR_PATTERN.test(post.color || '')) issue('color must be a six-digit hex value');
            if (post.visibility !== undefined && post.visibility !== 'public') {
                issue('Only public content belongs in the static site; visibility does not enforce authentication');
            }
            for (const field of ['title_ko', 'description_ko', 'subcategory', 'author']) {
                if (post[field] !== undefined && (typeof post[field] !== 'string' || !post[field].trim())) issue(`Invalid ${field}`);
            }
            if (post.tags !== undefined && (!Array.isArray(post.tags) || post.tags.some(tag => typeof tag !== 'string' || !tag.trim()))) {
                issue('tags must be an array of nonempty strings');
            }
            if (post.date !== undefined && (typeof post.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(post.date) ||
                Number.isNaN(Date.parse(post.date)) || new Date(post.date).toISOString().slice(0, 10) !== post.date)) {
                issue('date must be a valid YYYY-MM-DD date');
            }
            if (post.series !== undefined && (!post.series || typeof post.series !== 'object' ||
                typeof post.series.name !== 'string' || !post.series.name.trim() || !Number.isInteger(post.series.order) || post.series.order < 1)) {
                issue('series must have a name and a positive integer order');
            }
            const checkFile = relativePath => {
                try {
                    const fullPath = this.resolveLocal(relativePath);
                    if (checkFiles && (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile())) issue(`Missing file: ${relativePath}`);
                } catch (error) { issue(error.message); }
            };
            if (typeof post.path === 'string') {
                const pieces = post.path.split('/');
                if (pieces.length !== 3 || pieces[0] !== section || pieces[2] !== '' || !SLUG_PATTERN.test(pieces[1])) {
                    issue(`path must be ${section}/a-valid-slug/`);
                } else {
                    if (seenPaths.has(post.path.normalize('NFC').toLowerCase())) issue(`Duplicate path: ${post.path}`);
                    seenPaths.add(post.path.normalize('NFC').toLowerCase());
                    checkFile(`content/${section}/${pieces[1]}.md`);
                    checkFile(`${post.path}index.html`);
                }
            }
            if (typeof post.image === 'string') checkFile(post.image);
        });
        return issues;
    }

    async addContent(section, title, description, color = '#B8E986', category = DEFAULT_CATEGORIES[section]) {
        if (!SECTIONS.includes(section)) throw new Error(`Section must be one of: ${SECTIONS.join(', ')}`);
        if (typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) {
            throw new Error('Title and description must be nonempty strings');
        }
        const slug = this.slugify(title);
        if (!SLUG_PATTERN.test(slug)) throw new Error('Title must contain at least one letter or number');
        if (!COLOR_PATTERN.test(color)) throw new Error('Color must be a six-digit hex value, for example "#B8E986"');
        if (!SECTION_CATEGORIES[section].includes(category)) {
            throw new Error(`Category for ${section} must be one of: ${SECTION_CATEGORIES[section].join(', ')}`);
        }

        const postsJsonPath = this.resolveLocal(`content/${section}/posts.json`);
        const markdownPath = this.resolveLocal(`content/${section}/${slug}.md`);
        const detailPageDir = this.resolveLocal(`${section}/${slug}`);
        const detailPagePath = path.join(detailPageDir, 'index.html');
        const newPost = {
            title: title.trim(), description: description.trim(), image: 'assets/optimized/computational-study.webp',
            path: `${section}/${slug}/`, category, color, visibility: 'public',
            languages: ['en'],
            date: new Date().toISOString().slice(0, 10)
        };
        const newIssues = this.inspectPosts(section, [newPost], false);
        if (newIssues.length) throw new Error(newIssues.join('\n'));
        this.ensureDirectories();
        fs.mkdirSync(this.resolveLocal(section), { recursive: true });
        const lockPath = `${postsJsonPath}.lock`;
        let lock;
        try { lock = fs.openSync(lockPath, 'wx'); }
        catch (error) {
            if (error.code === 'EEXIST') throw new Error(`Another content update may be running: ${lockPath}`);
            throw error;
        }
        const temporaryPath = `${postsJsonPath}.${crypto.randomBytes(8).toString('hex')}.tmp`;
        let createdMarkdown = false;
        let createdDetailDir = false;
        let createdHTML = false;
        try {
            const posts = fs.existsSync(postsJsonPath) ? JSON.parse(fs.readFileSync(postsJsonPath, 'utf8')) : [];
            const existingIssues = this.inspectPosts(section, posts, false);
            if (existingIssues.length) throw new Error(existingIssues.join('\n'));
            if (posts.some(post => post.path.normalize('NFC').toLowerCase() === newPost.path.toLowerCase())) {
                throw new Error(`Content with slug "${slug}" already exists in ${section}`);
            }
            if (fs.existsSync(markdownPath) || fs.existsSync(detailPageDir)) {
                throw new Error(`Existing content files for "${slug}" will not be overwritten, even if absent from posts.json`);
            }
            fs.writeFileSync(markdownPath, this.generateMarkdownTemplate(newPost.title, newPost.description), { encoding: 'utf8', flag: 'wx' });
            createdMarkdown = true;
            fs.mkdirSync(detailPageDir);
            createdDetailDir = true;
            fs.writeFileSync(detailPagePath, this.generateDetailPageHTML(section, slug, newPost.title, newPost.description), { encoding: 'utf8', flag: 'wx' });
            createdHTML = true;
            posts.push(newPost);
            fs.writeFileSync(temporaryPath, `${JSON.stringify(posts, null, 4)}\n`, { encoding: 'utf8', flag: 'wx' });
            fs.renameSync(temporaryPath, postsJsonPath);
        } catch (error) {
            if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
            if (createdHTML) fs.unlinkSync(detailPagePath);
            if (createdDetailDir) fs.rmdirSync(detailPageDir);
            if (createdMarkdown) fs.unlinkSync(markdownPath);
            throw error;
        } finally {
            fs.closeSync(lock);
            fs.unlinkSync(lockPath);
        }
        console.log(`Created public content: ${newPost.path}`);
        console.log(`Markdown: content/${section}/${slug}.md`);
        console.log(`Category: ${category}. Add approved content and update its cover image before publishing.`);
        return newPost;
    }

    validateContent() {
        const issues = [];
        for (const section of SECTIONS) {
            try {
                const postsPath = this.resolveLocal(`content/${section}/posts.json`);
                const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
                issues.push(...this.inspectPosts(section, posts));
            } catch (error) {
                issues.push(`content/${section}/posts.json: ${error.message}`);
            }
        }
        if (issues.length) {
            console.error(`Content validation failed (${issues.length} issues):`);
            issues.forEach(issue => console.error(`  ${issue}`));
        } else {
            console.log('All content metadata, paths, categories and referenced files are valid.');
        }
        return issues;
    }
}

async function main(args = process.argv.slice(2)) {
    const helper = new ContentHelper();
    if (args[0] === 'add') {
        if (args.length < 4 || args.length > 6) {
            throw new Error('Usage: node content-helper.js add <section> "<title>" "<description>" ["#RRGGBB"] [category]');
        }
        const [, section, title, description, color, category] = args;
        await helper.addContent(section, title, description, color, category);
    } else if (args[0] === 'validate' && args.length === 1) {
        if (helper.validateContent().length) process.exitCode = 1;
    } else if (!args.length || ['help', '--help', '-h'].includes(args[0])) {
        console.log('DAWONX Content Helper');
        console.log('  add <section> "<title>" "<description>" ["#RRGGBB"] [category]');
        console.log('  validate');
        for (const section of SECTIONS) {
            console.log(`  ${section}: ${SECTION_CATEGORIES[section].join(', ')} (default: ${DEFAULT_CATEGORIES[section]})`);
        }
        console.log('Every generated file is public after deployment. Keep confidential originals outside the static site.');
    } else {
        throw new Error('Unknown command or arguments. Run node content-helper.js --help');
    }
}

module.exports = { ContentHelper, SECTION_CATEGORIES, DEFAULT_CATEGORIES, escapeHTML, main };
if (require.main === module) {
    main().catch(error => {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
    });
}
