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

        void wave(inout vec2 slope, vec2 p, vec2 direction, float steepness, float wavelength, float phase) {
            vec2 d = normalize(direction);
            float k = 6.2831853 / wavelength;
            // Deep-water dispersion couples each wavelength and angular frequency.
            // A shared time scale keeps relative wave speeds intact.
            float omega = sqrt(9.81 * k);
            float angle = dot(p, d) * k - omega * u_time * .28 + phase;
            slope += steepness * cos(angle) * d;
        }
        void main() {
            vec2 uv = v_uv;
            float aspect = u_resolution.x / max(u_resolution.y, 1.0);
            // Keep several swells visible even on portrait screens, with denser waves toward the top.
            vec2 p = vec2((uv.x - .5) * max(aspect, .85) * 12.0, uv.y * 12.0 + uv.y * uv.y * 10.0);
            // A gentle, broad bend rounds the crossing wave fronts without folding the surface.
            vec2 warpPhase = vec2(p.y * .35 + u_seed * .7, p.x * .28 + u_seed * 1.3);
            p += vec2(.65, .45) * sin(warpPhase);
            vec2 slope = vec2(0.0);
            // Unequal wavelengths, directions and phases prevent a single sliding pattern.
            // Steepness is A*k, so the smallest waves contribute only fine normal detail.
            wave(slope, p, vec2(.94, .34), .15, 7.3, u_seed);
            wave(slope, p, vec2(-.55, .84), .12, 5.1, u_seed * 1.37 + 1.2);
            wave(slope, p, vec2(.08, -1.0), .10, 8.9, u_seed * .73 + 2.4);
            wave(slope, p, vec2(-.96, -.29), .08, 4.3, u_seed * 1.91 + .8);
            wave(slope, p, vec2(.7, .71), .055, 2.85, u_seed * .41 + 3.1);
            wave(slope, p, vec2(-.81, .58), .030, 1.91, u_seed * 2.17 + 4.3);
            wave(slope, p, vec2(.34, -.94), .014, 1.27, u_seed * 1.13 + 2.7);
            wave(slope, p, vec2(-.2, -.98), .007, .86, u_seed * .59 + 5.2);
            wave(slope, p, vec2(.9, -.44), .003, .58, u_seed * 1.61 + 1.7);
            wave(slope, p, vec2(-.93, .37), .0015, .39, u_seed * 2.53 + 3.8);
            // Chain-rule derivatives keep the reflected light aligned with the bent surface.
            slope = vec2(slope.x + .126 * cos(warpPhase.y) * slope.y,
                         slope.y + .2275 * cos(warpPhase.x) * slope.x);

            vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
            vec3 view = normalize(vec3((.5 - uv.x) * .12, .82, .44 + .35 * uv.y));
            vec3 sun = normalize(vec3(.2, .92, -.18));
            vec3 halfway = normalize(view + sun);
            float alignment = max(dot(normal, halfway), 0.0);
            float fresnel = .02037 + .97963 * pow(1.0 - max(dot(normal, view), 0.0), 5.0);
            // Exposure is an artistic choice for a translucent portfolio overlay.
            float reflectionWeight = clamp(fresnel * 35.0, .6, 1.0);
            float reflectionPath = exp(-pow((uv.x - .67) / (.25 + .28 * (1.0 - uv.y)), 2.0));
            float sheen = pow(alignment, 18.0) * .11 * reflectionWeight;
            float glint = pow(alignment, 24.0) * .80 * reflectionPath * reflectionWeight;
            float trough = smoothstep(.02, .28, slope.y) * .55;
            float mask = smoothstep(.02, .28, uv.y) * (1.0 - smoothstep(.94, 1.0, uv.y));
            mask *= mix(.18, 1.0, smoothstep(.18, .8, uv.x));
            // Premultiplied light over the existing CSS colour field, with no image sampling.
            vec3 light = vec3(.006, .018, .028) * trough
                       + vec3(.60, .78, .76) * sheen
                       + vec3(.85, .87, .74) * glint;
            float alpha = (trough + sheen + glint) * mask;
            // Keep stronger reflections translucent and preserve premultiplied colour.
            float limit = min(1.0, .82 / max(alpha, .0001));
            gl_FragColor = vec4(light * mask * limit, alpha * limit);
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
