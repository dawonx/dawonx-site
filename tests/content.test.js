'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { ContentHelper } = require('../content-helper');
function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dawonx-content-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.mkdirSync(path.join(directory, 'assets/optimized'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'assets/optimized/computational-study.webp'), 'fixture');
    return { directory, helper: new ContentHelper(directory) };
}
test('a Korean title creates a visible categorized public article without a framework', async t => {
    const { directory, helper } = fixture(t);
    const item = await helper.addContent('research', '재료 실험', 'Public study');
    assert.equal(item.path, 'research/재료-실험/');
    assert.equal(item.category, 'sustainability');
    assert.deepEqual(item.languages, ['en']);
    assert.equal(item.visibility, 'public');
    const html = fs.readFileSync(path.join(directory, item.path, 'index.html'), 'utf8');
    assert.match(html, /purify\.min\.js/);
    assert.match(html, /site-header:start/);
    assert.equal(helper.inspectPosts('research', [item]).length, 0);
});
test('an orphan original is never overwritten by the add command', async t => {
    const { directory, helper } = fixture(t);
    helper.ensureDirectories();
    const file = path.join(directory, 'content/work/example.md');
    fs.writeFileSync(file, 'Original content');
    await assert.rejects(helper.addContent('work', 'Example', 'Description'), /not be overwritten/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'Original content');
    assert(!fs.existsSync(path.join(directory, 'content/work/posts.json')));
});
test('invalid categories are caught before content disappears from listings', async t => {
    const { helper } = fixture(t);
    await assert.rejects(helper.addContent('work', 'Example', 'Description', '#B8E986', 'missing'), /Category/);
});
test('traversal and escaped symlinks cannot write outside the content root', t => {
    const { directory, helper } = fixture(t);
    assert.throws(() => helper.resolveLocal('../outside'), /traversing/);
    assert.throws(() => helper.resolveLocal('%2e%2e/outside'), /Encoded/);
    fs.symlinkSync(os.tmpdir(), path.join(directory, 'escape'));
    assert.throws(() => helper.resolveLocal('escape/example.md'), /Symlink/);
});
test('titles and descriptions cannot inject markup into article shells', t => {
    const { helper } = fixture(t);
    const html = helper.generateDetailPageHTML('blog', 'example', '<script>alert(1)</script>', '" onload="bad');
    assert(!html.includes('<script>alert(1)</script>'));
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&quot; onload=&quot;bad/);
});
test('a private label cannot be mistaken for access control in a public site', t => {
    const { helper } = fixture(t);
    const errors = helper.inspectPosts('blog', [{ title:'Example', description:'Public', image:'assets/optimized/computational-study.webp', path:'blog/example/', category:'computational', color:'#B8E986', visibility:'private' }], false);
    assert(errors.some(error => error.includes('Only public content')));
});
test('published articles retain readable HTML and strip executable markup', () => {
    const { articleHTML } = require('../scripts/build-site');
    const html = articleHTML('# A public study\n\nA **measured** result.\n\n<script>alert(1)</script><img src="assets/optimized/material-study.webp" onerror="alert(1)">\n\n[Unsafe](javascript:alert(1))', 'research');
    assert.match(html, /<h1>A public study<\/h1>/);
    assert.match(html, /<strong>measured<\/strong>/);
    assert.match(html, /src="\.\.\/\.\.\/assets\/optimized\/material-study.webp"/);
    assert(!html.includes('<script'));
    assert(!html.includes('onerror'));
    assert(!html.includes('javascript:'));
});
test('published article links survive the move from Markdown URLs to page URLs', () => {
    const { articleHTML } = require('../scripts/build-site');
    const html = articleHTML('[Next](next.md)\n\n![Figure](/assets/optimized/material-study.webp)', 'blog');
    assert.match(html, /href="\.\.\/\.\.\/blog\/next\/"/);
    assert.match(html, /loading="lazy"/);
});
