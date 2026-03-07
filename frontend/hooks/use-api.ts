"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseApiOptions<T> {
  /** Initial data before first fetch */
  initialData?: T;
  /** Skip automatic fetch on mount */
  skip?: boolean;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  mutate: (newData: T) => void;
}

/**
 * Generic hook for GET requests to internal API routes.
 * Handles loading, error, and abort-on-unmount.
 */
export function useApi<T>(
  url: string,
  options?: UseApiOptions<T>
): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(options?.initialData ?? null);
  const [loading, setLoading] = useState(!options?.skip);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      console.error(`useApi(${url}):`, message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!options?.skip) {
      fetchData();
    }
    return () => abortRef.current?.abort();
  }, [fetchData, options?.skip]);

  return { data, loading, error, refetch: fetchData, mutate: setData };
}

interface UseMutationReturn<TBody, TResponse> {
  mutate: (body?: TBody) => Promise<TResponse | null>;
  loading: boolean;
  error: string | null;
}

/**
 * Generic hook for POST/PUT/PATCH/DELETE requests.
 */
export function useMutation<TBody = unknown, TResponse = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST"
): UseMutationReturn<TBody, TResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body?: TBody): Promise<TResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `Request failed (${res.status})`);
        }
        const json = await res.json();
        return json as TResponse;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        setError(message);
        console.error(`useMutation(${method} ${url}):`, message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [url, method]
  );

  return { mutate, loading, error };
}
