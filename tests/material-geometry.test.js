'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFibers } = require('../material-geometry');

test('seeds define reproducible, different fiber structures in three dimensions', () => {
    const first = createFibers(42, true);
    const repeated = createFibers(42, true);
    const different = createFibers(43, true);
    assert.deepEqual(first.vertices, repeated.vertices);
    assert.notDeepEqual(first.pores, different.pores);
    assert.notDeepEqual(first.vertices.subarray(0, 80), different.vertices.subarray(0, 80));
    assert(first.segments > 8000);
    assert.equal(first.vertices.length, first.segments * 16);
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < first.vertices.length; i += 8) {
        for (let j = 0; j < 8; j++) assert(Number.isFinite(first.vertices[i + j]));
        minZ = Math.min(minZ, first.vertices[i + 2]);
        maxZ = Math.max(maxZ, first.vertices[i + 2]);
        assert(Math.abs(Math.hypot(...first.vertices.subarray(i + 3, i + 6)) - 1) < 1e-5);
    }
    assert(maxZ - minZ > 1, 'Fibers must occupy a volume, not a flat image plane');
});

test('mobile geometry has a bounded, smaller vertex budget', () => {
    const desktop = createFibers(12345);
    const mobile = createFibers(12345, true);
    assert(desktop.vertices.length / 8 <= 1180 * 53 * 2);
    assert(mobile.vertices.length / 8 <= 490 * 37 * 2);
    assert(mobile.vertices.length < desktop.vertices.length * .5);
});
