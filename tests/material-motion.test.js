'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../material-motion.js'), 'utf8');

function fixture(options = {}) {
    const target = values => Object.assign({ listeners: {}, addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }, emit(name, event = {}) { for (const callback of this.listeners[name] || []) callback(event); } }, values);
    const hero = target({ clientWidth: options.width || 1440, clientHeight: options.height || 900, dataset: {}, getBoundingClientRect: () => ({ top: 88, bottom: 988 }) });
    const image = target({ complete: !options.loading, naturalWidth: 1586, naturalHeight: 992 });
    const button = target({ hidden: true, textContent: 'Pause motion' });
    const records = { contexts: 0, draws: [], uploads: 0, uniforms: {}, pending: new Map() };
    const gl = {};
    for (const name of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'LINK_STATUS', 'ARRAY_BUFFER', 'ELEMENT_ARRAY_BUFFER', 'STATIC_DRAW', 'FLOAT', 'TEXTURE0', 'TEXTURE_2D', 'UNPACK_FLIP_Y_WEBGL', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'CLAMP_TO_EDGE', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'LINEAR', 'RGBA', 'UNSIGNED_BYTE', 'TRIANGLES', 'UNSIGNED_SHORT']) gl[name] = name;
    gl.NO_ERROR = 0;
    for (const name of ['deleteShader', 'deleteBuffer', 'deleteTexture', 'deleteProgram', 'shaderSource', 'compileShader', 'attachShader', 'bindAttribLocation', 'linkProgram', 'useProgram', 'bindBuffer', 'bufferData', 'enableVertexAttribArray', 'vertexAttribPointer', 'activeTexture', 'bindTexture', 'pixelStorei', 'texParameteri', 'viewport']) gl[name] = () => {};
    for (const name of ['createProgram', 'createShader', 'createBuffer', 'createTexture']) gl[name] = () => ({});
    gl.getProgramParameter = () => !options.shaderFailure;
    gl.texImage2D = () => { records.uploads++; };
    gl.getError = () => options.textureFailure ? 1285 : 0;
    gl.getUniformLocation = (_, name) => name;
    gl.uniform1f = gl.uniform1i = (name, value) => { records.uniforms[name] = value; };
    gl.uniform2f = (name, x, y) => { records.uniforms[name] = [x, y]; };
    gl.drawElements = () => records.draws.push(records.uniforms.u_time);
    const canvas = target({ getContext() { records.contexts++; return options.unsupported ? null : gl; } });
    const elements = { 'material-hero': hero, 'material-image': image, 'material-canvas': canvas, 'motion-toggle': button };
    const document = target({ hidden: false, readyState: 'complete', getElementById: id => elements[id] });
    const reduced = target({ matches: Boolean(options.reduced) });
    const connection = target({ saveData: Boolean(options.saveData) });
    let intersection, resized, frameID = 0;
    class IntersectionObserver { constructor(callback) { intersection = callback; } observe() {} }
    class ResizeObserver { constructor(callback) { resized = callback; } observe() {} }
    const window = target({ innerHeight: 1000, devicePixelRatio: options.dpr || 2, matchMedia: () => reduced, IntersectionObserver, ResizeObserver });
    vm.runInNewContext(source, { window, document, navigator: { connection }, IntersectionObserver, ResizeObserver,
        getComputedStyle: () => ({ objectPosition: options.position || '64% 50%' }),
        requestAnimationFrame: callback => { const id = ++frameID; records.pending.set(id, callback); return id; },
        cancelAnimationFrame: id => records.pending.delete(id)
    });
    const step = time => {
        const callbacks = [...records.pending.values()];
        records.pending.clear();
        callbacks.forEach(callback => callback(time));
        assert(records.pending.size <= 1, 'Only one animation loop may be active');
    };
    return { hero, image, button, canvas, document, window, reduced, connection, records, step,
        intersection: value => intersection([{ isIntersecting: value }]), resize: () => resized() };
}

test('motion preferences and data saving leave the static hero without allocating WebGL', () => {
    for (const options of [{ reduced: true }, { saveData: true }]) {
        const f = fixture(options);
        assert.equal(f.records.contexts, 0);
        assert.equal(f.records.pending.size, 0);
        assert.equal(f.button.hidden, true);
        assert(!Object.hasOwn(f.hero.dataset, 'motionReady'));
    }
});

test('unsupported graphics, shader failure and texture failure preserve the image fallback', () => {
    for (const options of [{ unsupported: true }, { shaderFailure: true }, { textureFailure: true }]) {
        const f = fixture(options);
        assert.equal(f.records.pending.size, 0);
        assert.equal(f.button.hidden, true);
        assert(!Object.hasOwn(f.hero.dataset, 'motionReady'));
    }
});

