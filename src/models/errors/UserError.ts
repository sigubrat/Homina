import { BotError } from "./BotError";

export class UserError extends BotError {}

export class NotRegisteredError extends UserError {
    constructor(
        message = "You are not registered. Use /register first.",
        options?: { context?: Record<string, unknown>; cause?: unknown },
    ) {
        super(message, { code: "NOT_REGISTERED", ...options });
    }
}

export class InvalidInputError extends UserError {
    constructor(
        message: string,
        options?: { context?: Record<string, unknown>; cause?: unknown },
    ) {
        super(message, { code: "INVALID_INPUT", ...options });
    }
}

export class PermissionError extends UserError {
    constructor(
        message: string,
        options?: { context?: Record<string, unknown>; cause?: unknown },
    ) {
        super(message, { code: "PERMISSION_DENIED", ...options });
    }
}

export class NotFoundError extends UserError {
    constructor(
        message: string,
        options?: { context?: Record<string, unknown>; cause?: unknown },
    ) {
        super(message, { code: "NOT_FOUND", ...options });
    }
}
