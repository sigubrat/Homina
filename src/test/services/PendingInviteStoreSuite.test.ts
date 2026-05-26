import { describe, expect, test } from "bun:test";
import {
    createPendingInvite,
    consumePendingInvite,
    deletePendingInvite,
    pruneExpiredInvites,
} from "@/lib/services/PendingInviteStore";

describe("PendingInviteStore", () => {
    test("createPendingInvite returns a nonce string", () => {
        const nonce = createPendingInvite(
            "token-123",
            "inviter-1",
            "invitee-1",
        );
        expect(typeof nonce).toBe("string");
        expect(nonce.length).toBeGreaterThan(0);
    });

    test("consumePendingInvite returns the stored invite data", () => {
        const nonce = createPendingInvite(
            "token-abc",
            "inviter-2",
            "invitee-2",
        );
        const invite = consumePendingInvite(nonce);

        expect(invite).not.toBeNull();
        expect(invite!.apiToken).toBe("token-abc");
        expect(invite!.inviterId).toBe("inviter-2");
        expect(invite!.inviteeId).toBe("invitee-2");
    });

    test("consumePendingInvite removes the invite (single-use)", () => {
        const nonce = createPendingInvite(
            "token-xyz",
            "inviter-3",
            "invitee-3",
        );

        const first = consumePendingInvite(nonce);
        expect(first).not.toBeNull();

        const second = consumePendingInvite(nonce);
        expect(second).toBeNull();
    });

    test("consumePendingInvite returns null for unknown nonce", () => {
        const result = consumePendingInvite("nonexistent-nonce");
        expect(result).toBeNull();
    });

    test("deletePendingInvite removes the invite", () => {
        const nonce = createPendingInvite(
            "token-del",
            "inviter-4",
            "invitee-4",
        );

        deletePendingInvite(nonce);

        const result = consumePendingInvite(nonce);
        expect(result).toBeNull();
    });

    test("consumePendingInvite returns null for expired invites", () => {
        const nonce = createPendingInvite(
            "token-exp",
            "inviter-5",
            "invitee-5",
        );

        // Manually expire by manipulating Date.now
        const originalNow = Date.now;
        Date.now = () => originalNow() + 16 * 60 * 1000; // 16 minutes later

        const result = consumePendingInvite(nonce);
        expect(result).toBeNull();

        Date.now = originalNow;
    });

    test("pruneExpiredInvites removes only expired entries", () => {
        const nonce1 = createPendingInvite("token-p1", "inv-6", "invitee-6");
        const nonce2 = createPendingInvite("token-p2", "inv-7", "invitee-7");

        // Expire nonce1 by advancing time
        const originalNow = Date.now;
        Date.now = () => originalNow() + 16 * 60 * 1000;

        pruneExpiredInvites();

        // Both should be pruned since both were created at similar time
        const result1 = consumePendingInvite(nonce1);
        const result2 = consumePendingInvite(nonce2);
        expect(result1).toBeNull();
        expect(result2).toBeNull();

        Date.now = originalNow;
    });

    test("each nonce is unique", () => {
        const nonce1 = createPendingInvite("tok1", "inv1", "target1");
        const nonce2 = createPendingInvite("tok2", "inv2", "target2");
        expect(nonce1).not.toBe(nonce2);
    });
});
