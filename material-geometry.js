((root, factory) => {
    'use strict';
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MaterialGeometry = factory();
})(globalThis, () => {
    'use strict';
    const TAU = Math.PI * 2;
    const randomFrom = seed => {
        let state = seed >>> 0;
        return () => {
            state += 0x6D2B79F5;
            let value = Math.imul(state ^ state >>> 15, 1 | state);
            value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
            return ((value ^ value >>> 14) >>> 0) / 4294967296;
        };
    };
    const createFibers = (seed, compact = false) => {
        const random = randomFrom(seed);
        const phase = random() * TAU;
        const pores = [[-.77,.64,.29], [.07,.35,.38], [.88,.74,.29], [-.39,-.49,.32], [.66,-.58,.38], [1.24,-.03,.2], [-1.16,-.12,.23]]
            .map(([u, v, r]) => [u + (random() - .5) * .12, v + (random() - .5) * .12, r * (.92 + random() * .16)]);
        const inside = (u, v, guard = 1) => {
            if ((u / 1.65) ** 4 + (v / 1.49) ** 4 > 1) return false;
            return pores.every(([x, y, r]) => (u - x) ** 2 + (v - y) ** 2 > (r * guard) ** 2);
        };
        const flow = (u, v, angle) => {
            const turn = angle + .13 * Math.sin(2.7 * v + phase) + .09 * Math.sin(3.2 * u - 1.6 * v);
            const dx = Math.cos(turn), dy = Math.sin(turn);
            let fx = dx, fy = dy;
            // Potential-flow directions curve around the empty pores.
            for (const [x, y, r] of pores) {
                const qx = u - x, qy = v - y;
                const d2 = Math.max(qx * qx + qy * qy, r * r * .8);
                const projection = (dx * qx + dy * qy) / d2;
                const strength = r * r / d2;
                fx += strength * (dx - 2 * projection * qx);
                fy += strength * (dy - 2 * projection * qy);
            }
            // Other pores may pull a streamline inward; keep it tangent at a rim.
            for (const [x, y, r] of pores) {
                const qx = u - x, qy = v - y, d = Math.hypot(qx, qy);
                if (d < r * 1.16) {
                    const inward = (fx * qx + fy * qy) / d;
                    if (inward < 0) { fx -= inward * qx / d; fy -= inward * qy / d; }
                    const lift = Math.max(0, r * 1.025 - d) * 12;
                    fx += lift * qx / d; fy += lift * qy / d;
                }
            }
            const length = Math.hypot(fx, fy) || 1;
            return [fx / length, fy / length];
        };
        const map = (u, v, offset) => {
            const x = 1.18 * u + .25 * Math.sin(1.8 * v + .4);
            const y = 1.39 * v + .13 * Math.sin(2.1 * u);
            let z = .5 * Math.sin(2.8 * u + .6 * v + phase * .15) + .28 * Math.sin(3.5 * v - .8 * u) + .2 * u * u;
            for (const [cx, cy, r] of pores) {
                const d = Math.hypot(u - cx, v - cy);
                z += .15 * Math.exp(-Math.max(0, d - r) * 9) * Math.sin(Math.atan2(v - cy, u - cx) * 2 + phase);
            }
            return [x, y, z + offset];
        };
        const values = [];
        const curves = compact ? 490 : 1180;
        const steps = compact ? 37 : 53;
        const stepSize = compact ? .049 : .039;
        let segments = 0;
        for (let fiber = 0; fiber < curves; fiber++) {
            let u, v;
            let valid = false;
            for (let attempt = 0; attempt < 30; attempt++) {
                if (random() < .38) {
                    const pore = pores[Math.floor(random() * pores.length)];
                    const theta = random() * TAU, radius = pore[2] * (1.04 + random() * .36);
                    u = pore[0] + Math.cos(theta) * radius;
                    v = pore[1] + Math.sin(theta) * radius;
                } else { u = (random() - .5) * 3.2; v = (random() - .5) * 2.85; }
                if (inside(u, v, 1.025)) { valid = true; break; }
            }
            if (!valid) continue;
            const angle = (random() < .8 ? .12 : 1.55) + (random() - .5) * .55 + (random() < .5 ? Math.PI : 0);
            const offset = (random() - .5) * .043;
            const brightness = .45 + random() * .55;
            const tint = random() < .08 ? .5 + random() * .5 : random() * .09;
            let current = map(u, v, offset);
            for (let step = 0; step < steps; step++) {
                const first = flow(u, v, angle);
                const next = flow(u + first[0] * stepSize * .5, v + first[1] * stepSize * .5, angle);
                const nu = u + next[0] * stepSize, nv = v + next[1] * stepSize;
                if (!inside(nu, nv, 1.008) || !inside((u + nu) * .5, (v + nv) * .5, 1.008)) break;
                const point = map(nu, nv, offset);
                const tangent = point.map((value, i) => value - current[i]);
                const length = Math.hypot(...tangent) || 1;
                const t = tangent.map(value => value / length);
                // Position, direction and optical variation; no UVs or image data.
                for (const p of [current, point]) values.push(...p, ...t, brightness, tint);
                segments++;
                u = nu; v = nv; current = point;
            }
        }
        return { vertices: new Float32Array(values), segments, pores, seed, compact };
    };
    const vertexSource = `
        attribute vec3 a_position;
        attribute vec3 a_tangent;
        attribute vec2 a_material;
        uniform float u_time;
        uniform float u_seed;
        uniform float u_aspect;
        varying mediump vec4 v_color;
        vec3 deform(vec3 p) {
            float t = u_time;
            p.x += .11 * sin(p.y * 1.6 + p.z * .8 + t * .37 + u_seed);
            p.y += .085 * sin(p.x * 2.1 - p.z * 1.2 - t * .29 + u_seed * .71);
            p.z += .19 * sin(p.x * 1.5 + p.y * 1.4 + t * .31 + u_seed)
                 + .075 * sin(p.y * 3.2 - p.x * 2.2 - t * .23);
            float yaw = -.28 + .11 * sin(t * .11 + u_seed * .2);
            float tilt = -.11 + .07 * sin(t * .13);
            p.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * p.xz;
            p.xy = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * p.xy;
            return p;
        }
        void main() {
            vec3 p = deform(a_position);
            vec3 tangent = normalize(deform(a_position + a_tangent * .025) - p);
            vec3 light = normalize(vec3(-.6, .8, 1.0));
            float fiberLight = sqrt(max(0.0, 1.0 - pow(dot(tangent, light), 2.0)));
            float depthLight = smoothstep(-1.25, 1.3, p.z);
            float alpha = (.065 + .27 * fiberLight * fiberLight) * a_material.x * (.28 + .72 * depthLight);
            vec3 silver = mix(vec3(.69, .73, .72), vec3(.95, .98, .94), fiberLight * depthLight);
            vec3 color = mix(silver, vec3(.69, .82, .5), a_material.y * .62);
            v_color = vec4(color, alpha);
            float landscape = smoothstep(.85, 1.4, u_aspect);
            p.x += mix(.25, 1.62, landscape);
            p.y += mix(.72, .08, landscape);
            float focal = mix(2.3, 3.4, landscape);
            float depth = 5.2 - p.z;
            gl_Position = vec4(p.x * focal / max(u_aspect, .45), p.y * focal, depth - 1.0, depth);
        }
    `;
    const fragmentSource = `
        precision mediump float;
        varying mediump vec4 v_color;
        void main() { gl_FragColor = v_color; }
    `;
    return { createFibers, vertexSource, fragmentSource };
});
