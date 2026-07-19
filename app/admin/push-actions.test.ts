import { vi, describe, it, expect, beforeEach } from "vitest";

const { authMock, upsertMock, deleteManyMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  upsertMock: vi.fn(),
  deleteManyMock: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { pushSubscription: { upsert: upsertMock, deleteMany: deleteManyMock } },
}));

import { savePushSubscription, removePushSubscription } from "@/app/admin/push-actions";

const goodSub = { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } };

describe("savePushSubscription", () => {
  beforeEach(() => {
    authMock.mockReset();
    upsertMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN", id: "u1" } });
    upsertMock.mockResolvedValue({});
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue({ user: { role: "CLIENT", id: "u2" } });
    await expect(savePushSubscription(goodSub)).rejects.toThrow(/unauthorized/i);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed subscription", async () => {
    const res = await savePushSubscription({ endpoint: "not-a-url" });
    expect(res).toEqual({ ok: false, error: expect.any(String) });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("upserts by endpoint for the signed-in admin", async () => {
    const res = await savePushSubscription(goodSub);
    expect(res).toEqual({ ok: true });
    expect(upsertMock).toHaveBeenCalledWith({
      where: { endpoint: goodSub.endpoint },
      create: { endpoint: goodSub.endpoint, p256dh: "p", auth: "a", userId: "u1" },
      update: { p256dh: "p", auth: "a", userId: "u1" },
    });
  });
});

describe("removePushSubscription", () => {
  beforeEach(() => {
    authMock.mockReset();
    deleteManyMock.mockReset();
    authMock.mockResolvedValue({ user: { role: "ADMIN", id: "u1" } });
    deleteManyMock.mockResolvedValue({ count: 1 });
  });

  it("rejects non-admins", async () => {
    authMock.mockResolvedValue(null);
    await expect(removePushSubscription("https://push.example/abc")).rejects.toThrow(
      /unauthorized/i
    );
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("rejects a non-string endpoint without touching the DB", async () => {
    const res = await removePushSubscription(undefined as unknown as string);
    expect(res).toEqual({ ok: false, error: expect.any(String) });
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("deletes by endpoint", async () => {
    const res = await removePushSubscription("https://push.example/abc");
    expect(res).toEqual({ ok: true });
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example/abc" },
    });
  });
});
