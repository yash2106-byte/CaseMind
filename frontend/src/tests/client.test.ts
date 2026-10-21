import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { api, ApiError } from "../api/client";
import { server } from "../mocks/server";
import { API } from "../mocks/handlers";
import type { CustomerResponses } from "../types/api";

async function expectApiError(request: Promise<unknown>): Promise<ApiError> {
  try {
    await request;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected the API request to fail");
}

describe("api client", () => {
  it("parses a successful JSON response", async () => {
    const data = await api.get<CustomerResponses>("/customers");
    expect(data.customers).toHaveLength(3);
  });

  it("maps the standard error envelope to ApiError", async () => {
    server.use(
      http.post(`${API}/sessions`, () =>
        HttpResponse.json(
          { error: { code: "AI_UNAVAILABLE", message: "The assistant is temporarily unavailable. Please try again.", requestId: "req-1" } },
          { status: 503 },
        ),
      ),
    );
    const err = await expectApiError(api.post("/sessions", {}));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("AI_UNAVAILABLE");
    expect(err.requestId).toBe("req-1");
    expect(err.retryable).toBe(true);
    expect(err.displayMessage).toContain("req-1");
  });

  it("handles non-JSON error bodies without leaking details", async () => {
    server.use(http.get(`${API}/customers`, () => new HttpResponse("<h1>boom</h1>", { status: 500 })));
    const err = await expectApiError(api.get("/customers"));
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).not.toContain("boom");
  });

  it("converts network failure to a retryable NETWORK_ERROR", async () => {
    server.use(http.get(`${API}/customers`, () => HttpResponse.error()));
    const err = await expectApiError(api.get("/customers"));
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.retryable).toBe(true);
  });
});