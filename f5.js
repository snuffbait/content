/**
 * @name         f5-reload
 * @author       Fae
 * @version      1.0.0
 * @description  Press F5 to reload the page.
 * @license      MIT
 */

module.exports = {
    onEnable() {
        console.log('[f5-reload] Plugin enabled');
    },

    onDisable() {
        console.log('[f5-reload] Plugin disabled');
    },

    onTrackChange() {},
    onThemeChange() {},

    contentScript() {
        return `
            (function() {
                if (window.__f5ReloadLoaded) return;
                window.__f5ReloadLoaded = true;

                function onKeyDown(e) {
                    if (e.key === 'F5') {
                        e.preventDefault();
                        location.reload();
                    }
                }

                window.addEventListener('keydown', onKeyDown);

                window.__scrpc_cleanup_f5_reload = function() {
                    window.removeEventListener('keydown', onKeyDown);
                    delete window.__f5ReloadLoaded;
                    console.log('[f5-reload] Cleaned up');
                };

                console.log('[f5-reload] Content script running');
            })();
        `;
    },
};