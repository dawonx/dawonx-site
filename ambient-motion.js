(() => {
    'use strict';

    const init = () => {
        const hero = document.getElementById('ambient-hero');
        if (!hero) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const connection = navigator.connection;
        let inView = false;
        let pageHidden = false;

        // Choose each layer's phase once. CSS owns the animation timeline.
        hero.querySelectorAll('.ambient-layer').forEach((layer, index) => {
            const duration = 12 + index * 3 + Math.random() * 2;
            layer.style.setProperty('--ambient-duration', `${duration.toFixed(2)}s`);
            // Start the layers between turning points so motion is visible on arrival.
            const phase = .18 + index * .27 + Math.random() * .08;
            layer.style.setProperty('--ambient-delay', `${(-phase * duration).toFixed(2)}s`);
        });

        const update = () => {
            const running = inView && !document.hidden && !pageHidden && !reducedMotion.matches && !connection?.saveData;
            if (running) hero.dataset.ambientRunning = '';
            else delete hero.dataset.ambientRunning;
        };
        const measure = () => {
            const bounds = hero.getBoundingClientRect();
            inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
            update();
        };
        document.addEventListener('visibilitychange', measure);
        window.addEventListener('pagehide', () => { pageHidden = true; update(); });
        window.addEventListener('pageshow', () => { pageHidden = false; measure(); });
        if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', update);
        else reducedMotion.addListener?.(update);
        connection?.addEventListener?.('change', update);

        if ('IntersectionObserver' in window) {
            new window.IntersectionObserver(entries => {
                inView = entries.some(entry => entry.isIntersecting);
                update();
            }).observe(hero);
        } else {
            window.addEventListener('scroll', measure, { passive: true });
            window.addEventListener('resize', measure);
        }
        measure();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
