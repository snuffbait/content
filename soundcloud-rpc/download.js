/**
 * @name         local-soundcloud-downloader
 * @author       maple3142 & fae
 * @version      0.1.6
 * @description  Download SoundCloud without external service (now works with soundcloud rpc)
 * @license      MIT
 * @homepage     https://blog.maple3142.net/
 * @require      https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js
 * @require      https://cdn.jsdelivr.net/npm/streamsaver@2.0.3/StreamSaver.min.js
 */

module.exports = {
    onEnable() {
        console.log('[local-soundcloud-downloader] Plugin enabled');
    },

    onDisable() {
        console.log('[local-soundcloud-downloader] Plugin disabled');
    },

    onTrackChange(track) {
        if (track.isPlaying) {
            console.log(`[local-soundcloud-downloader] Now playing: ${track.title} by ${track.author}`);
        }
    },

    onThemeChange(isDark) {
        console.log(`[local-soundcloud-downloader] Theme changed to ${isDark ? 'dark' : 'light'}`);
    },

    contentScript() {
        return `
            (function() {
                if (window.__scDlMaple3142Loaded) return;
                window.__scDlMaple3142Loaded = true;

                function loadScript(src) {
                    return new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = src;
                        s.onload = resolve;
                        s.onerror = reject;
                        document.head.appendChild(s);
                    });
                }

                Promise.all([
                    loadScript('https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js'),
                    loadScript('https://cdn.jsdelivr.net/npm/streamsaver@2.0.3/StreamSaver.min.js')
                ]).then(init);

                function init() {
                    streamSaver.mitm = 'https://maple3142.github.io/StreamSaver.js/mitm.html';

                    function hook(obj, name, callback, type) {
                        const fn = obj[name];
                        obj[name] = function (...args) {
                            if (type === 'before') callback.apply(this, args);
                            fn.apply(this, args);
                            if (type === 'after') callback.apply(this, args);
                        };
                        return () => { obj[name] = fn; };
                    }

                    const btn = {
                        init() {
                            this.el = document.createElement('button');
                            this.el.textContent = 'Download';
                            this.el.classList.add(
                                'sc-button',
                                'sc-button-medium',
                                'sc-button-icon',
                                'sc-button-responsive',
                                'sc-button-secondary',
                                'sc-button-download'
                            );
                        },
                        cb() {
                            const par = document.querySelector('.sc-button-toolbar .sc-button-group');
                            if (par && this.el.parentElement !== par) par.insertAdjacentElement('beforeend', this.el);
                        },
                        attach() {
                            this.detach();
                            this.observer = new MutationObserver(this.cb.bind(this));
                            this.observer.observe(document.body, { childList: true, subtree: true });
                            this.cb();
                        },
                        detach() {
                            if (this.observer) this.observer.disconnect();
                        }
                    };
                    btn.init();

                    async function getClientId() {
                        return new Promise(resolve => {
                            const restore = hook(
                                XMLHttpRequest.prototype,
                                'open',
                                async (method, url) => {
                                    const u = new URL(url, document.baseURI);
                                    const clientId = u.searchParams.get('client_id');
                                    if (!clientId) return;
                                    console.log('[local-soundcloud-downloader-maple3142] got clientId', clientId);
                                    restore();
                                    resolve(clientId);
                                },
                                'after'
                            );
                        });
                    }

                    const clientIdPromise = getClientId();
                    let controller = null;

                    async function load(by) {
                        btn.detach();
                        console.log('[local-soundcloud-downloader-maple3142] load by', by, location.href);
                        if (/^(\\/(you|stations|discover|stream|upload|search|settings))/.test(location.pathname)) return;

                        const clientId = await clientIdPromise;

                        if (controller) {
                            controller.abort();
                            controller = null;
                        }
                        controller = new AbortController();

                        const result = await fetch(
                            'https://api-v2.soundcloud.com/resolve?url=' + encodeURIComponent(location.href) + '&client_id=' + clientId,
                            { signal: controller.signal }
                        ).then(r => r.json());

                        console.log('[local-soundcloud-downloader-maple3142] result', result);
                        if (result.kind !== 'track') return;

                        btn.el.onclick = async () => {
                            const progressive = result.media.transcodings.find(t => t.format.protocol === 'progressive');
                            if (progressive) {
                                const { url } = await fetch(progressive.url + '?client_id=' + clientId).then(r => r.json());
                                const resp = await fetch(url);
                                const ws = streamSaver.createWriteStream(result.title + '.mp3', {
                                    size: resp.headers.get('Content-Length')
                                });
                                const rs = resp.body;
                                if (rs.pipeTo) return rs.pipeTo(ws);
                                const reader = rs.getReader();
                                const writer = ws.getWriter();
                                const pump = () =>
                                    reader.read().then(res => (res.done ? writer.close() : writer.write(res.value).then(pump)));
                                return pump();
                            }
                            alert('Sorry, downloading this music is currently unsupported.');
                        };

                        btn.attach();
                        console.log('[local-soundcloud-downloader-maple3142] attached');
                    }

                    const restorePushState = hook(history, 'pushState', () => load('pushState'), 'after');
                    const onPopState = () => load('popstate');
                    window.addEventListener('popstate', onPopState);

                    load('init');

                    window.__scrpc_cleanup_local_soundcloud_downloader_maple3142 = function() {
                        btn.detach();
                        if (btn.el && btn.el.parentElement) btn.el.remove();
                        if (controller) { controller.abort(); controller = null; }
                        restorePushState();
                        window.removeEventListener('popstate', onPopState);
                        delete window.__scDlMaple3142Loaded;
                        console.log('[local-soundcloud-downloader-maple3142] Cleaned up');
                    };

                    console.log('[local-soundcloud-downloader-maple3142] Content script running');
                }
            })();
        `;
    },
};