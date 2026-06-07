export abstract class BotError extends Error {
    readonly code: string;
    readonly context?: Record<string, unknown>;

    constructor(
        message: string,
        options?: {
            code?: string;
            context?: Record<string, unknown>;
            cause?: unknown;
        },
    ) {
        super(message, { cause: options?.cause });
        this.name = this.constructor.name;
        this.code = options?.code ?? "BOT_ERROR";
        this.context = options?.context;
    }
}