test('a delayed image starts one renderer only after loading and first successful draw', () => {
    const f = fixture({ loading: true });
    assert.equal(f.records.contexts, 0);
    f.image.complete = true;
    f.image.emit('load');
    f.image.emit('load');
    assert.equal(f.records.contexts, 1);
    assert.equal(f.records.uploads, 1);
    assert(!Object.hasOwn(f.hero.dataset, 'motionReady'));
    f.step(0);
    assert(Object.hasOwn(f.hero.dataset, 'motionReady'));
});

test('pause, hidden tabs, offscreen sections and back navigation stop and resume without jumping', () => {
    const f = fixture();
    f.step(0); f.step(34);
    f.button.emit('click');
    const held = f.records.draws.at(-1);
    assert.equal(f.button.textContent, 'Resume motion');
    assert.equal(f.records.pending.size, 0);
    f.resize();
    assert.equal(f.records.draws.at(-1), held, 'Resizing a paused canvas redraws its held time');
    f.button.emit('click');
    f.step(10000);
    assert.equal(f.records.draws.at(-1), held);
    for (const [hide, show] of [
        [() => { f.document.hidden = true; f.document.emit('visibilitychange'); }, () => { f.document.hidden = false; f.document.emit('visibilitychange'); }],
        [() => f.intersection(false), () => f.intersection(true)],
        [() => f.window.emit('pagehide'), () => f.window.emit('pageshow')]
    ]) {
        hide(); assert.equal(f.records.pending.size, 0);
        show(); show(); assert.equal(f.records.pending.size, 1);
        f.step(20000); assert.equal(f.records.draws.at(-1), held);
    }
});

test('a live reduced-motion preference change returns to the static image', () => {
    const f = fixture();
    f.step(0);
    f.reduced.matches = true;
    f.reduced.emit('change');
    assert.equal(f.records.pending.size, 0);
    assert(!Object.hasOwn(f.hero.dataset, 'motionReady'));
    assert.equal(f.button.hidden, true);
    f.reduced.matches = false;
    f.reduced.emit('change');
    f.step(4000);
    assert.equal(f.records.contexts, 1);
    assert(Object.hasOwn(f.hero.dataset, 'motionReady'));
});

test('a paused canvas repaints after resizing in a hidden tab or outside the viewport', () => {
    const f = fixture();
    f.step(0); f.step(34);
    f.button.emit('click');
    const held = f.records.draws.at(-1);
    for (const [hide, show] of [
        [() => { f.document.hidden = true; f.document.emit('visibilitychange'); }, () => { f.document.hidden = false; f.document.emit('visibilitychange'); }],
        [() => f.intersection(false), () => f.intersection(true)]
    ]) {
        hide();
        const before = f.records.draws.length;
        f.resize();
        assert.equal(f.records.draws.length, before);
        show();
        assert.equal(f.records.draws.length, before + 1);
        assert.equal(f.records.draws.at(-1), held);
        assert.equal(f.records.pending.size, 0);
    }
});

test('context loss falls back and context restoration rebuilds resources', () => {
    const f = fixture();
    f.step(0);
    let prevented = false;
    f.canvas.emit('webglcontextlost', { preventDefault() { prevented = true; } });
    assert(prevented);
    assert.equal(f.records.pending.size, 0);
    assert.equal(f.button.hidden, true);
    assert(!Object.hasOwn(f.hero.dataset, 'motionReady'));
    f.canvas.emit('webglcontextrestored');
    assert.equal(f.records.contexts, 2);
    f.step(2000);
    assert(Object.hasOwn(f.hero.dataset, 'motionReady'));
});

test('render resolution and frame rate stay bounded on a large high-density display', () => {
    const f = fixture({ width: 3840, height: 2160, dpr: 3 });
    assert(f.canvas.width * f.canvas.height <= 1500000);
    assert(f.canvas.width <= 2048 && f.canvas.height <= 2048);
    [0, 8, 16, 24, 33, 41, 49, 57, 66].forEach(f.step);
    assert.equal(f.records.draws.length, 3);
});

test('canvas cover crop matches the static image on a narrow screen', () => {
    const f = fixture({ width: 390, height: 740, position: '60% 50%' });
    const expected = (390 / 740) / (1586 / 992);
    assert(Math.abs(f.records.uniforms.u_cover[0] - expected) < 1e-9);
    assert.equal(f.records.uniforms.u_cover[1], 1);
    assert(Math.abs(f.records.uniforms.u_center[0] - (expected * .5 + (1 - expected) * .6)) < 1e-9);
});
