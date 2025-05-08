# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- ## [Unreleased]

### Added

-

### Changed

-

### Fixed

-

### Removed

- -->

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
