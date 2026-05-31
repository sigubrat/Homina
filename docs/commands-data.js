// commands-data.js — full Homina command reference, grouped by category.
// Descriptions are taken verbatim (lightly punctuated) from the bot source.
// opts: option names; prefix "*" marks a required option.
// img: optional example screenshot.
window.HOMINA_COMMANDS = [
    {
        id: "getting-started",
        title: "Getting Started",
        blurb: "Register once, then everyone in the guild can use the analytics.",
        commands: [
            { name: "register", desc: "Register your account to use the bot. Needs an API token with Guild scope created by a Leader or Co-Leader.", opts: ["*api-token"] },
            { name: "test-token", desc: "Test your registered API token to see if it is still valid." },
            { name: "delete", desc: "Delete your Discord account and API token from the bot." }
        ]
    },
    {
        id: "damage",
        title: "Damage & Performance",
        blurb: "Who's carrying the season, and how everyone stacks up against the guild.",
        commands: [
            { name: "member-stats-per-season", desc: "Display detailed per-member statistics for a season — total damage, average and max damage-per-token, and the guild median.", opts: ["season", "rarity", "export"], img: "assets/graph-damage-history.png", imgAlt: "Per-member damage breakdown chart" },
            { name: "relative-performance", desc: "See how each member performs relative to the guild average across all bosses at a rarity.", opts: ["rarity", "season", "seasons"], img: "assets/graph-relative-performance.png", imgAlt: "Relative performance diverging chart" },
            { name: "season-highscore", desc: "Get each player's highscore per boss for a season.", opts: ["rarity", "season"] },
            { name: "best-comps", desc: "See the highest-scoring raid team compositions for a season.", opts: ["rarity", "season"] },
            { name: "prime-specialists", desc: "See who deals the most damage to each prime, using data from seasons with matching primes.", opts: ["rarity", "season"] }
        ]
    },
    {
        id: "tokens",
        title: "Token Economy",
        blurb: "Token usage, efficiency and waste across the guild.",
        commands: [
            { name: "season-tokens", desc: "Find out how many tokens each member has used in a specific season, with median, standard deviation and estimated availability.", opts: ["season", "rarity", "average-method"], img: "assets/graph-season-tokens.png", imgAlt: "Season tokens chart" },
            { name: "tokens-per-loop", desc: "Show how many tokens the guild spent on each loop in a given season.", opts: ["season"] },
            { name: "tokens-per-loop-by-boss", desc: "Show how many tokens the guild spent on each boss per loop in a given season.", opts: ["rarity"] },
            { name: "tokens-burnt", desc: "See how many tokens each guild member has burned by hitting the cap this season." },
            { name: "token-history", desc: "Show a player's token usage over the last N seasons as a line chart.", opts: ["*member", "seasons"] }
        ]
    },
    {
        id: "bombs",
        title: "Bombs & Availability",
        blurb: "Coordinate bomb drops and see who's ready to hit right now.",
        commands: [
            { name: "available-bombs", desc: "See who has bombs available now, projected bomb damage, boss-kill chances and a copy-paste ping list.", opts: ["soon"], img: "assets/graph-available-bombs.png", imgAlt: "Available bombs readout" },
            { name: "season-bombs", desc: "Check how many bombs each member has used in a specific guild raid season.", opts: ["season", "average-method"] },
            { name: "gr-availability", desc: "Get an overview of how many guild raid tokens and bombs each member has available." }
        ]
    },
    {
        id: "participation",
        title: "Participation & Activity",
        blurb: "Manage the roster fairly with clear activity data.",
        commands: [
            { name: "season-participation", desc: "Check how much each member has participated in a specific guild raid season.", opts: ["season", "rarity", "show-bombs", "average-method"] },
            { name: "inactivity-by-season", desc: "Find out who did not use the required number of tokens in a season.", opts: ["season", "threshold", "rarity"] },
            { name: "activity-per-hour", desc: "See what time of day your guild uses their guild raid tokens." },
            { name: "gr-time-used", desc: "See how long it takes to complete each raid boss in a given season.", opts: ["season", "rarity", "separate-primes", "show-delta"] }
        ]
    },
    {
        id: "seasons",
        title: "Seasons & Trends",
        blurb: "Long-range trends and per-season configuration lookups.",
        commands: [
            { name: "guild-credits-history", desc: "Show how many credits the guild has earned from killing guild bosses over the last N seasons.", opts: ["seasons", "starting-season", "old-comparison"] },
            { name: "loops-history", desc: "Show how many guild raid loops the guild has completed over the last N seasons.", opts: ["seasons"] },
            { name: "gr-damage-history", desc: "Show a line chart of total guild damage dealt over the last N seasons.", opts: ["seasons"] },
            { name: "season-by-rarity", desc: "Show guild raid stats for each boss at a specific rarity in a given season.", opts: ["rarity", "boss-type", "season", "average-method", "sort-by"] },
            { name: "season-bosses", desc: "Get the guild boss configs for the previous seasons.", opts: ["rarity"] },
            { name: "season-same", desc: "Get previous guild raid seasons with the same boss config.", opts: ["season"] },
            { name: "meta-team-distribution", desc: "Show the distribution of meta teams in a specific season.", opts: ["season", "rarity"] },
            { name: "achievements", desc: "See fun guild-wide superlatives and awards for a season.", opts: ["season"] },
            { name: "track-member", desc: "Track a single member's guild raid stats over the last several seasons.", opts: ["*member"] }
        ]
    },
    {
        id: "management",
        title: "Guild Management",
        blurb: "Roster, nicknames, scoped tokens and access — all from Discord.",
        commands: [
            { name: "player-metadata", desc: "Show nicknames and player API token status for all guild members." },
            { name: "member-ids", desc: "Get a list of members in the guild for use in registering usernames." },
            { name: "set-player-nickname", desc: "Set a custom display nickname for a guild member across all commands.", opts: ["*player", "*nickname"] },
            { name: "clear-player-nickname", desc: "Remove a custom nickname for a guild member, restoring their in-game name.", opts: ["*player"] },
            { name: "set-player-token", desc: "Register a player-scope API token for a guild member to enable precise cooldown data.", opts: ["*player", "*player-token"] },
            { name: "clear-player-token", desc: "Remove a player-scope API token for a guild member, reverting to estimated cooldowns.", opts: ["*player"] },
            { name: "invite-user", desc: "Invite a user to register with your API token.", opts: ["*user"] },
            { name: "revoke-access", desc: "Revoke access for a user you previously invited." }
        ]
    },
    {
        id: "utility",
        title: "Utility",
        blurb: "Help and bot diagnostics.",
        commands: [
            { name: "help", desc: "Get an overview of the bot and its commands." },
            { name: "bot-stats", desc: "Get statistics about the bot and its performance." },
            { name: "bot-metrics", desc: "View detailed bot usage metrics and trends." }
        ]
    }
];
