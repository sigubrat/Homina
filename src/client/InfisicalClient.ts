import { logger, validateEnvVars } from "@/lib";

interface InfiscalLoginResponse {
    accessToken: string;
    expiresIn: number;
    tokenType: string;
}

interface InfisicalSecretResponse {
    secrets: {
        id: string;
        _id: string;
        workspace: string;
        environment: string;
        version: number;
        type: string;
        secretKey: string;
        secretValue: string;
        secretComment: string;
        secretReminderNote: string | null;
        secretReminderRepeatDays: number | null;
        skipMultilineEncoding: boolean;
        createdAt: string;
        updatedAt: string;
        secretValueHidden: boolean;
        tags: any[];
        secretMetadata: any[];
    }[];
}

export class InfisicalClient {
    private baseUrl: string = "https://app.infisical.com/api/";
    private token: string | undefined;

    constructor() {}

    public async init() {
        validateEnvVars(["INFISICAL_SECRET", "INFISICAL_ID"]);
        const secret = process.env.INFISICAL_SECRET!;
        const id = process.env.INFISICAL_ID!;

        await this.login(id, secret);
    }

    private async login(clientId: string, clientSecret: string) {
        console.log("Logging in to Infisical...");
        const url = this.baseUrl + "v1/auth/universal-auth/login";
        const params = new URLSearchParams();
        params.append("clientSecret", clientSecret);
        params.append("clientId", clientId);

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
            });

            if (!response.ok) {
                throw new Error(`Login failed: ${response.statusText}`);
            }

            const data = (await response.json()) as InfiscalLoginResponse;
            this.token = data.accessToken;

            console.log(
                `Logged in to Infisical as ${clientId}. Token expires in ${data.expiresIn} seconds.`
            );
        } catch (error) {
            console.error("Error logging in to Infisical:", error);
            logger.error(
                error,
                "Failed to log in to Infisical. Please check your credentials."
            );
            throw error;
        }
    }

    async fetchSecrets() {
        if (!this.token) {
            throw new Error(
                "Client is not authenticated. Please call init() first."
            );
        }
        validateEnvVars(["INFISICAL_WORKSPACE", "NODE_ENV"]);

        const workspaceId = process.env.INFISICAL_WORKSPACE!;
        const environment = process.env.NODE_ENV!;

        const url = `${
            this.baseUrl
        }v3/secrets/raw/?workspaceId=${encodeURIComponent(
            workspaceId
        )}&environment=${encodeURIComponent(environment)}`;
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch raw secret: ${response.statusText}`
                );
            }

            const data = (await response.json()) as InfisicalSecretResponse;
            if (!data.secrets || data.secrets.length === 0) {
                throw new Error("Secret value is empty or undefined.");
            }

            const secrets = data.secrets;

            // Set environment variables from the fetched secrets
            const encryptionKey = secrets.find(
                (s) => s.secretKey === "encryption"
            )?.secretValue;

            if (!encryptionKey) {
                throw new Error("Encryption key not found in secrets.");
            }

            process.env.ENCRYPTION_KEY = encryptionKey;

            const botToken = secrets.find(
                (s) => s.secretKey === "bot_token"
            )?.secretValue;
            if (!botToken) {
                throw new Error("Bot token not found in secrets.");
            }

            const discordClientId = secrets.find(
                (s) => s.secretKey === "discord_client_id"
            )?.secretValue;
            if (!discordClientId) {
                throw new Error("Discord client ID not found in secrets.");
            }

            process.env.CLIENT_ID = discordClientId;

            const discordGuildId = secrets.find(
                (s) => s.secretKey === "discord_guild_id"
            )?.secretValue;
            if (!discordGuildId) {
                throw new Error("Discord guild ID not found in secrets.");
            }
            process.env.GUILD_ID = discordGuildId;

            process.env.BOT_TOKEN = botToken;

            console.log("Secrets fetched and environment variables set.");
        } catch (error) {
            logger.error(error, "Failed to fetch raw secret from Infisical.");
            throw error;
        }
    }
}
