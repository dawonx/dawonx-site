'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { versionURL, versionHTML } = require('../scripts/build-site');

test('release navigation preserves subpaths, filters and section anchors', () => {
    assert.equal(versionURL('../../work.html?category=material&v=old#projects', 'new'), '../../work.html?category=material&v=new#projects');
    assert.equal(versionURL('../study/?filter=one#results', 'new'), '../study/?filter=one&v=new#results');
    for (const value of ['#main-content', 'https://example.com/work.html', '//example.com/script.js', 'mailto:hello@example.com', 'assets/figure.webp', 'content/study.md']) {
        assert.equal(versionURL(value, 'new'), value);
    }
});

test('redirects and runtime assets use the same release as page links', () => {
    const html = '<meta http-equiv="refresh" content="0;url=../work.html?filter=one&amp;v=old#projects"><a href="../work.html?filter=one&amp;v=old#projects">Work</a><link rel="stylesheet" href="../portfolio.css"><script src="../script.js"></script><a href="#main-content">Skip</a>';
    const versioned = versionHTML(html, 'new');
    assert(versioned.includes('content="0;url=../work.html?filter=one&amp;v=new#projects"'));
    assert(versioned.includes('href="../work.html?filter=one&amp;v=new#projects"'));
    assert(versioned.includes('href="../portfolio.css?v=new"'));
    assert(versioned.includes('src="../script.js?v=new"'));
    assert(versioned.includes('href="#main-content"'));
    assert.equal(versionHTML(versioned, 'new'), versioned);
});

test('HTML character references survive URL updates without corrupting fragments', () => {
    const html = '<a href="work.html?q=O&#39;Brien#results">Work</a><a href="https://example.com/?q=&quot;grid&quot;">External</a>';
    const result = versionHTML(html, 'new');
    assert(result.includes('href="work.html?q=O%27Brien&amp;v=new#results"'));
    assert(result.includes('href="https://example.com/?q=&quot;grid&quot;"'));
});
