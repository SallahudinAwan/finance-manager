import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, deleteJson, formatPkr, money } from "./client";

describe("money helpers", () => {
  it("normalizes missing and invalid values", () => {
    expect(money(undefined)).toBe(0);
    expect(money("not-a-number")).toBe(0);
    expect(money("1250.50")).toBe(1250.5);
  });

  it("formats PKR values without decimal noise", () => {
    expect(formatPkr("125000")).toContain("125,000");
  });
});

describe("api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = "csrftoken=; Max-Age=0";
  });

  it("sends same-origin credentials and CSRF for writes", async () => {
    document.cookie = "csrftoken=test-token";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await api<{ ok: boolean }>("/personal-expenses/", {
      method: "POST",
      body: JSON.stringify({ amount: "500" }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/personal-expenses/",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("X-CSRFToken")).toBe("test-token");
  });

  it("raises a typed error with server details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const promise = api("/household/", { method: "PATCH", body: "{}" });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 403,
      details: { detail: "Forbidden" },
    });
  });

  it("sends authenticated CSRF-protected deletes", async () => {
    document.cookie = "csrftoken=delete-token";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await deleteJson("/ledger/42/");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ledger/42/",
      expect.objectContaining({ credentials: "include", method: "DELETE" }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get("X-CSRFToken")).toBe("delete-token");
  });
});
