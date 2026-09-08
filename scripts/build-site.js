'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { ContentHelper, escapeHTML } = require('../content-helper');
const marked = require('../assets/vendor/marked.umd.js');
const sanitizeHTML = require('sanitize-html');
const { decodeHTMLAttribute } = require('entities');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const sections = ['work', 'research', 'blog'];
const rootFiles = ['index.html', 'work.html', 'research.html', 'blog.html', 'mission.html', 'contact.html', '404.html', 'styles.css', 'portfolio.css', 'script.js', 'material-motion.js', 'favicon.svg', 'CNAME'];
const header = fs.readFileSync(path.join(root, 'templates/header.html'), 'utf8');
const footer = fs.readFileSync(path.join(root, 'templates/footer.html'), 'utf8');

function articleHTML(markdown, section) {
    const localURL = value => {
        if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
        const local = value.replace(/^\/+/, '');
        if (/^(assets|content|work|research|blog)\//.test(local)) return `../../${local}`;
        if (/^[^/]+\.md(?:[?#].*)?$/.test(local)) return `../../${section}/${local.replace(/(?:\.ko)?\.md/, '/')}`;
        return value;
    };
    return sanitizeHTML(marked.parse(markdown), {
        allowedTags: [...sanitizeHTML.defaults.allowedTags, 'img'],
        allowedAttributes: { ...sanitizeHTML.defaults.allowedAttributes, img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'], a: ['href', 'title', 'target', 'rel'] },
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        allowProtocolRelative: false,
        transformTags: {
            img: (tagName, attributes) => ({ tagName, attribs: { ...attributes, src: localURL(attributes.src), loading: 'lazy', decoding: 'async' } }),
            a: (tagName, attributes) => ({ tagName, attribs: { ...attributes, href: localURL(attributes.href), rel: 'noopener noreferrer' } })
        }
    });
}

function prerenderListing(html, section, posts) {
    return html.replace(/(<div class="project-grid" id="[^"]+-grid">)[\s\S]*?(<\/div>)/g, (match, opening, closing) => {
        const category = opening.match(new RegExp(`id="${section}-(.+)-grid"`));
        if (!category) return match;
        const cards = posts.filter(post => post.category === category[1]).map(post => `<article class="showcase-card"><a class="card-link" href="${escapeHTML(post.path)}"><div class="card-image"><img src="${escapeHTML(post.image)}" alt="${escapeHTML(post.title)}" width="600" height="400" loading="lazy" decoding="async"></div><div class="card-content"><div class="card-content-top"><span class="card-category">${escapeHTML(post.subcategory || post.category)}</span></div><div class="card-content-middle"><h3>${escapeHTML(post.title)}</h3></div></div></a></article>`).join('\n');
        return opening + cards + closing;
    });
}

function shell(html, base) {
    const skipTarget = html.includes('id="post-detail"') ? '#post-detail' : '#main-content';
    return html.replace(/<!-- site-header:start -->[\s\S]*?<!-- site-header:end -->/, `<!-- site-header:start -->${header.replaceAll('{{base}}', base).replace('#main-content', skipTarget)}<!-- site-header:end -->`)
        .replace(/<!-- site-footer:start -->[\s\S]*?<!-- site-footer:end -->/, `<!-- site-footer:start -->${footer.replaceAll('{{base}}', base)}<!-- site-footer:end -->`);
}
function write(relative, content) {
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
}
function copy(relative) {
    const source = path.join(root, relative);
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error(`Symlinks are not publishable: ${relative}`);
    if (fs.statSync(source).isDirectory()) {
        for (const entry of fs.readdirSync(source)) copy(`${relative}/${entry}`);
    } else write(relative, fs.readFileSync(source));
}
function redirect(relative, target) {
    const safe = escapeHTML(target);
    write(relative, `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${safe}"><meta name="robots" content="noindex"><title>DAWONX</title></head><body><a href="${safe}">Continue to DAWONX</a></body></html>`);
}
function versionURL(value, version) {
    // Preserve native anchors, external URLs, and non-page assets.
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
    const [, pathname, query = '', fragment = ''] = value.match(/^([^?#]*)(?:\?([^#]*))?(#.*)?$/);
    if (!/(?:\.(?:html|css|js)|\/)$/i.test(pathname)) return value;
    const params = new URLSearchParams(query);
    params.set('v', version);
    return `${pathname}?${params}${fragment}`;
}
function versionHTML(html, version) {
    const attributeURL = value => {
        const decoded = decodeHTMLAttribute(value);
        const updated = versionURL(decoded, version);
        return updated === decoded ? value : escapeHTML(updated);
    };
    return html.replace(/<(?:a|link|script)\b[^>]*>/gi, tag => tag.replace(/\b(href|src)="([^"]*)"/g, (match, attribute, value) => `${attribute}="${attributeURL(value)}"`))
        .replace(/(<meta http-equiv="refresh" content="0;url=)([^"]*)/g, (match, opening, value) => opening + attributeURL(value));
}
function versionOutput() {
    const files = fs.readdirSync(output, { recursive: true }).filter(file => fs.statSync(path.join(output, file)).isFile()).sort();
    const hash = createHash('sha256');
    for (const file of files) hash.update(file).update('\0').update(fs.readFileSync(path.join(output, file))).update('\0');
    const version = hash.digest('hex').slice(0, 12);
    for (const file of files.filter(file => file.endsWith('.html'))) {
        write(file, versionHTML(fs.readFileSync(path.join(output, file), 'utf8'), version));
    }
    return version;
}
function build() {
    const helper = new ContentHelper(root);
    for (const section of sections) {
        const posts = JSON.parse(fs.readFileSync(path.join(root, `content/${section}/posts.json`), 'utf8'));
        const issues = helper.inspectPosts(section, posts);
        for (const item of posts) {
            if (item.visibility !== 'public') issues.push(`Explicit public visibility required: ${item.path}`);
            if (!Array.isArray(item.languages) || !item.languages.includes('en') || item.languages.some(lang => !['en', 'ko'].includes(lang))) issues.push(`Invalid languages: ${item.path}`);
        }
        if (issues.length) throw new Error(issues.join('\n'));
    }
    fs.rmSync(output, { recursive: true, force: true });
    for (const file of rootFiles) {
        const source = fs.readFileSync(path.join(root, file));
        let result = file.endsWith('.html') ? shell(source.toString(), './') : source;
        const section = file.replace('.html', '');
        if (sections.includes(section)) result = prerenderListing(result, section, JSON.parse(fs.readFileSync(path.join(root, `content/${section}/posts.json`), 'utf8')));
        write(file, result);
    }
    // Only curated web derivatives and pinned runtime libraries enter the artifact.
    // Source code, original assets, unpublished notes and repository files stay out.
    copy('assets/optimized');
    copy('assets/vendor');
    copy('assets/blog');
    write('.nojekyll', '');
    for (const section of sections) {
        // Keep translations in source control, but publish only the English version.
        const posts = JSON.parse(fs.readFileSync(path.join(root, `content/${section}/posts.json`), 'utf8'))
            .map(post => ({ ...post, languages: ['en'] }));
        write(`content/${section}/posts.json`, JSON.stringify(posts));
        for (const post of posts) {
            const slug = post.path.split('/')[1];
            for (const language of post.languages) copy(`content/${section}/${slug}${language === 'ko' ? '.ko' : ''}.md`);
            // Generate every article from the shared template; there is one source of layout truth.
            const body = articleHTML(fs.readFileSync(path.join(root, `content/${section}/${slug}.md`), 'utf8'), section);
            const article = helper.generateDetailPageHTML(section, slug, post.title, post.description)
                .replace(/(<main id="post-detail"[^>]*>)[\s\S]*?<\/main>/, (match, opening) => opening.replace('aria-busy="true"', 'aria-busy="false" data-rendered-lang="en"') + body + '</main>');
            write(`${post.path}index.html`, article);
            redirect(`ko/${post.path}index.html`, `../../../${post.path}`);
        }
        redirect(`${section}/index.html`, `../${section}.html`);
    }
    for (const page of ['mission', 'contact']) redirect(`${page}/index.html`, `../${page}.html`);
    redirect('ko/index.html', '../index.html');
    for (const page of ['work', 'research', 'blog', 'mission', 'contact']) redirect(`ko/${page}/index.html`, `../../${page}.html`);
    const version = versionOutput();
    console.log(`Static site built in dist/ (release ${version}). Articles and archive links are rendered before publication.`);
}
if (require.main === module) build();
module.exports = { build, shell, articleHTML, versionURL, versionHTML };
