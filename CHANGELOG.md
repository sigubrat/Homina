# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- ## [Unreleased]

### Added

### Changed

### Fixed

-

### Removed

- -->

## [0.30.0] - 2025-07-08

This update provides optimization of database reads to improve overall performance of the bot and some readability improvements. The bot has grown a lot quicker than I ever imagined. As a thank you for all the great feedback, help with testing, moderation, and support, I've managed to get a you little code to use in-game: HOMINA.

### Changed

-   Database reads for usernames are now 30x faster. Testing was done on my own computer, so the gain is possibly even higher on the server with slower HDDs vs my faster SSDs
-   Improved mobile formatting in `/track-member` to eliminate weird indents.

### Added

-   `/member-stats-by-season` now displays which Rarity filter you selected.

## [0.29.1] - 2025-07-28

A small fix to some command descriptions regarding whether or not they include primes in their calculations.

### Fixed

-   `/member-stats-per-season` - Description now correctly informs that the stats include primes in the calculations.

### Added

-   Added explicit confirmation that commands include primes to:
    -   `/inactivity-by-season`
    -   `/season-tokens`
    -   `/season-participation`

## [0.29.0] - 2025-07-28

This patch is mostly a maintenance patch on the technical side of things. Bit of oil to the cogs, if you will. The patch also brings a minor bugfix and some reliability improvements.

### Fixed

-   Off-by-one bug led to `/track-member` not starting from the current season which wasn't intended. If you prefer the old version let me know.
-   Fixed some minor reliability issues regarding error handling

## [0.28.0] - 2025-07-23

This update provides some new options to existing commands and tries to improve unclear descriptions.

### Added

-   New option for `/gr-time-used`: Show-delta. Enabling this lets you see the difference in time, tokens and bombs used for each looped legendary boss. Each delta uses the first run of the boss as the baseline for comparison.
-   New option for `/track-member`: average-method. Previously this command used exclusively numeric mean as the method to calculate the average. Now you can choose to use median instead. Defaults to mean.

### Changed

-   Changed the description in `/meta-team-distribution` to make the command easier to understand.
-   Changed the graph titles in `/meta-team-distribution` to make the graphs easier to understand.

## [0.27.0] - 2025-07-21

This update aims to simplify the process of adding new members to the memberlist when they join your guild by bringing a new command. Now when a member joins your guild you can use this one command and just provide their username. No need for copy-pasting IDs anymore.

### Added

-   **New command!** - `/add-username`. Updates the username of the first member in the memberlist that doesn't have a registered username.

## [0.26.0] - 2025-07-20

This patch aims to provide more clarity to users regarding how to use the bot and adds optional rarity filter to `/season-participation`.

### Added

-   `/season-participation` now has an optional rarity filter.
-   `/help` now has link buttons to the support channel and github repository

### Changed

-   `/meta-team-distribution` now has additional information regarding the charts. Hopefully these make them easier to understand.
-   `/help` now has more detailed explanation regarding registering for the bot

## [0.25.0] - 2025-07-17

This update brings more strict definitions of how meta teams are defined in all commands related to meta teams and adds info to relevant commands on whether or not they include side-bosses/primes in their calculations.

### Changed

-   Meta team calculations are now more strict
    -   Required number of meta heroes for it to count as a meta team **3 -> 5**
    -   The admech team now checks for 3 lynchin heroes (Rho, Tan, Actus) instead of just Rho
    -   The intention of the earlier implementation was to allow for some more casual variations that newer players often have, but I have later changed my mind as I don't think the compromise between precision and availability is worth it.
-   More commands now display if sidebosses are included or not in calculations

## [0.24.1] - 2025-07-04

Tiny bugfix that fixes how the time-used command displays the primes for Szarekh. They were previously combined into one due to having the same unit ID, but they now receive their encounter-index added to their name to distinguish them. Thanks to @Nacktbaden for the bug report.

### Fixed

-   `/gr-time-used` now separates the two Menhir sidebosses in the data instead of combining them into one.

## [0.24.0] - 2025-07-03

It is time to make more use of the Player-scope tokens. This update provides a new command that uses the optional Player scope API keys that members or guild leaders can add using the `/add-member` command to show which meta comps members of your guild own.

### Added

-   **New command!** `/meta-comps` - Shows what meta teams players, that have provided a Player-scope API token, have at a minimum rank threshold of your choosing. A player having a meta team is defined as them having the lynchpin hero of that meta team (Ragnar, Rho, Neuro) and at least 5 characters that are part of the meta team or a variation of it. This approach is intended to be a compromise between what is the perfect meta team and the various variations or 'discount' versions that are out there.
    -   Optional param: Rank [Stone, Iron, Bronze, Silver, Gold, Diamond] - The minimum rank all characters of a meta team must be for the bot to consider the player having that team.

