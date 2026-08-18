// site-config.js — Single source of truth for site-wide settings.
// Edit these values to update the banner across all pages.

var SITE_CONFIG = {
    // Temporary code banner
    showBanner: true,
    tempCode: "AUTOMATON",
    tempNote: "This is a raffle code for the anniversary raffle. You can support the bot by claiming the code and entering this webpage URL into the favourite content creator <3",
    // ISO date string (YYYY-MM-DD) after which the banner auto-hides. Set to null to disable expiry.
    bannerExpiryDate: "2026-08-31"
};

(function () {
    // Auto-hide banner if past expiry date
    var bannerVisible = SITE_CONFIG.showBanner;
    if (bannerVisible && SITE_CONFIG.bannerExpiryDate) {
        var expiry = new Date(SITE_CONFIG.bannerExpiryDate + "T00:00:00");
        if (Date.now() >= expiry.getTime()) {
            bannerVisible = false;
        }
    }

    // Apply banner config
    if (bannerVisible) {
        document.body.classList.add("fx-tempcode");
    } else {
        document.body.classList.remove("fx-tempcode");
    }

    var codeEl = document.getElementById("temp-code");
    var noteEl = document.getElementById("temp-note");
    if (codeEl) codeEl.textContent = SITE_CONFIG.tempCode;
    if (noteEl) noteEl.textContent = SITE_CONFIG.tempNote;
})();
