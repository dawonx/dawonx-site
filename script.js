(() => {
    'use strict';

    const scriptURL = document.currentScript && document.currentScript.src;
    const siteRoot = typeof window.basePath === 'string'
        ? new URL(window.basePath, document.baseURI)
        : new URL('.', scriptURL || document.baseURI);

    const init = () => {
        const validLanguage = value => value === 'ko' ? 'ko' : 'en';
        let currentLang = 'en';
        try { currentLang = validLanguage(localStorage.getItem('lang')); } catch (_) { /* Storage may be disabled. */ }
        const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
        if (requestedLanguage === 'en' || requestedLanguage === 'ko') {
            currentLang = requestedLanguage;
            try { localStorage.setItem('lang', currentLang); } catch (_) { /* The URL selection still applies. */ }
        }

        const element = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text !== undefined) node.textContent = String(text);
            return node;
        };
        const siteURL = value => {
            const source = String(value || '').trim();
            if (/^(?:https?:)?\/\//i.test(source)) return new URL(source, siteRoot).href;
            if (/^[a-z][a-z\d+.-]*:/i.test(source)) return null;
            // Existing content uses /assets/... to mean the site's root, including subpath hosting.
            if (source.startsWith('/') && siteRoot.pathname !== '/' && source.startsWith(siteRoot.pathname)) {
                return new URL(source, siteRoot.origin).href;
            }
            return new URL(source.replace(/^\/+/, ''), siteRoot).href;
        };
        const statusMessage = (container, text, retry) => {
            container.replaceChildren();
            const box = element('div', 'content-status');
            box.setAttribute('role', 'status');
            box.append(element('p', '', text));
            if (retry) {
                const button = element('button', 'retry-button', currentLang === 'ko' ? '다시 시도' : 'Try again');
                button.type = 'button';
                button.addEventListener('click', retry);
                box.append(button);
            }
            container.append(box);
        };
        const applyLanguage = () => {
            document.documentElement.lang = currentLang;
            const menuButton = document.getElementById('menu-toggle');
            if (menuButton) {
                const open = menuButton.getAttribute('aria-expanded') === 'true';
                menuButton.setAttribute('aria-label', currentLang === 'ko'
                    ? (open ? '메뉴 닫기' : '메뉴 열기')
                    : (open ? 'Close navigation' : 'Open navigation'));
            }
            document.querySelectorAll('.lang-btn').forEach(button => {
                const active = button.dataset.lang === currentLang;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });
            document.querySelectorAll('[data-en][data-ko]').forEach(node => {
                node.textContent = node.dataset[currentLang];
            });
        };

        // The menu remains outside the focus order until it opens.
        const menuToggle = document.getElementById('menu-toggle');
        const navOverlay = document.getElementById('nav-overlay');
        if (menuToggle && navOverlay) {
            let menuOpen = false;
            let previousOverflow = '';
            menuToggle.setAttribute('aria-controls', navOverlay.id);
            menuToggle.setAttribute('aria-expanded', 'false');
            navOverlay.setAttribute('aria-hidden', 'true');
            navOverlay.inert = true;
            const focusables = () => [menuToggle, ...navOverlay.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
                .filter(node => !node.hidden && node.getClientRects().length > 0);
            const setMenu = open => {
                menuOpen = open;
                menuToggle.classList.toggle('active', open);
                navOverlay.classList.toggle('active', open);
                menuToggle.setAttribute('aria-expanded', String(open));
                menuToggle.setAttribute('aria-label', currentLang === 'ko'
                    ? (open ? '메뉴 닫기' : '메뉴 열기')
                    : (open ? 'Close navigation' : 'Open navigation'));
                navOverlay.setAttribute('aria-hidden', String(!open));
                navOverlay.inert = !open;
                if (open) {
                    previousOverflow = document.body.style.overflow;
                    document.body.style.overflow = 'hidden';
                    const firstLink = navOverlay.querySelector('a[href], button:not([disabled])');
                    if (firstLink) firstLink.focus();
                } else {
                    document.body.style.overflow = previousOverflow;
                    menuToggle.focus();
                }
            };
            menuToggle.addEventListener('click', () => setMenu(!menuOpen));
            navOverlay.addEventListener('click', event => {
                if (event.target === navOverlay || event.target.closest('a[href]')) setMenu(false);
            });
            document.addEventListener('keydown', event => {
                if (!menuOpen) return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    setMenu(false);
                } else if (event.key === 'Tab') {
                    const items = focusables();
                    const first = items[0] || menuToggle;
                    const last = items[items.length - 1] || menuToggle;
                    if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
                        event.preventDefault();
                        last.focus();
                    } else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
                        event.preventDefault();
                        first.focus();
                    }
                }
            });
        }

        // Cards use normal links, supplied image URLs, and native lazy loading.
        const createCard = (item, seriesCounts) => {
            const card = element('article', 'showcase-card in-view');
            card.dataset.category = item.category || 'uncategorized';
            const link = element('a', 'card-link');
            link.href = siteURL(item.path) || siteURL('index.html');
            const imageBox = element('div', 'card-image');
            const image = element('img');
            const fallback = siteURL('assets/optimized/computational-study.webp');
            image.alt = item.title || '';
            image.width = 280;
            image.height = 280;
            image.loading = 'lazy';
            image.decoding = 'async';
            const revealImage = () => {
                image.classList.add('loaded');
                imageBox.classList.add('image-loaded');
            };
            image.addEventListener('load', revealImage);
            image.addEventListener('error', () => {
                if (image.src !== fallback) image.src = fallback;
                revealImage();
            });
            image.src = siteURL(item.image || 'assets/optimized/computational-study.webp') || fallback;
            imageBox.append(image);
            const content = element('div', 'card-content');
            const top = element('div', 'card-content-top');
            top.append(element('span', 'card-category', item.subcategory || item.category || ''));
            if (item.series && item.series.name) {
                top.append(element('span', 'series-badge', `Series ${item.series.order}/${seriesCounts.get(item.series.name)}`));
            }
            const middle = element('div', 'card-content-middle');
            middle.append(element('h3', '', currentLang === 'ko' && item.title_ko ? item.title_ko : item.title || 'Untitled'));
            const bottom = element('div', 'card-content-bottom');
            const meta = element('div', 'card-meta');
            if (item.date) meta.append(element('span', '', item.date));
            if (item.author) meta.append(element('span', '', `By ${item.author}`));
            bottom.append(meta);
            content.append(top, middle, bottom);
            link.append(imageBox, content);
            card.append(link);
            return card;
        };
        const renderGrid = (grid, data, allData = data) => {
            const seriesCounts = new Map();
            allData.forEach(item => {
                if (item.series && item.series.name) seriesCounts.set(item.series.name, (seriesCounts.get(item.series.name) || 0) + 1);
            });
            grid.replaceChildren(...data.map(item => createCard(item, seriesCounts)));
        };
        const listingStates = [];
        const categoryMatches = (item, category) => String(item.category || '').toLowerCase() === category.toLowerCase();
        const renderListing = state => {
            if (state.grid) {
                const filtered = state.filter === 'all' ? state.data : state.data.filter(item => categoryMatches(item, state.filter));
                renderGrid(state.grid, filtered, state.data);
            }
            state.categoryGrids.forEach(grid => {
                const category = grid.id.slice(state.type.length + 1, -5);
                const data = state.data.filter(item => categoryMatches(item, category));
                const section = grid.closest('.category-section');
                if (section) section.hidden = data.length === 0;
                renderGrid(grid, data, state.data);
            });
        };
        ['work', 'research', 'blog'].forEach(type => {
            const grid = document.getElementById(`${type}-grid`);
            const categoryGrids = [...document.querySelectorAll(`[id^="${type}-"][id$="-grid"]`)].filter(node => node !== grid);
            if (!grid && !categoryGrids.length) return;
            const state = { type, grid, categoryGrids, data: [], filter: 'all' };
            listingStates.push(state);
            const load = async () => {
                try {
                    const response = await fetch(siteURL(`content/${type}/posts.json`));
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = await response.json();
                    if (!Array.isArray(data)) throw new Error('Expected a content list.');
                    state.data = data.filter(item => item && typeof item === 'object');
                    renderListing(state);
                } catch (error) {
                    console.error('Unable to load content list:', error);
                    [grid, ...categoryGrids].filter(Boolean).forEach(target => {
                        statusMessage(target, currentLang === 'ko' ? '콘텐츠를 불러올 수 없습니다.' : 'Unable to load content.', load);
                    });
                }
            };
            if (grid) {
                document.querySelectorAll('.content-header .tab-btn').forEach(tab => {
                    tab.setAttribute('aria-pressed', String(tab.classList.contains('active')));
                    tab.addEventListener('click', () => {
                        state.filter = tab.dataset.category || 'all';
                        document.querySelectorAll('.content-header .tab-btn').forEach(button => {
                            button.classList.toggle('active', button === tab);
                            button.setAttribute('aria-pressed', String(button === tab));
                        });
                        renderListing(state);
                    });
                });
            }
            load();
        });

        const postDetail = document.getElementById('post-detail');
        const toc = document.getElementById('toc-container');
        let tocObserver;
        let requestNumber = 0;
        let activeRequest;
        const manifests = new Map();
        const availableLanguages = async (category, slug) => {
            if (!manifests.has(category)) {
                manifests.set(category, fetch(siteURL(`content/${category}/posts.json`))
                    .then(response => response.ok ? response.json() : null)
                    .catch(() => null));
            }
            const manifest = await manifests.get(category);
            if (!Array.isArray(manifest)) return null;
            const item = manifest.find(entry => {
                const path = String(entry.path || '').replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, '');
                return path === `${category}/${slug}` || entry.slug === slug;
            });
            return item && Array.isArray(item.languages) ? item.languages : null;
        };
        const clearToc = () => {
            if (tocObserver) tocObserver.disconnect();
            if (toc) {
                const back = toc.querySelector('.back-button');
                toc.replaceChildren();
                if (back) toc.append(back);
            }
        };
        const generateToc = () => {
            clearToc();
            const headings = [...postDetail.querySelectorAll('h1, h2, h3')];
            const usedIds = new Set();
            const links = new Map();
            const list = element('ul');
            headings.forEach((heading, index) => {
                const slug = heading.id || heading.textContent.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-') || `section-${index + 1}`;
                let id = slug;
                let suffix = 2;
                while (usedIds.has(id)) id = `${slug}-${suffix++}`;
                usedIds.add(id);
                heading.id = id;
                const item = element('li');
                const link = element('a', '', heading.textContent);
                link.href = `#${encodeURIComponent(id)}`;
                link.style.paddingLeft = `${15 + (Number(heading.tagName.slice(1)) - 1) * 15}px`;
                item.append(link);
                list.append(item);
                links.set(heading, link);
            });
            if (!toc || headings.length < 2) return;
            toc.append(element('h3', '', currentLang === 'ko' ? '목차' : 'On this page'), list);
            if ('IntersectionObserver' in window) {
                tocObserver = new IntersectionObserver(entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            links.forEach(link => link.classList.remove('active'));
                            links.get(entry.target).classList.add('active');
                        }
                    });
                }, { rootMargin: '0px 0px -75% 0px', threshold: 0.1 });
                headings.forEach(heading => tocObserver.observe(heading));
            }
        };
        const markdownURL = (source, documentURL, isImage = false) => {
            const value = String(source || '').trim();
            if (!value) return null;
            if (!isImage && value.startsWith('#')) return value;
            let resolved;
            if (/^\/(?!\/)|^(?:assets|content|work|research|blog)\//.test(value)) {
                const url = siteURL(value);
                if (!url) return null;
                resolved = new URL(url);
            } else {
                resolved = new URL(value, documentURL);
            }
            if (!(isImage ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:']).includes(resolved.protocol)) return null;
            if (!isImage && resolved.origin === siteRoot.origin && resolved.pathname.startsWith(siteRoot.pathname)) {
                const localPath = resolved.pathname.slice(siteRoot.pathname.length);
                const match = localPath.match(/^content\/(work|research|blog)\/([^/]+?)(?:\.ko)?\.md$/);
                if (match) return `${siteURL(`${match[1]}/${match[2]}/`)}${resolved.search}${resolved.hash}`;
            }
            return resolved.href;
        };
        const loadMarkdown = async () => {
            if (!postDetail) return;
            if (postDetail.dataset.renderedLang === currentLang) {
                postDetail.querySelector('.translation-notice')?.remove();
                postDetail.lang = currentLang;
                generateToc();
                return;
            }
            const rendererReady = window.marked && typeof window.marked.parse === 'function' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function';
            if (!rendererReady && postDetail.dataset.renderedLang) {
                postDetail.lang = postDetail.dataset.renderedLang;
                postDetail.setAttribute('aria-busy', 'false');
                if (!postDetail.querySelector('.translation-notice')) {
                    const notice = element('p', 'translation-notice', '번역을 불러올 수 없어 영어 원문을 표시합니다.');
                    notice.lang = 'ko';
                    notice.setAttribute('role', 'status');
                    postDetail.prepend(notice);
                }
                generateToc();
                return;
            }
            delete postDetail.dataset.renderedLang;
            const request = ++requestNumber;
            if (activeRequest) activeRequest.abort();
            activeRequest = new AbortController();
            const { signal } = activeRequest;
            const lang = currentLang;
            clearToc();
            postDetail.removeAttribute('lang');
            statusMessage(postDetail, lang === 'ko' ? '콘텐츠를 불러오는 중입니다.' : 'Loading content...');
            postDetail.setAttribute('aria-busy', 'true');
            try {
                if (!window.marked || typeof window.marked.parse !== 'function' || !window.DOMPurify || typeof window.DOMPurify.sanitize !== 'function') {
                    throw new Error('The content renderer is unavailable.');
                }
                const path = window.location.pathname.slice(siteRoot.pathname.length).replace(/\/index\.html$/, '/');
                const match = path.match(/^(work|research|blog)\/([^/]+)\/?$/);
                if (!match) throw new Error('Invalid content address.');
                const [, category, slug] = match;
                const languages = lang === 'ko' ? await availableLanguages(category, slug) : null;
                if (request !== requestNumber) return;
                let fallback = lang === 'ko' && languages !== null && !languages.includes('ko');
                let url = siteURL(`content/${category}/${slug}${lang === 'ko' && !fallback ? '.ko' : ''}.md`);
                let response = await fetch(url, { signal });
                if (lang === 'ko' && !fallback && response.status === 404) {
                    fallback = true;
                    url = siteURL(`content/${category}/${slug}.md`);
                    response = await fetch(url, { signal });
                }
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const markdown = await response.text();
                if (!markdown.trim()) throw new Error('Empty content.');
                if (request !== requestNumber) return;
                const fragment = window.DOMPurify.sanitize(window.marked.parse(markdown), {
                    USE_PROFILES: { html: true },
                    RETURN_DOM_FRAGMENT: true,
                    FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea'],
                    FORBID_ATTR: ['style', 'srcset']
                });
                fragment.querySelectorAll('a[href]').forEach(link => {
                    const href = markdownURL(link.getAttribute('href'), url);
                    if (href) link.href = href;
                    else link.removeAttribute('href');
                    if (link.target === '_blank') link.rel = 'noopener noreferrer';
                });
                fragment.querySelectorAll('img').forEach(image => {
                    const src = markdownURL(image.getAttribute('src'), url, true);
                    if (!src) { image.remove(); return; }
                    image.src = src;
                    image.loading = 'lazy';
                    image.decoding = 'async';
                    image.style.maxWidth = '100%';
                    image.style.height = 'auto';
                    image.addEventListener('error', () => {
                        const message = element('p', 'image-error', lang === 'ko' ? '이미지를 불러올 수 없습니다.' : 'Image unavailable.');
                        image.replaceWith(message);
                    }, { once: true });
                });
                postDetail.replaceChildren();
                postDetail.lang = fallback ? 'en' : lang;
                postDetail.dataset.renderedLang = postDetail.lang;
                if (fallback) {
                    const notice = element('p', 'translation-notice', '한국어 번역이 아직 없어 영어 원문을 표시합니다.');
                    notice.lang = 'ko';
                    notice.setAttribute('role', 'status');
                    postDetail.append(notice);
                }
                postDetail.append(fragment);
                generateToc();
            } catch (error) {
                if (request !== requestNumber || error.name === 'AbortError') return;
                console.error('Unable to load article:', error);
                statusMessage(postDetail, lang === 'ko' ? '콘텐츠를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.' : 'Unable to load this article. Please try again.', loadMarkdown);
            } finally {
                if (request === requestNumber) postDetail.setAttribute('aria-busy', 'false');
            }
        };
        document.querySelectorAll('.lang-btn').forEach(button => {
            button.addEventListener('click', () => {
                const lang = validLanguage(button.dataset.lang);
                if (lang === currentLang) return;
                currentLang = lang;
                const currentURL = new URL(window.location.href);
                if (currentURL.searchParams.has('lang')) {
                    currentURL.searchParams.set('lang', lang);
                    try { window.history.replaceState(window.history.state, '', currentURL); } catch (_) { /* Storage still records the selection when available. */ }
                }
                try { localStorage.setItem('lang', lang); } catch (_) { /* Switching still works without persistent storage. */ }
                applyLanguage();
                listingStates.forEach(renderListing);
                loadMarkdown();
                window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
            });
        });
        applyLanguage();
        loadMarkdown();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
