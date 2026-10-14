// site-config.js — Single source of truth for site-wide settings.
// Edit these values to update the banner and links across all pages.

var SITE_CONFIG = {
    // Discord support server invite. Links marked with data-discord-invite use this.
    // Also update discord/index.html (the hominabot.com/discord redirect) and the
    // "sameAs" entry in index.html's structured data when changing it.
    discordInvite: "https://discord.gg/FajYxuWY9b",

    // Temporary code banner
    showBanner: true,
    tempCode: "AUTOMATON",
    tempNote: "This is a raffle code for the anniversary raffle. You can support the bot by claiming the code and entering this webpage URL into the favourite content creator <3",
    // ISO date string (YYYY-MM-DD) after which the banner auto-hides. Set to null to disable expiry.
    bannerExpiryDate: "2026-08-31"
};

(function () {
    // Point Discord links straight at the invite (they fall back to the /discord redirect without JS)
    var discordLinks = document.querySelectorAll("a[data-discord-invite]");
    for (var i = 0; i < discordLinks.length; i++) {
        discordLinks[i].href = SITE_CONFIG.discordInvite;
    }

    // Auto-hide banner if past expiry date, or if the page has no banner
    var bannerVisible = SITE_CONFIG.showBanner && !!document.getElementById("temp-banner");
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
