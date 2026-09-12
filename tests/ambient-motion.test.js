'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../ambient-motion.js'), 'utf8');

function fixture(options = {}) {
    const target = values => Object.assign({ listeners: {}, addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }, emit(name) { for (const callback of this.listeners[name] || []) callback(); } }, values);
    let top = options.offscreen ? -1000 : 80;
    let intersect;
    const layers = Array.from({ length: 3 }, () => ({ style: { setProperty() {} } }));
    const hero = { dataset: {}, querySelectorAll: () => layers, getBoundingClientRect: () => ({ top, bottom: top + 900 }) };
    const document = target({ hidden: Boolean(options.hidden), readyState: 'complete', getElementById: id => id === 'ambient-hero' ? hero : null });
    const reduced = target({ matches: Boolean(options.reduced) });
    const connection = options.bareConnection ? {} : target({ saveData: Boolean(options.saveData) });
    const window = target({ innerHeight: 1000, matchMedia: () => reduced });
    if (!options.noObserver) window.IntersectionObserver = class { constructor(callback) { intersect = callback; } observe() {} };
    vm.runInNewContext(source, { window, document, navigator: options.noConnection ? {} : { connection } });
    return { hero, document, window, reduced, connection,
        running: () => Object.hasOwn(hero.dataset, 'ambientRunning'),
        setTop: value => { top = value; }, intersection: value => intersect([{ isIntersecting: value }]) };
}

test('motion starts only for a visible hero without motion or data restrictions', () => {
    assert(fixture().running());
    for (const options of [{ hidden: true }, { offscreen: true }, { reduced: true }, { saveData: true }]) {
        assert.equal(fixture(options).running(), false);
    }
});

test('visibility and intersection events do not override another pause condition', () => {
    const f = fixture();
    f.intersection(false); assert.equal(f.running(), false);
    f.document.hidden = true;
    f.intersection(true); assert.equal(f.running(), false);
    f.document.hidden = false; f.document.emit('visibilitychange'); assert(f.running());
    f.reduced.matches = true; f.reduced.emit('change'); assert.equal(f.running(), false);
    f.intersection(true); assert.equal(f.running(), false);
    f.reduced.matches = false; f.reduced.emit('change'); assert(f.running());
    f.connection.saveData = true; f.connection.emit('change'); assert.equal(f.running(), false);
    f.document.emit('visibilitychange'); assert.equal(f.running(), false);
    f.connection.saveData = false; f.connection.emit('change'); assert(f.running());
});

test('back navigation remeasures restored scroll position before resuming', () => {
    const f = fixture();
    f.window.emit('pagehide'); assert.equal(f.running(), false);
    f.intersection(true); assert.equal(f.running(), false);
    f.setTop(-1000); f.window.emit('pageshow'); assert.equal(f.running(), false);
    f.setTop(80); f.window.emit('pageshow'); assert(f.running());
    f.reduced.matches = true; f.window.emit('pageshow'); assert.equal(f.running(), false);
});

test('scroll and resize suspend an offscreen hero without IntersectionObserver', () => {
    const f = fixture({ noObserver: true });
    f.setTop(-1000); f.window.emit('scroll'); assert.equal(f.running(), false);
    f.setTop(1500); f.window.emit('resize'); assert.equal(f.running(), false);
    f.setTop(80); f.window.emit('scroll'); assert(f.running());
});

test('missing or partial connection APIs do not block the landing', () => {
    assert(fixture({ noConnection: true }).running());
    assert(fixture({ bareConnection: true }).running());
});

test('the landing omits motion controls and the former image and WebGL dependencies', () => {
    const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
    assert.doesNotMatch(html, /motion-toggle|Pause motion|Resume motion|material-(?:geometry|motion|canvas|membrane)/);
    assert.match(html, /class="ambient-field" aria-hidden="true"/);
    assert.match(html, /src="ambient-motion\.js" defer/);
});
