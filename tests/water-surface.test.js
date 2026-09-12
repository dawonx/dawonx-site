'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../water-surface.js'), 'utf8');

function fixture(options = {}) {
    const records = { frames: new Map(), draws: [], programs: 0, deletedPrograms: 0, uniforms: {} };
    const gl = { NO_ERROR: 0 };
    for (const name of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'ARRAY_BUFFER', 'STATIC_DRAW', 'FLOAT', 'BLEND', 'DEPTH_TEST', 'COLOR_BUFFER_BIT', 'TRIANGLE_STRIP']) gl[name] = name;
    for (const name of ['deleteBuffer', 'deleteShader', 'shaderSource', 'compileShader', 'attachShader', 'bindAttribLocation', 'linkProgram', 'useProgram', 'bindBuffer', 'bufferData', 'enableVertexAttribArray', 'vertexAttribPointer', 'disable', 'clearColor', 'clear', 'viewport']) gl[name] = () => {};
    gl.createProgram = () => { records.programs++; return {}; };
    gl.deleteProgram = () => { records.deletedPrograms++; };
    gl.createShader = gl.createBuffer = () => ({});
    gl.getShaderParameter = () => !options.shaderFailure;
    gl.getProgramParameter = () => !options.linkFailure;
    gl.getError = () => 0;
    gl.getUniformLocation = (_, name) => name;
    gl.uniform1f = (name, value) => { records.uniforms[name] = value; };
    gl.uniform2f = (name, x, y) => { records.uniforms[name] = [x, y]; };
    gl.drawArrays = (type, start, count) => { assert.equal(type, gl.TRIANGLE_STRIP); assert.equal(count, 4); records.draws.push(records.uniforms.u_time); };
    gl.createTexture = gl.texImage2D = () => { throw new Error('Water must not use images'); };
    const listeners = {};
    const canvas = { dataset: {}, getContext: () => options.unsupported ? null : gl,
        addEventListener: (name, callback) => { listeners[name] = callback; },
        emit: (name, event = {}) => listeners[name]?.(event) };
    const hero = { clientWidth: options.width || 1440, clientHeight: options.height || 900 };
    let frameID = 0, resized;
    const window = { innerWidth: hero.clientWidth, ResizeObserver: class { constructor(callback) { resized = callback; } observe() {} } };
    const context = { window, Float32Array,
        requestAnimationFrame: callback => { const id = ++frameID; records.frames.set(id, callback); return id; },
        cancelAnimationFrame: id => records.frames.delete(id) };
    vm.runInNewContext(source, context);
    const water = context.WaterSurface.create(canvas, hero);
    const step = timestamp => {
        const callbacks = [...records.frames.values()]; records.frames.clear();
        callbacks.forEach(callback => callback(timestamp));
        assert(records.frames.size <= 1, 'At most one animation loop');
    };
    return { water, canvas, hero, records, step, resize: () => resized() };
}

test('unavailable graphics and shader errors fail safely without starting a loop', () => {
    for (const options of [{ unsupported: true }, { shaderFailure: true }, { linkFailure: true }]) {
        const f = fixture(options);
        assert.equal(f.water, null);
        assert.equal(f.records.frames.size, 0);
        assert(!Object.hasOwn(f.canvas.dataset, 'waterReady'));
        assert.equal(f.records.programs, f.records.deletedPrograms);
    }
});

test('water renders without images and limits frame rate and desktop/mobile resolution', () => {
    for (const options of [{ width: 3840, height: 2160, cap: 520000 }, { width: 390, height: 740, cap: 240000 }]) {
        const f = fixture(options);
        f.water.setRunning(true);
        [0, 10, 20, 34, 44, 54, 68].forEach(f.step);
        assert.equal(f.records.draws.length, 3);
        assert(f.canvas.width * f.canvas.height <= options.cap);
        assert(Math.max(f.canvas.width, f.canvas.height) <= 1280);
        assert(Object.hasOwn(f.canvas.dataset, 'waterReady'));
    }
});

test('suspension cancels frames and resumes at the held time after resize', () => {
    const f = fixture();
    f.water.setRunning(true); f.water.setRunning(true);
    f.step(0); f.step(34);
    const held = f.records.draws.at(-1);
    f.water.setRunning(false);
    f.hero.clientWidth = 600; f.resize();
    assert.equal(f.records.frames.size, 0);
    f.water.setRunning(true); f.step(10000);
    assert.equal(f.records.draws.at(-1), held);
    assert.equal(f.records.uniforms.u_resolution[0], f.canvas.width);
    f.step(10034); assert(f.records.draws.at(-1) > held);
});

test('context loss hides water and restoration respects suspended state', () => {
    const f = fixture();
    f.water.setRunning(true); f.step(0); f.step(34);
    const held = f.records.draws.at(-1);
    let prevented = false;
    f.canvas.emit('webglcontextlost', { preventDefault() { prevented = true; } });
    assert(prevented);
    assert.equal(f.records.frames.size, 0);
    assert(!Object.hasOwn(f.canvas.dataset, 'waterReady'));
    f.water.setRunning(false);
    f.canvas.emit('webglcontextrestored');
    assert.equal(f.records.programs, 2);
    assert.equal(f.records.frames.size, 0);
    f.water.setRunning(true); f.step(20000);
    assert.equal(f.records.draws.at(-1), held);
    assert(Object.hasOwn(f.canvas.dataset, 'waterReady'));
});
