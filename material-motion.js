(() => {
    'use strict';

    const geometry = globalThis.MaterialGeometry;
    if (!geometry) return;
    const { createFibers, vertexSource, fragmentSource } = geometry;

    const init = () => {
        const hero = document.getElementById('material-hero');
        const canvas = document.getElementById('material-canvas');
        const button = document.getElementById('motion-toggle');
        if (!hero || !canvas || !button) return;
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
        const seed = Math.floor(Math.random() * 4294967296);
        const limitedMotion = () => reducedMotion.matches || Boolean(connection?.saveData);
        const canRun = () => renderer && !failed && !contextLost && !userPaused && !limitedMotion() && inView && !document.hidden && !pageHidden;
        const stop = () => {
            if (frame !== null) cancelAnimationFrame(frame);
            frame = null;
            previousTime = null;
        };
        const fallback = () => {
            stop();
            needsDraw = true;
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
            const dispose = () => {
                shaders.forEach(shader => gl.deleteShader(shader));
                buffers.forEach(buffer => gl.deleteBuffer(buffer));
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

                const fibers = createFibers(seed, window.innerWidth <= 720);
                const count = fibers.vertices.length / 8;
                if (count < 1000) throw new Error('Material geometry unavailable');
                const buffer = gl.createBuffer();
                buffers.push(buffer);
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, fibers.vertices, gl.STATIC_DRAW);
                for (const [name, size, offset] of [['a_position', 3, 0], ['a_tangent', 3, 12], ['a_material', 2, 24]]) {
                    const location = gl.getAttribLocation(program, name);
                    gl.enableVertexAttribArray(location);
                    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 32, offset);
                }
                gl.clearColor(16 / 255, 18 / 255, 17 / 255, 1);
                gl.disable(gl.DEPTH_TEST);
                gl.enable(gl.BLEND);
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                if (gl.getError() !== gl.NO_ERROR) throw new Error('Material buffers unavailable');
                const uniforms = Object.fromEntries(['time', 'seed', 'aspect'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
                gl.uniform1f(uniforms.seed, (seed % 10000) / 17);
                let width = 0, height = 0;
                const resize = () => {
                    width = hero.clientWidth;
                    height = hero.clientHeight;
                    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1500000 / Math.max(1, width * height)), 2048 / Math.max(1, width, height));
                    canvas.width = Math.max(1, Math.floor(width * ratio));
                    canvas.height = Math.max(1, Math.floor(height * ratio));
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    const aspect = width / Math.max(1, height);
                    gl.uniform1f(uniforms.aspect, aspect);
                };
                const draw = () => {
                    if (!width || !height) return;
                    gl.uniform1f(uniforms.time, time);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    gl.drawArrays(gl.LINES, 0, count);
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
            if (!renderer && inView && !document.hidden && !pageHidden) {
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
