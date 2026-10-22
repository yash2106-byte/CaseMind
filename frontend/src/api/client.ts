import type { ApiErrorEnvelope, ClientErrorCode } from "../types/api";

export class ApiError extends Error {
    readonly code: ClientErrorCode;
    readonly status: number;
    readonly requestId?: string;

    constructor(code: ClientErrorCode, message: string, status: number, requestId?: string){
        super(message);
        this.name = "ApiError";
        this.code = code;
        this.status = status;
        this.requestId = requestId;
    }

    get displayMessage(): string{
        return this.requestId ? `${this.message} (Request ID: ${this.requestId})` : this.message;
    }

    get retryable(): boolean{
        return (
            this.code === "NETWORK_ERROR" ||
            this.code === "AI_UNAVAILABLE" ||
            this.code === "INTERNAL_ERROR"
        );
    }
}

function baseUrl(): string{
    const url = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if(!url){
        throw new Error("VITE_API_BASE_URL is not defined in the environment variables.");
    }
    return url.replace(/\/+$/, ""); // Remove trailing slashes
}

function isEnvelope(body: unknown): body is ApiErrorEnvelope{
    return(
        typeof body === "object" &&
        body !== null &&
        typeof (body as ApiErrorEnvelope).error === "object" &&
        (body as ApiErrorEnvelope).error !== null &&
        typeof (body as ApiErrorEnvelope).error.message === "string" 
    );
}

interface RequestOptions {
    method?: "GET" | "POST";
    body?: unknown;
    signal?: AbortSignal;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = opts;

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    // Let callers handle aborts (stale-response protection) themselves.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(
      "NETWORK_ERROR",
      "Can't reach the server. Check your connection and try again.",
      0,
    );
    }

    let parsed : unknown = null;
    const text = await res.text();
    if (text){
        try{
            parsed = JSON.parse(text);
        }
        catch {
            parsed = null;
        }
    }
    if (!res.ok) {
        if (isEnvelope(parsed)) {
            const { code, message, requestId } = parsed.error;
            throw new ApiError(code, message, res.status, requestId);
        }
        throw new ApiError("UNKNOWN", "Something went wrong. Please try again.", res.status);
    }
  return parsed as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body, signal }),
};