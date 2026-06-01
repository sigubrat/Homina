// footer.js — Shared footer component for all pages.
// Usage: place <div id="footer-root"></div> where the footer should appear.

(function () {
    var el = document.getElementById("footer-root");
    if (!el) return;

    el.outerHTML = '<footer class="footer">' +
        '<div class="wrap">' +
            '<div class="footer-main">' +
                '<div class="footer-magos">' +
                    '<img src="assets/magos-penguin.png" alt="Homina\'s Magos mascot" />' +
                    '<div>' +
                        '<div class="tag">Built by a professional software developer, Tacticus Tool Builder &amp; Player Ambassador</div>' +
                        '<h3>Forged for the Tacticus community</h3>' +
                        '<p>Homina started out as a hobby project intended to replace exhausting excel files in my guild at the moment and has since grown into a comprehensive tool for the community.</p>' +
                    '</div>' +
                '</div>' +
                '<div class="footer-links">' +
                    '<a class="icon-btn" href="https://github.com/sigubrat/Homina" target="_blank" rel="noopener" aria-label="GitHub">' +
                        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C18 5.6 19 5.9 19 5.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z"/></svg>' +
                    '</a>' +
                    '<a class="icon-btn" href="https://discord.gg/FajYxuWY9b" target="_blank" rel="noopener" aria-label="Discord">' +
                        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.3.5c1.7.4 2.5.9 3.4 1.5a13 13 0 0 0-10.9 0c.9-.6 1.8-1.1 3.4-1.5L10.6 3a19.8 19.8 0 0 0-4.9 1.4C2.6 9 1.8 13.5 2.2 18a20 20 0 0 0 6 3l.5-.9c-.8-.3-1.6-.7-2.3-1.2l.5-.4a14.3 14.3 0 0 0 12.2 0l.5.4c-.7.5-1.5.9-2.3 1.2l.5.9a20 20 0 0 0 6-3c.5-5.2-.8-9.7-3.5-13.6zM9 15.3c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>' +
                    '</a>' +
                    '<a class="icon-btn" href="https://www.buymeacoffee.com/homina" target="_blank" rel="noopener" aria-label="Buy me a coffee">\u2615</a>' +
                '</div>' +
            '</div>' +
            '<div class="footer-bottom">' +
                '<span>\u00a9 ' + new Date().getFullYear() + ' Homina \u00b7 A Warhammer 40,000: Tacticus community tool</span>' +
                '<span><a href="commands.html">Commands</a> \u00b7 <a href="terms.html">Terms & Privacy</a> \u00b7 <a href="https://github.com/sigubrat/Homina" target="_blank" rel="noopener">Open source</a></span>' +
            '</div>' +
            '<div class="footer-legal">' +
                'Warhammer 40,000: Tacticus is developed by Snowprint Studios AB. Warhammer 40,000 and all associated marks, characters, names, races, race insignia, vehicles, locations, units, illustrations and images are either \u00ae or \u2122, and/or \u00a9 Games Workshop Limited \u2014 used without permission. No challenge to their status is intended. Homina is a fan-made tool with no commercial affiliation to either Snowprint Studios AB or Games Workshop Limited.' +
            '</div>' +
        '</div>' +
    '</footer>';
})();
