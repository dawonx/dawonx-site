((root, factory) => {
    'use strict';
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.WaterSurface = factory();
})(globalThis, () => {
    'use strict';

    const vertexSource = `
        attribute vec2 a_position;
        varying mediump vec2 v_uv;
        void main() {
            v_uv = a_position * .5 + .5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;
    const fragmentSource = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        varying mediump vec2 v_uv;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_seed;

        void wave(inout vec2 slope, vec2 p, vec2 direction, float amplitude, float frequency, float speed, float phase) {
            vec2 d = normalize(direction);
            float angle = dot(p, d) * frequency - u_time * speed + phase;
            slope += amplitude * frequency * cos(angle) * d;
        }
        void main() {
            vec2 uv = v_uv;
            float aspect = u_resolution.x / max(u_resolution.y, 1.0);
            // Compress distant ripples vertically and stretch the reflected glints along their crests.
            vec2 p = vec2((uv.x - .5) * aspect * 5.5, uv.y * 10.0 + uv.y * uv.y * 6.0);
            vec2 slope = vec2(0.0);
            wave(slope, p, vec2(.35, 1.0), .16, 1.25, .82, u_seed);
            wave(slope, p, vec2(-.55, 1.0), .10, 1.9, -1.1, u_seed * .71);
            wave(slope, p, vec2(.75, .65), .045, 3.6, .74, 1.3);
            wave(slope, p, vec2(-.22, 1.0), .014, 8.6, -1.35, 2.7);
            wave(slope, p, vec2(.12, 1.0), .006, 15.6, 1.73, u_seed * .37);
            wave(slope, p, vec2(-.08, 1.0), .002, 25.0, -1.9, 4.1);

            vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
            vec3 halfway = normalize(vec3(.07, 1.0, .24));
            float alignment = max(dot(normal, halfway), 0.0);
            float reflectionPath = exp(-pow((uv.x - .73) / (.13 + .22 * (1.0 - uv.y)), 2.0));
            float sheen = pow(alignment, 18.0) * .09;
            float glint = pow(alignment, 110.0) * .62 * reflectionPath;
            float trough = smoothstep(.08, .48, -slope.y) * .075;
            float mask = smoothstep(.02, .28, uv.y) * (1.0 - smoothstep(.94, 1.0, uv.y));
            mask *= mix(.18, 1.0, smoothstep(.18, .8, uv.x));
            // Premultiplied light over the existing CSS colour field, with no image sampling.
            vec3 light = vec3(.035, .09, .115) * trough
                       + vec3(.68, .88, .86) * sheen
                       + vec3(.96, .98, .83) * glint;
            gl_FragColor = vec4(light * mask, (trough + sheen + glint) * mask);
        }
    `;

    const create = (canvas, hero) => {
        const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
        if (!gl) return null;
        let program, buffer, uniforms;
        let frameID = 0, previousTime = null, time = 0;
        let requested = false, lost = false, failed = false, needsResize = true;
        const seed = Math.random() * 6.283185;

        const stop = () => {
            if (frameID) cancelAnimationFrame(frameID);
            frameID = 0;
            previousTime = null;
        };
        const hide = () => { stop(); delete canvas.dataset.waterReady; };
        const dispose = () => {
            if (buffer) gl.deleteBuffer(buffer);
            if (program) gl.deleteProgram(program);
            buffer = program = null;
        };
        const prepare = () => {
            const shaders = [];
            try {
                program = gl.createProgram();
                if (!program) throw new Error('Water program unavailable');
                for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
                    const shader = gl.createShader(type);
                    if (!shader) throw new Error('Water shader unavailable');
                    shaders.push(shader);
                    gl.shaderSource(shader, source);
                    gl.compileShader(shader);
                    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Water shader compilation failed');
                    gl.attachShader(program, shader);
                }
                gl.bindAttribLocation(program, 0, 'a_position');
                gl.linkProgram(program);
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Water shader link failed');
                gl.useProgram(program);
                buffer = gl.createBuffer();
                if (!buffer) throw new Error('Water buffer unavailable');
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                gl.disable(gl.BLEND);
                gl.disable(gl.DEPTH_TEST);
                gl.clearColor(0, 0, 0, 0);
                uniforms = Object.fromEntries(['resolution', 'time', 'seed'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
                gl.uniform1f(uniforms.seed, seed);
                if (gl.getError() !== gl.NO_ERROR) throw new Error('Water resources unavailable');
                needsResize = true;
            } catch (error) {
                dispose();
                throw error;
            } finally {
                shaders.forEach(shader => gl.deleteShader(shader));
            }
        };
        const draw = () => {
            if (needsResize) {
                const width = Math.max(1, hero.clientWidth), height = Math.max(1, hero.clientHeight);
                const limit = window.innerWidth <= 720 ? 240000 : 520000;
                const ratio = Math.min(1, Math.sqrt(limit / (width * height)), 1280 / Math.max(width, height));
                canvas.width = Math.max(1, Math.floor(width * ratio));
                canvas.height = Math.max(1, Math.floor(height * ratio));
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
                needsResize = false;
            }
            gl.uniform1f(uniforms.time, time);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            canvas.dataset.waterReady = '';
        };
        const frame = timestamp => {
            frameID = 0;
            if (!requested || lost || failed) return;
            try {
                if (previousTime === null || timestamp - previousTime >= 1000 / 30) {
                    if (previousTime !== null) time += Math.min((timestamp - previousTime) / 1000, .1);
                    previousTime = timestamp;
                    draw();
                }
                frameID = requestAnimationFrame(frame);
            } catch (_) { failed = true; hide(); }
        };
        const sync = () => {
            if (!requested || lost || failed) { stop(); return; }
            if (!frameID) frameID = requestAnimationFrame(frame);
        };

        try { prepare(); } catch (_) { return null; }
        canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; hide(); });
        canvas.addEventListener('webglcontextrestored', () => {
            dispose();
            lost = false;
            try { prepare(); failed = false; sync(); } catch (_) { failed = true; hide(); }
        });
        const resize = () => { needsResize = true; };
        if ('ResizeObserver' in window) new window.ResizeObserver(resize).observe(hero);
        else window.addEventListener('resize', resize);
        return { setRunning(value) { requested = value; sync(); } };
    };
    return { create, vertexSource, fragmentSource };
});
