import HominaTacticusClient from "../../../../common/src/client/tacticus-client";
import { dbHandler } from "../../../../common/src/lib/db_handler";

export async function getGuildSeasons(
    userId: string
): Promise<number[] | null> {
    try {
        const apiKey = await dbHandler.getUserToken(userId);
        if (!apiKey) {
            return null;
        }

        const client = new HominaTacticusClient();

        const resp = await client.getGuild(apiKey);

        console.log("GuildService.getGuildSeasons - resp:", resp);

        if (!resp.success || !resp.guild) {
            return null;
        }

        return resp.guild.guildRaidSeasons;
    } catch (error) {
        console.error("Error fetching guild seasons:", error);
        return null;
    }
}
