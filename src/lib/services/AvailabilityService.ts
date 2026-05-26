import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController, logger } from "@/lib";
import {
    SecondsToString,
    evaluateToken,
    getUnixTimestamp,
} from "../utils/timeUtils";
import { DamageType, Rarity } from "@/models/enums";
import type {
    GuildRaidAvailable,
    Raid,
    TokensAndBombs,
    TokenStatus,
} from "@/models/types";
import { GuildService } from "./GuildService";

export class AvailabilityService {
    private client: HominaTacticusClient;
    private db: DatabaseController;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
    }

    async getAvailableTokensAndBombs(discordId: string) {
        const TOKENCOOLDOWNINSECONDS = 12 * 60 * 60;
        const BOMBCOOLDOWNINSECONDS = 18 * 60 * 60;
        const BOMBCOOLDOWNHOURS = 18;
        const MAXTOKENS = 3;
        const now = new Date();

        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!resp || !resp.entries) {
                return null;
            }

            const prevSeason = await this.client.getGuildRaidBySeason(
                apiKey,
                resp.season - 1,
            );

            const sortedEntries = prevSeason.entries
                .filter((e) => e.damageType !== DamageType.BOMB)
                .sort((a, b) => b.startedOn - a.startedOn);

            if (!prevSeason || !prevSeason.entries) {
                return null;
            }

            const prevUsers = new Set<string>();

            for (const prevEntry of sortedEntries) {
                if (prevEntry.damageType === DamageType.BOMB) {
                    continue;
                }
                prevUsers.add(prevEntry.userId);
            }

            const guildService = new GuildService(this.client);
            const guildId = await guildService.getGuildId(discordId);
            if (!guildId) {
                return null;
            }

            const currentMembersArr =
                await guildService.getGuildMembers(discordId);
            if (!currentMembersArr || currentMembersArr.length === 0) {
                return null;
            }

            const currentMembers = new Set(currentMembersArr);

            const formerMembers = new Set(
                Array.from(prevUsers).filter(
                    (prevId) => !currentMembers.has(prevId),
                ),
            );

            const entries = resp.entries;
            const combinedEntries = entries.concat(prevSeason.entries);

            const users: Record<string, TokensAndBombs> = {};

            for (const entry of combinedEntries) {
                if (formerMembers.has(entry.userId)) {
                    continue;
                }

                const id = entry.userId;

                if (!users[id]) {
                    users[id] = {
                        tokens: [],
                        bombs: [],
                    };
                }

                if (entry.damageType === DamageType.BOMB) {
                    users[id]?.bombs.push(entry);
                } else {
                    users[id]?.tokens.push(entry);
                }
            }

            const result: Record<string, GuildRaidAvailable> = {};

            await Promise.all(
                Object.entries(users).map(async ([userId, data]) => {
                    const temp: GuildRaidAvailable = {
                        tokens: MAXTOKENS,
                        bombs: 1,
                    };

                    const mostRecentBomb = data.bombs
                        .sort((a, b) => b.startedOn - a.startedOn)
                        .find(() => true);

                    if (mostRecentBomb) {
                        const diff =
                            getUnixTimestamp(now) - mostRecentBomb.startedOn;
                        const diffHours = Math.floor(diff / 3600);
                        if (diffHours < BOMBCOOLDOWNHOURS) {
                            temp.bombs = 0;
                            temp.bombCooldown = SecondsToString(
                                BOMBCOOLDOWNINSECONDS - diff,
                            );
                        } else {
                            temp.bombCooldown = SecondsToString(
                                diff - BOMBCOOLDOWNINSECONDS,
                                true,
                            );
                        }
                    }

                    const sortedTokensAsc = data.tokens.sort(
                        (a, b) => a.startedOn - b.startedOn,
                    );

                    const initialTimestamp =
                        sortedTokensAsc[0]?.startedOn ?? getUnixTimestamp(now);
                    let token: TokenStatus = {
                        refreshTime: initialTimestamp,
                        count: 2,
                    };

                    sortedTokensAsc
                        .filter((raid) => raid.startedOn !== null)
                        .forEach((raid) => {
                            token = evaluateToken(token, raid.startedOn);
                            token.count--;
                            if (token.count < 0) {
                                token.count = 0;
                                token.refreshTime = raid.startedOn;
                            }
                        });

                    token = evaluateToken(token, getUnixTimestamp(now));
                    if (token.count < MAXTOKENS) {
                        const tokenDiff =
                            getUnixTimestamp(now) - token.refreshTime;
                        temp.tokenCooldown = SecondsToString(
                            TOKENCOOLDOWNINSECONDS - tokenDiff,
                        );
                    }
                    temp.tokens = token.count;
                    result[userId] = temp;
                }),
            );

            return result;
        } catch (error) {
            logger.error(error, "Error fetching available tokens and bombs: ");
            return null;
        }
    }

    async getAvailableBombs(discordId: string) {
        const BOMBCOOLDOWNINSECONDS = 18 * 60 * 60;
        const BOMBCOOLDOWNHOURS = 18;
        const now = new Date();

        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidByCurrentSeason(apiKey);

            if (!resp || !resp.entries) {
                return null;
            }

            const userBombs: Record<string, Raid[]> = {};

            for (const entry of resp.entries) {
                if (entry.damageType !== DamageType.BOMB) continue;
                userBombs[entry.userId] = userBombs[entry.userId] || [];
                userBombs[entry.userId]?.push(entry);
            }

            const result: Record<string, GuildRaidAvailable> = {};

            for (const [userId, bombs] of Object.entries(userBombs)) {
                const temp: GuildRaidAvailable = {
                    tokens: 3,
                    bombs: 1,
                };

                const mostRecentBomb = bombs
                    .sort((a, b) => b.startedOn - a.startedOn)
                    .find(() => true);

                if (mostRecentBomb) {
                    const diff =
                        getUnixTimestamp(now) - mostRecentBomb.startedOn;
                    const diffHours = Math.floor(diff / 3600);
                    if (diffHours < BOMBCOOLDOWNHOURS) {
                        temp.bombs = 0;
                        temp.bombCooldown = SecondsToString(
                            BOMBCOOLDOWNINSECONDS - diff,
                        );
                    } else {
                        temp.bombCooldown = SecondsToString(
                            diff - BOMBCOOLDOWNINSECONDS,
                            true,
                        );
                    }
                }

                result[userId] = temp;
            }

            return result;
        } catch (error) {
            logger.error(error, "Error fetching user bombs: ");
            return null;
        }
    }

    async getPlayerCooldowns(token: string) {
        try {
            const resp = await this.client.getPlayer(token);
            if (!resp || !resp.player) {
                return null;
            }

            const player = resp.player;
            const status: GuildRaidAvailable = {
                tokens: player.progress.guildRaid?.tokens.current || 0,
                bombs: player.progress.guildRaid?.bombTokens.current || 0,
                tokenCooldown: player.progress.guildRaid?.tokens
                    .nextTokenInSeconds
                    ? SecondsToString(
                          player.progress.guildRaid.tokens.nextTokenInSeconds,
                      )
                    : undefined,
                bombCooldown: player.progress.guildRaid?.bombTokens
                    .nextTokenInSeconds
                    ? SecondsToString(
                          player.progress.guildRaid.bombTokens
                              .nextTokenInSeconds,
                      )
                    : undefined,
            };

            return status;
        } catch (error) {
            logger.error(error, "Error fetching player cooldowns: ");
            return null;
        }
    }

    async getAvailableTokensAndBombsWithMetadata(discordId: string) {
        try {
            const guildService = new GuildService(this.client);
            const guildId = await guildService.getGuildId(discordId);
            if (!guildId) return null;

            const metadata = await this.db.getAllPlayerMetadataByGuild(guildId);
            const playerTokenMap = new Map<string, string>();
            for (const entry of metadata) {
                if (entry.playerToken) {
                    playerTokenMap.set(entry.userId, entry.playerToken);
                }
            }

            if (playerTokenMap.size === 0) {
                return this.getAvailableTokensAndBombs(discordId);
            }

            const estimated = await this.getAvailableTokensAndBombs(discordId);
            if (!estimated) return null;

            await Promise.all(
                Array.from(playerTokenMap.entries()).map(
                    async ([userId, playerToken]) => {
                        try {
                            const precise =
                                await this.getPlayerCooldowns(playerToken);
                            if (precise) {
                                estimated[userId] = precise;
                            }
                        } catch {
                            // Fallback to estimated data if player token fails
                        }
                    },
                ),
            );

            return estimated;
        } catch (error) {
            logger.error(
                error,
                "Error fetching metadata-aware tokens and bombs",
            );
            return null;
        }
    }

    async getAvailableBombsWithMetadata(discordId: string) {
        try {
            const guildService = new GuildService(this.client);
            const guildId = await guildService.getGuildId(discordId);
            if (!guildId) return null;

            const metadata = await this.db.getAllPlayerMetadataByGuild(guildId);
            const playerTokenMap = new Map<string, string>();
            for (const entry of metadata) {
                if (entry.playerToken) {
                    playerTokenMap.set(entry.userId, entry.playerToken);
                }
            }

            if (playerTokenMap.size === 0) {
                return this.getAvailableBombs(discordId);
            }

            const estimated = await this.getAvailableBombs(discordId);
            if (!estimated) return null;

            await Promise.all(
                Array.from(playerTokenMap.entries()).map(
                    async ([userId, playerToken]) => {
                        try {
                            const precise =
                                await this.getPlayerCooldowns(playerToken);
                            if (precise) {
                                estimated[userId] = precise;
                            }
                        } catch {
                            // Fallback to estimated data if player token fails
                        }
                    },
                ),
            );

            return estimated;
        } catch (error) {
            logger.error(error, "Error fetching metadata-aware bombs");
            return null;
        }
    }
}
