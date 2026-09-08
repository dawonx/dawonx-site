'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const marked = require('../assets/vendor/marked.umd.js');
const { ContentHelper } = require('../content-helper');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const errors = new ContentHelper(root).validateContent();
let checkedLinks = 0;
let checkedPages = 0;
function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
function localLink(value, source, markdown = false) {
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return;
    let local;
    try { local = decodeURIComponent(value.split(/[?#]/)[0]); } catch (_) { errors.push(`Invalid URL: ${source}: ${value}`); return; }
    if (!local) return;
    const rootRelative = local.startsWith('/') || (markdown && /^(assets|content|work|research|blog)\//.test(local));
    let target = path.resolve(rootRelative ? output : path.dirname(source), local.replace(/^\/+/, ''));
    if (!target.startsWith(output + path.sep) && target !== output) { errors.push(`Link escapes output: ${value}`); return; }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    checkedLinks++;
    if (!fs.existsSync(target)) errors.push(`Broken link in ${path.relative(output, source)}: ${value}`);
}
assert(fs.existsSync(path.join(output, 'index.html')), 'Run npm run build first');
for (const file of files(output)) {
    const extension = path.extname(file);
    if (extension === '.html') {
        checkedPages++;
        const source = fs.readFileSync(file, 'utf8');
        const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
        if (new Set(ids).size !== ids.length) errors.push(`Duplicate element IDs: ${file}`);
        for (const match of source.matchAll(/\b(?:href|src)="([^"]+)"/g)) localLink(match[1].replaceAll('&amp;', '&'), file);
        if (source.includes('id="post-detail"')) {
            for (const dependency of ['marked.umd.js', 'purify.min.js', 'script.js']) if (!source.includes(dependency)) errors.push(`Missing renderer ${dependency}: ${file}`);
        }
    } else if (extension === '.md' && file.includes(`${path.sep}content${path.sep}`)) {
        marked.walkTokens(marked.lexer(fs.readFileSync(file, 'utf8')), token => {
            if (token.type === 'image' || token.type === 'link') localLink(token.href, file, true);
        });
    }
}
for (const section of ['work', 'research', 'blog']) {
    for (const post of JSON.parse(fs.readFileSync(path.join(output, `content/${section}/posts.json`)))) {
        localLink(post.image, path.join(output, 'index.html'));
        localLink(post.path, path.join(output, 'index.html'));
    }
}
for (const excluded of ['src', 'public', '.git', '.github', '.env', 'private', 'originals', 'package.json', 'content-helper.js', 'templates', 'assets/background_img_2.png']) {
    if (fs.existsSync(path.join(output, excluded))) errors.push(`Source or original included in publish artifact: ${excluded}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Checked ${checkedPages} HTML routes and ${checkedLinks} local references. Publish artifact contains only approved public files.`);
