(() => {
    'use strict';

    // Deform a small textured mesh, not individual fibers or full-screen noise.
    const vertexSource = `
        attribute vec2 a_position;
        uniform vec2 u_cover;
        uniform vec2 u_center;
        uniform float u_time;
        uniform float u_seed;
        uniform float u_aspect;
        varying mediump vec2 v_uv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
        }
        float field(vec2 p) { return .65 * noise(p) + .35 * noise(p * 2.13 + 7.2); }
        void main() {
            vec2 p = a_position;
            v_uv = (p - .5) * u_cover + u_center;
            vec2 domain = p * vec2(3.1, 2.4) + u_seed;
            vec2 drift = vec2(field(domain + vec2(u_time * .085, u_time * .035)),
                              field(domain + vec2(-u_time * .045, u_time * .065) + 19.3)) - .5;
            // Pin the outer edges, and smoothly introduce motion after first paint.
            float envelope = sin(p.x * 3.14159265) * sin(p.y * 3.14159265);
            float amplitude = .09 * envelope * smoothstep(0.0, 1.8, u_time);
            vec2 offset = drift * amplitude * vec2(1.0 / max(u_aspect, 1.0), 1.0);
            gl_Position = vec4((p + offset) * 2.0 - 1.0, 0.0, 1.0);
        }
    `;
    const fragmentSource = `
        precision mediump float;
        uniform sampler2D u_image;
        varying mediump vec2 v_uv;
        void main() { gl_FragColor = texture2D(u_image, v_uv); }
    `;

    const init = () => {
        const hero = document.getElementById('material-hero');
        const image = document.getElementById('material-image');
        const canvas = document.getElementById('material-canvas');
        const button = document.getElementById('motion-toggle');
        if (!hero || !image || !canvas || !button) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const connection = navigator.connection;
        const bounds = hero.getBoundingClientRect();
        let inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
        let pageHidden = false;
        let userPaused = false;
        let contextLost = false;
        let failed = false;
        let renderer = null;
        let frame = null;
        let previousTime = null;
        let time = 0;
        let needsDraw = false;
        const seed = Math.random() * 200;
        const limitedMotion = () => reducedMotion.matches || Boolean(connection?.saveData);
        const canRun = () => renderer && !failed && !contextLost && !userPaused && !limitedMotion() && inView && !document.hidden && !pageHidden;
        const stop = () => {
            if (frame !== null) cancelAnimationFrame(frame);
            frame = null;
            previousTime = null;
        };
        const fallback = () => {
            stop();
            delete hero.dataset.motionReady;
            button.hidden = true;
        };
        const fail = () => {
            failed = true;
            fallback();
            renderer?.dispose();
            renderer = null;
        };

        const createRenderer = () => {
            const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
            if (!gl) throw new Error('WebGL unavailable');
            const shaders = [];
            const buffers = [];
            let program;
            let texture;
            const dispose = () => {
                shaders.forEach(shader => gl.deleteShader(shader));
                buffers.forEach(buffer => gl.deleteBuffer(buffer));
                if (texture) gl.deleteTexture(texture);
                if (program) gl.deleteProgram(program);
            };
            try {
                program = gl.createProgram();
                for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
                    const shader = gl.createShader(type);
                    shaders.push(shader);
                    gl.shaderSource(shader, source);
                    gl.compileShader(shader);
                    gl.attachShader(program, shader);
                }
                gl.bindAttribLocation(program, 0, 'a_position');
                gl.linkProgram(program);
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Material shader unavailable');
                gl.useProgram(program);

                const columns = 48, rows = 32;
                const vertices = new Float32Array((columns + 1) * (rows + 1) * 2);
                const indices = new Uint16Array(columns * rows * 6);
                let v = 0, n = 0;
                for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
                    vertices[v++] = x / columns;
                    vertices[v++] = y / rows;
                }
                for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
                    const a = y * (columns + 1) + x, b = a + columns + 1;
                    indices.set([a, a + 1, b, b, a + 1, b + 1], n);
                    n += 6;
                }
                for (const [target, data] of [[gl.ARRAY_BUFFER, vertices], [gl.ELEMENT_ARRAY_BUFFER, indices]]) {
                    const buffer = gl.createBuffer();
                    buffers.push(buffer);
                    gl.bindBuffer(target, buffer);
                    gl.bufferData(target, data, gl.STATIC_DRAW);
                }
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                texture = gl.createTexture();
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                if (gl.getError() !== gl.NO_ERROR) throw new Error('Material texture unavailable');
                const uniforms = Object.fromEntries(['cover', 'center', 'time', 'seed', 'aspect', 'image'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
                gl.uniform1i(uniforms.image, 0);
                gl.uniform1f(uniforms.seed, seed);
                let width = 0, height = 0;
                const resize = () => {
                    width = hero.clientWidth;
                    height = hero.clientHeight;
                    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1500000 / Math.max(1, width * height)), 2048 / Math.max(1, width, height));
                    canvas.width = Math.max(1, Math.floor(width * ratio));
                    canvas.height = Math.max(1, Math.floor(height * ratio));
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    const aspect = width / Math.max(1, height);
                    const imageAspect = image.naturalWidth / image.naturalHeight;
                    const coverX = Math.min(1, aspect / imageAspect);
                    const coverY = Math.min(1, imageAspect / aspect);
                    const position = (parseFloat(getComputedStyle(image).objectPosition) || 50) / 100;
                    gl.uniform2f(uniforms.cover, coverX, coverY);
                    gl.uniform2f(uniforms.center, coverX * .5 + (1 - coverX) * position, .5);
                    gl.uniform1f(uniforms.aspect, aspect);
                };
                const draw = () => {
                    if (!width || !height) return;
                    gl.uniform1f(uniforms.time, time);
                    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
                    needsDraw = false;
                    hero.dataset.motionReady = '';
                };
                resize();
                return { draw, resize, dispose };
            } catch (error) {
                dispose();
                throw error;
            }
        };

        const tick = timestamp => {
            frame = null;
            if (!canRun()) { stop(); return; }
            // Render at most 30 frames per second, independent of display refresh rate.
            if (previousTime === null || timestamp - previousTime >= 1000 / 30 - 1) {
                if (previousTime !== null) time += Math.min((timestamp - previousTime) / 1000, .1);
                previousTime = timestamp;
                try { renderer.draw(); } catch (_) { fail(); return; }
            }
            frame = requestAnimationFrame(tick);
        };
        const update = () => {
            if (failed || contextLost || limitedMotion()) { fallback(); return; }
            if (!renderer && image.complete && image.naturalWidth && inView && !document.hidden && !pageHidden) {
                try { renderer = createRenderer(); } catch (_) { fail(); return; }
            }
            if (renderer) {
                button.hidden = false;
                button.textContent = userPaused ? 'Resume motion' : 'Pause motion';
                if (needsDraw && inView && !document.hidden && !pageHidden) {
                    try { renderer.draw(); } catch (_) { fail(); return; }
                }
            }
            if (canRun()) {
                if (frame === null) frame = requestAnimationFrame(tick);
            } else stop();
        };
        const resize = () => {
            if (!renderer || contextLost || failed) return;
            try {
                renderer.resize();
                needsDraw = true;
                if (!limitedMotion() && inView && !document.hidden && !pageHidden) renderer.draw();
            } catch (_) { fail(); }
        };
        button.addEventListener('click', () => { userPaused = !userPaused; update(); });
        image.addEventListener('load', update);
        image.addEventListener('error', fail);
        document.addEventListener('visibilitychange', update);
        reducedMotion.addEventListener('change', update);
        connection?.addEventListener('change', update);
        window.addEventListener('pagehide', () => { pageHidden = true; stop(); });
        window.addEventListener('pageshow', () => { pageHidden = false; resize(); update(); });
        canvas.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            contextLost = true;
            renderer = null;
            fallback();
        });
        canvas.addEventListener('webglcontextrestored', () => { contextLost = false; failed = false; update(); });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(entries => { inView = entries[0].isIntersecting; update(); }, { threshold: 0 }).observe(hero);
        }
        if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
        else window.addEventListener('resize', resize);
        update();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
