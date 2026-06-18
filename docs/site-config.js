// site-config.js — Single source of truth for site-wide settings.
// Edit these values to update the banner across all pages.

var SITE_CONFIG = {
    // Temporary code banner
    showBanner: true,
    tempCode: "HOMINA6K",
    tempNote: "Limited-time code \u2013 redeem in-game before it expires.",
    // ISO date string (YYYY-MM-DD) after which the banner auto-hides. Set to null to disable expiry.
    bannerExpiryDate: "2026-06-22"
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
