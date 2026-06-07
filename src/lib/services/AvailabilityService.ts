import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController } from "@/lib";
import { resolveGuildId } from "@/lib/utils/guildMemberUtils";
import {
    SecondsToString,
    evaluateToken,
    getUnixTimestamp,
} from "../utils/timeUtils";
import { DamageType, EncounterType } from "@/models/enums";
import { BotError } from "@/models/errors/BotError";
import { DatabaseError, ExternalApiError } from "@/models/errors/ServiceError";
import { NotRegisteredError } from "@/models/errors/UserError";
import type {
    GuildRaidAvailable,
    Raid,
    TokensAndBombs,
    TokenStatus,
} from "@/models/types";

export class AvailabilityService {
    private client: HominaTacticusClient;
    private db: DatabaseController;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
    }

    private async getGuildId(discordId: string): Promise<string> {
        return resolveGuildId(discordId, this.client, this.db);
    }

    private async getGuildMembers(discordId: string): Promise<string[]> {
        let apiKey: string | null;
        try {
            apiKey = await this.db.getUserToken(discordId);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new DatabaseError("Failed to retrieve API token", {
                cause: error,
                context: { discordId },
            });
        }
        if (!apiKey) throw new NotRegisteredError();

        const resp = await this.client.getGuild(apiKey);
        if (!resp.success || !resp.guild) {
            throw new ExternalApiError("Guild fetch returned unsuccessful response", {
                context: { discordId },
            });
        }

        return resp.guild.members.map((member) => member.userId);
    }

    async getAvailableTokensAndBombs(discordId: string) {
        const TOKENCOOLDOWNINSECONDS = 12 * 60 * 60;
        const BOMBCOOLDOWNINSECONDS = 18 * 60 * 60;
        const BOMBCOOLDOWNHOURS = 18;
        const MAXTOKENS = 3;
        const now = new Date();

        try {
            let apiKey: string | null;
            try {
                apiKey = await this.db.getUserToken(discordId);
            } catch (error) {
                if (error instanceof BotError) throw error;
                throw new DatabaseError("Failed to retrieve API token", {
                    cause: error,
                    context: { discordId },
                });
            }
            if (!apiKey) throw new NotRegisteredError();

            const resp = await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!resp || !resp.entries) {
                throw new ExternalApiError("No current season data returned", {
                    context: { discordId },
                });
            }

            const prevSeason = await this.client.getGuildRaidBySeason(
                apiKey,
                resp.season - 1,
            );

            if (!prevSeason || !prevSeason.entries) {
                throw new ExternalApiError("No previous season data returned", {
                    context: { discordId },
                });
            }

            const sortedEntries = prevSeason.entries
                .filter((e) => e.damageType !== DamageType.BOMB)
                .sort((a, b) => b.startedOn - a.startedOn);

            const prevUsers = new Set<string>();

            for (const prevEntry of sortedEntries) {
                if (prevEntry.damageType === DamageType.BOMB) {
                    continue;
                }
                prevUsers.add(prevEntry.userId);
            }

            const currentMembersArr = await this.getGuildMembers(discordId);

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
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch available tokens and bombs", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getAvailableBombs(discordId: string) {
        const BOMBCOOLDOWNINSECONDS = 18 * 60 * 60;
        const BOMBCOOLDOWNHOURS = 18;
        const now = new Date();

        try {
            let apiKey: string | null;
            try {
                apiKey = await this.db.getUserToken(discordId);
            } catch (error) {
                if (error instanceof BotError) throw error;
                throw new DatabaseError("Failed to retrieve API token", {
                    cause: error,
                    context: { discordId },
                });
            }
            if (!apiKey) throw new NotRegisteredError();

            const resp = await this.client.getGuildRaidByCurrentSeason(apiKey);

            if (!resp || !resp.entries) {
                throw new ExternalApiError("No current season data returned", {
                    context: { discordId },
                });
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
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch available bombs", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getPlayerCooldowns(token: string) {
        try {
            const resp = await this.client.getPlayer(token);
            if (!resp || !resp.player) {
                throw new ExternalApiError("Player API returned no player data", {
                    context: {},
                });
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
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch player cooldowns", {
                cause: error,
            });
        }
    }

    async getAvailableTokensAndBombsWithMetadata(discordId: string) {
        try {
            const guildId = await this.getGuildId(discordId);

            let metadata: Awaited<ReturnType<typeof this.db.getAllPlayerMetadataByGuild>>;
            try {
                metadata = await this.db.getAllPlayerMetadataByGuild(guildId);
            } catch (error) {
                if (error instanceof BotError) throw error;
                throw new DatabaseError("Failed to fetch player metadata", {
                    cause: error,
                    context: { guildId },
                });
            }

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
                            // Fallback to estimated data if individual player token fails
                        }
                    },
                ),
            );

            return estimated;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch metadata-aware tokens and bombs", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getAvailableBombsWithMetadata(discordId: string) {
        try {
            const guildId = await this.getGuildId(discordId);

            let metadata: Awaited<ReturnType<typeof this.db.getAllPlayerMetadataByGuild>>;
            try {
                metadata = await this.db.getAllPlayerMetadataByGuild(guildId);
            } catch (error) {
                if (error instanceof BotError) throw error;
                throw new DatabaseError("Failed to fetch player metadata", {
                    cause: error,
                    context: { guildId },
                });
            }

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
                            // Fallback to estimated data if individual player token fails
                        }
                    },
                ),
            );

            return estimated;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch metadata-aware bombs", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getCurrentBossUnits(discordId: string): Promise<
        | {
              unitId: string;
              remainingHp: number;
              encounterType: EncounterType;
              type: string;
          }[]
        | null
    > {
        try {
            let apiKey: string | null;
            try {
                apiKey = await this.db.getUserToken(discordId);
            } catch (error) {
                if (error instanceof BotError) throw error;
                throw new DatabaseError("Failed to retrieve API token", {
                    cause: error,
                    context: { discordId },
                });
            }
            if (!apiKey) throw new NotRegisteredError();

            const resp = await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!resp || !resp.entries || resp.entries.length === 0)
                return null;

            const entries = resp.entries;

            const mostRecent = entries.reduce((a, b) =>
                a.startedOn > b.startedOn ? a : b,
            );
            const currentType = mostRecent.type;

            const currentTypeEntries = entries.filter(
                (e) => e.type === currentType,
            );

            const unitMap = new Map<string, Raid>();
            for (const entry of currentTypeEntries) {
                const existing = unitMap.get(entry.unitId);
                if (!existing || entry.startedOn > existing.startedOn) {
                    unitMap.set(entry.unitId, entry);
                }
            }

            if (mostRecent.encounterType === EncounterType.SIDE_BOSS) {
                for (const [key, e] of unitMap) {
                    if (
                        e.encounterType === EncounterType.BOSS &&
                        e.remainingHp === 0
                    ) {
                        unitMap.delete(key);
                    }
                }
            }

            return Array.from(unitMap.values()).map((e) => ({
                unitId: e.unitId,
                remainingHp: e.remainingHp,
                encounterType: e.encounterType,
                type: e.type,
            }));
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch current boss units", {
                cause: error,
                context: { discordId },
            });
        }
    }
}