### Changed

-   Changed name of command `/get-member-ids` -> `/member-ids` for simplicity.

## [0.23.0] - 2025-07-02

This update brings two new commands; one for seeing the highest damage each member managed to do against a boss in one battle and a utility command to see if players in your guild has registered a Player-scope api token.

### Added

-   **New command!** `/season-highscore` - Displays a graph showing the max damage each member did against each boss in one battle and with what meta team. Also includes a CSV file you can use as a table or open in a program like Excel to see the detailed numbers. The command only shows data for the specified Rarity to make the data possible to display in a reasonable manner.
    -   Required param: season number
    -   Required param: boss rarity
-   **New command!** `/guild-token-status` - Displays a list of your guild members and shows who have a player token registered.

## [0.22.0] - 2025-06-23

This update bring a new command so that you can be more aware what time of the day your players are available to play.

### Added

-   **New command!** `/activity-per-hour` - See when during the day your guild is most active based on data from the current and previous season.

## [0.21.2] - 2025-06-22

The people has spoken and they are wise. All rarities are now in the range 1-5, (L1, L2, ..., L5 etc)

## [0.21.1] - 2025-06-22

Tiny patch this weekend as I've been a bit busy hosting guests of my partner. Going to be moving next week, but I'll try to get at least one update out with some more functionality.

### Changed

-   `/bot-stats` now also shows the count of guilds and guild-member-mappings to display the number of members that are being processed by the bot.
-   Changed visibility of `/help` and `/bot-stats`
-   The instructions on how to register for the bot in the `/help` command now specifies that you don't need to use `/get-member-ids` and `/update-members` if someone in your guild already have done it.

## [0.21.0] - 2025-06-20

This updates provides two new commands for season configs and improvements to existing commands.

### Added

-   **New command!** `/season-bosses` - This command returns a display of the guild raid bosses in the previous 5 guild raid seasons.
    -   Optional parameter: `Rarity` - filter by rarity.
-   **New command!** `/season-same` - Displays the past seasons that has the same guild raid bosses as the provided season.
    -   Required parameter: `season` - The number of the season you want to find a similar raid boss config for.

### Changed

-   Improved the readability and compactness of the `/gr-availability` command to use more emojis over text. Hopefully this makes the command more useful for mobile users.
-   Tweaked pagination limits for `/gr-time-used` to display more data per page if primes are not displayed.
-   Added caps to tokens used in a season and guild members in the average calculations for `/track-member`
-   All displays of guild raid bosses with rarity and number (E3, L1 etc) are now zero-index-based -> the first one is L0 and the fifth legendary boss is L4.
-   The label text for damage dealt in `/season-by-rarity` is changed from being the same as the graph title -> "Total damage"

## [0.20.0] - 2025-06-19

### Added

-   `/gr-time-used` now has an optional parameter `separate-primes` (True/False) which lets you show the time spent on each prime separately to the main boss.

### Fixed

-   Fixed data missing in `/track-member` when Rarity was selected
-   Number of players used to calculate the average damage dealt in a guild is now capped to 30, no matter how many participated in a guild across a season.

### Changed

-   `/gr-time-used` should be more readable and compact:
    -   Fields added to display options selected and time spent between first and last token/bomb used
    -   Discord emojis used to take up less space
    -   Shortened down rarity and loop text

## [0.19.1] - 2025-06-19

### Changed

-   Averages in `/track-member` now include one decimal point.

### Fixed

-   Now uses userIDs to calculate averages in `/track-member` instead of username. Using username in older seasons with members who have left led to a lot of members being grouped under the name "Unknown", causing our elite 'player' Unknown to having a total number of tokens way above what's possible.

## [0.19.0] - 2025-06-18

This update brings two new commands and some minor usability improvements.

### Added

-   New command: `/track-member` - Lets you track the performance of one member in relation to the guild average over multiple seasons.
    -   Required parameter: username - The username as it is displayed in-game of the member you want to check.
    -   Optional parameter: Rarity - Lets you filter the data by rarity and display more detailed stats for the individual guild bosses at that rarity.
    -   Nb! There is no way for the bot to know how many users the guild had in prior seasons, only who participated. For most people this will be everyone, but some variations in the average value can occur in comparison to other commands who include inactive players.
-   New command: `/test-token` - A simple test of your registered API token with (co-)leader permissions and Raid+Guild scope. No parameters required.

### Changed

