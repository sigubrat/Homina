import { randomUUID } from "crypto";

export interface PendingInvite {
    apiToken: string;
    inviterId: string;
    inviteeId: string;
    expiresAt: number;
}

const INVITE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const store = new Map<string, PendingInvite>();

export function createPendingInvite(
    apiToken: string,
    inviterId: string,
    inviteeId: string,
): string {
    const nonce = randomUUID();
    store.set(nonce, {
        apiToken,
        inviterId,
        inviteeId,
        expiresAt: Date.now() + INVITE_TTL_MS,
    });
    return nonce;
}

export function consumePendingInvite(nonce: string): PendingInvite | null {
    const invite = store.get(nonce);
    if (!invite) return null;

    store.delete(nonce);

    if (Date.now() > invite.expiresAt) {
        return null;
    }

    return invite;
}

export function deletePendingInvite(nonce: string): void {
    store.delete(nonce);
}

/** Remove all expired entries. Called periodically or on access. */
export function pruneExpiredInvites(): void {
    const now = Date.now();
    for (const [key, value] of store) {
        if (now > value.expiresAt) {
            store.delete(key);
        }
    }
}
