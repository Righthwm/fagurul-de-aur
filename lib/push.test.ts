import { vi, describe, it, expect, beforeEach } from "vitest";

const { sendNotificationMock, setVapidMock, findManyMock, deleteMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
  setVapidMock: vi.fn(),
  findManyMock: vi.fn(),
  deleteMock: vi.fn(),
}));
vi.mock("web-push", () => ({
  default: { setVapidDetails: setVapidMock, sendNotification: sendNotificationMock },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { pushSubscription: { findMany: findManyMock, delete: deleteMock } },
}));

import { sendNewOrderPush } from "@/lib/push";

const sub = (endpoint: string) => ({ endpoint, p256dh: "p", auth: "a" });

describe("sendNewOrderPush", () => {
  beforeEach(() => {
    sendNotificationMock.mockReset();
    setVapidMock.mockReset();
    findManyMock.mockReset();
    deleteMock.mockReset();
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    findManyMock.mockResolvedValue([sub("https://push/1"), sub("https://push/2")]);
    sendNotificationMock.mockResolvedValue({});
    deleteMock.mockResolvedValue({});
  });

  it("is a silent no-op without VAPID keys", async () => {
    process.env.VAPID_PUBLIC_KEY = "";
    await sendNewOrderPush({ orderId: "SB-1", total: 100 });
    expect(findManyMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("sends the order payload to every admin subscription", async () => {
    await sendNewOrderPush({ orderId: "SB-1", total: 145 });
    expect(findManyMock).toHaveBeenCalledWith({ where: { user: { role: "ADMIN" } } });
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    const [subArg, payload] = sendNotificationMock.mock.calls[0];
    expect(subArg).toEqual({ endpoint: "https://push/1", keys: { p256dh: "p", auth: "a" } });
    expect(JSON.parse(payload as string)).toMatchObject({
      body: "SB-1 — 145 lei",
      url: "/admin/comenzi",
    });
  });

  it.each([404, 410])(
    "deletes a subscription the push service reports gone (%i) and still sends the rest",
    async (statusCode) => {
      sendNotificationMock
        .mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode }))
        .mockResolvedValueOnce({});
      await sendNewOrderPush({ orderId: "SB-2", total: 50 });
      expect(deleteMock).toHaveBeenCalledWith({ where: { endpoint: "https://push/1" } });
      expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    }
  );

  it("never throws on other send errors", async () => {
    sendNotificationMock.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    await expect(sendNewOrderPush({ orderId: "SB-3", total: 10 })).resolves.toBeUndefined();
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
