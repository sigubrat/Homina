// site-config.js — Single source of truth for site-wide settings.
// Edit these values to update the banner across all pages.

var SITE_CONFIG = {
    // Temporary code banner
    showBanner: true,
    tempCode: "HOMINA5k",
    tempNote: "Limited-time code \u2013 redeem in-game before it expires."
};

(function () {
    // Apply banner config
    if (SITE_CONFIG.showBanner) {
        document.body.classList.add("fx-tempcode");
    } else {
        document.body.classList.remove("fx-tempcode");
    }

    var codeEl = document.getElementById("temp-code");
    var noteEl = document.getElementById("temp-note");
    if (codeEl) codeEl.textContent = SITE_CONFIG.tempCode;
    if (noteEl) noteEl.textContent = SITE_CONFIG.tempNote;
})();
