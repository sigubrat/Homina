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
