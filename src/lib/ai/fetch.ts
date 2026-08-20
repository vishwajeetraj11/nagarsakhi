export type FetchLike = typeof fetch;

export type FetchWithTimeoutOptions = {
  timeoutMs?: number;
  fetch?: FetchLike;
};

export class ExternalServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ExternalServiceError";
  }
}

/** Fetch with one composed AbortSignal for a caller cancellation and hard timeout. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const fetcher = options.fetch ?? fetch;
  const controller = new AbortController();
  let timedOut = false;

  const abortFromCaller = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) {
    abortFromCaller();
  } else {
    init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Timed out", "TimeoutError"));
  }, timeoutMs);

  try {
    const response = await fetcher(input, { ...init, signal: controller.signal });

    if (!response.ok) {
      throw new ExternalServiceError(
        `External service returned ${response.status}`,
        response.status,
        response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
      );
    }

    return response;
  } catch (error) {
    if (timedOut) {
      throw new ExternalServiceError(`External service timed out after ${timeoutMs}ms`, undefined, true);
    }

    if (error instanceof ExternalServiceError) {
      throw error;
    }

    if (init.signal?.aborted) {
      throw new ExternalServiceError("External service request was cancelled", undefined, false);
    }

    throw new ExternalServiceError(
      error instanceof Error ? `External service request failed: ${error.message}` : "External service request failed",
      undefined,
      true,
    );
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export const readJson = async <T>(response: Response): Promise<T> => {
  try {
    return (await response.json()) as T;
  } catch {
    throw new ExternalServiceError("External service returned invalid JSON", response.status, false);
  }
};