-   `/register` now explains that you don't need to register guild-member usernames if someone in your guild has already done it.
-   Minor changes to logging of HTTP error codes returned by the Tacticus API for better debugging

## [0.18.0] - 2025-06-17

I'm back from vacation which means development is back on again.

### Added

-   `/season-tokens` and `/season-bombs` now also displays average value in the chart legend.
-   Trajann is now included in the multi-hit team definition due to the potential variant he is part of.

### Changed

-   `/season-by-rarity` now has the mean/median option and displays a dotted line for the average value
-   Changed the use of average/median -> mean/median to be more mathematically correct.

## [0.17.0] - 2025-06-06

This update provides support for optional usage of the Player-scope API tokens and increases data privacy by deleting stale data (30 day cutoff) from the database.

### Changed

-   `/add-member` now takes in an optional argument of player-api token. This is of course encrypted in the database.
-   `/gr-availability` now checks for existing player API tokens and tries to fetch GR token and bomb status from the API if available. If not, then the old calculations are used.
-   `/gr-availability` now only shows total bombs and tokens for the guild at the bottom. The duplicate bugged me.

### Added

-   Umzug is now used for database migrations
-   A job now looks for stale data in the database every 24 hours. If any data has not been used in 30 days, it gets sent to the incinerator.
-   More input-validation of IDs in commands

## [0.16.3] - 2025-06-06

### Changed

-   Improved `/gr-available` command:
    -   Now includes a warning that token cooldowns may have inherent uncertainty due to data limitations, which may affect cooldown accuracy.
    -   Enhanced embed formatting for the display of total tokens and bombs.

### Fixed

-   `/gr-available` now more accurately estimates token and bomb cooldowns by including data from the previous season in the calculation.

### Other

-   All error and success replies in `/update-members` are now ephemeral, ensuring only the user who initiated the command can see them.

## [0.16.2] - 2025-06-05

### Added

-   `/gr-available` now displays the total tokens and total bombs available in your guild

### Fixed

-   `/gr-available` now includes users who have not participated in guild raids so far in the season

### Known bugs

-   `/gr-available` is currently a little off on token-calculation at the start of a season. I think it normalises fairly quickly as the season goes on. I'll be working on a fix to ensure its accuracy at the beginning of seasons.

## [0.16.1] - 2025-06-02

Quick hotfix to remove a copy-paste related typo. Special thanks to @JRC for the bug-report!

### Changed

-   Changed incorrect use of `bombs` to `tokens` in `/season-tokens` command that was caused by an unfortunate copy-paste accident :clown:

## [0.16.0] - 2025-06-02

This update provides functionality to see how many bombs guild members have used. Also introduces average values for certain graphs. In these cases you can choose between average (mean) or median comparison. Median is recommended if your guild has a lot of variety in its data. Average is recommended for those with less variety.

### Added

-   **New command!** `/season-bombs` - Returns a graph displaying how many bombs each member has used. Also shows the average (either mean or median value) bombs used
    -   Required parameter: season (number)
    -   Optional parameter: average-method (Median or Average)
    -   Bars are colored depending on standard deviation of the average value
-   `/season-participation` now has two new optional parameters and also displays the guild's average damage:
    -   Optional parameter: show-bombs (True/false) - Choose if you want a line displaying number of bombs used in the graph - default: false
    -   Optional parameter: average-method (Median or Average) - default: average

### Changed

-   `/tokens-by-seasons` renamed to `/season-tokens` and now displays a graph instead of table with colored bars based on standard deviation from the average.

## [0.15.0] - 2025-05-30

This gives you more options for management of guild members.

### Added

-   `/add-member` - Add a user-username mapping for your guild
-   `/remove-member` - Remove a user-username mapping in your guild

### Changed

-   `/get-member-ids` - Now includes usernames in the JSON file if they exist.
-   `/seasons` - Changed format to an embed with some more information about the data and the current season
-   All uses of the word 'tier' has been replaced with 'rarity' as it is more intuitive

## [0.14.0] - 2025-05-28

### Added

-   `/bot-stats` - An initial bot stats command that shows the current uptime, count of servers running the bot and the number of registered users. (60 second cooldown).

## [0.13.1] - 2025-05-28

Hotfix of the register command not properly encrypting tokens.

### Fixed

-   `/register` now properly encrypts the token. A limitation I was unaware of it in the database-library I'm using led to my encryption hook not being called on new registrations.

## [0.13.0] - 2025-05-27

This update provides encryption of Tacticus API tokens, including those already registered, with the intent of increasing privacy of users.

### Added

-   CryptoService - A service that performs AES-256-CBC encryption and decryption
-   Use of an external secrets manager for encryption key and other bot-related secrets

