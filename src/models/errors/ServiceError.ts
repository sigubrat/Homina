import { BotError } from "./BotError";

export class ServiceError extends BotError {}

export class DatabaseError extends ServiceError {
    constructor(
        message: string,
        options?: { context?: Record<string, unknown>; cause?: unknown },
    ) {
        super(message, { code: "DB_ERROR", ...options });
    }
}

export class ExternalApiError extends ServiceError {
    constructor(
        message: string,
        options?: { context?: Record<string, unknown>; cause?: unknown },
    ) {
        super(message, { code: "API_ERROR", ...options });
    }
}