## Changed

-   The Tacticus API token column is now encrypted when written to the database and decrypted on database reads
-   Existing API tokens have been encrypted

## [0.12.0] - 2025-05-26

This patch provides a new command that gives more detailed statistics per member in a given season, with the option of exporting it as a .CSV file which can be imported into Excel, Google sheets etc. The patch also improves readability of the availability command.

### Added

-   `/member-stats-per-season` command that provides more detailed stats per member for a given season
    -   Required param: season (number) - The Guild raid season
    -   Optional param: rarity (Rarity) - If you want to filter stats by rarity
    -   Optional param: export (boolean) - Do you want a csv of the data?

### Changed

-   Improves readability of the `/gr-availability` command.
    -   3/3 tokens now leads to a ⚠️ icon
    -   Names are at the end in bold to align all data
    -   Times are now always of the same length
    -   No cooldown now has text the same length of timestamps
    -   Data is sorted based on guild raid tokens

## [0.11.0] - 2025-05-15

### Added

-   Command `/gr-time-used` to see how much time and tokens it took to take down a guild-raid boss

    -   Mandatory season option
    -   Optional rarity option
    -   Pagination

-   Pagination library that extends Discord.js' EmbedBuilder
-   New Data transformation service
-   First testsuite

## [0.10.0] - 2025-05-11

Provides functionality to see your guild's available GR tokens and bombs.

### Changed

-   `/available-bombs-tokens` has changed name to `/gr-availability`

### Fixed

Fixes the incorrect calculation of available guild raid tokens

### Added

Adds cooldown timers for both bombs and guild raid tokens if there are any

## [0.9.1] - 2025-05-09

Temporarily disables the `/available-tokens-bombs` command due to a bug leading to incorrect data.

There is unfortunately no way to calculate this data correctly with just the guild APIs and a solution would require API tokens for each player.

## [0.9.0] - 2025-05-09

Special thanks to `WolfLord 5's` for the feature request.

### Added

-   `/available-tokens-bombs` command that returns a list of users who have bombs or guild raid tokens available

## [0.8.5] - 2025-05-08

`/get-member-ids` result is now only visible to the user who called the command.

## [0.8.4] - 2025-05-08

### Fixed

-   Registering a token when you already have one registered no longer causes a database error

## [0.8.3] - 2025-05-08

Hotfixes to logging errors properly

## [0.8.2] - 2025-05-08

Minor bugfix

## [0.8.1] - 2025-05-08

This patch focuses on improving meta distribution by adding missing meta team members and adding a lynchpin check to the meta distribution calculator.

Special thanks to `Paper404` for useful feedback and help fetching hero IDs for characters I haven't unlocked

## [0.8.0] - 2025-05-06

Minor bugfixes and a new command

## Added

-   `/tokens-by-season` command that returns a list of tokens used by each member in a given guild season. This is pretty much the same as `/inactivity-by-season` with a very high threshold, but is more intuitive as its own command.

## [0.7.2] - 2025-05-06

Refactors how canvases are used to save memory and adds a background and some padding to charts.

## [0.7.1] - 2025-05-06

Fixes breaking bug in the cases where a player is not registered to the guild or has left the guild and is therefore no longer mapped to a username. Graphs now include a listing for 'Unknown' player in these cases.

Adds improved logging for more effective debugging.

Special thanks to `Mr. Squiggles` for notifying about the errors.

## [0.7.0] - 2025-05-06

Homina is now up and running on a dedicated server and should be available to the public at almost all times (some downtime between updates may occur).

### Changed

-   Changed logging to use rolling

### Added

-   A help command
-   A delete command
-   ToS
-   Privacy Policy

## [0.5.0] - 2025-04-28

### Changed

Reworked entirely how player-mappings are handled. Instead of a stupid JSON-file, they are now stored in the database. This means that the bot can be used without users running their own instance :tada: Hopefully Snowprint changes the API to include the username in their API, but this works until then.

### Added

-   A new `/get-member-ids` command that returns a JSON file with your guildmembers' ids and a placeholder value for you to fill out.
-   A new `/update-members`command where you can update your guild's members by providing a JSON file containing userId and username mappings. See the README if you're unsure on how to do this

## [0.4.0] - 2025-04-28

### Added

-   A new `/inactivity-by-season` command that provides an overview of inactive players for a specific season based on a token usage threshold.
    -   **Parameters**:
        -   `season` (required): The season to check (minimum value: 70).
        -   `threshold` (optional): The minimum number of tokens required to be considered active (default: 1, minimum value: 1).
-   Added this changelog. Future updates will be explained here.
