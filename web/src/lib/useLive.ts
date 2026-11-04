"use client";

import { useEffect, useState } from "react";
import { MOCK_MODE } from "./near";

export type LiveSource = "live" | "mock";

export interface LiveState<T> {
  data: T | null;
  source: LiveSource;
  loading: boolean;
  error: string | null;
}

// Client-side read-only fetcher with a truthful LIVE/mock indicator.
//
// - NEXT_PUBLIC_MOCK=1  -> never hits the network; uses `mock`.
// - otherwise           -> calls `fetcher`; on ANY failure, falls back to
//                          `mock` and reports source:"mock" + the error.
//
// Runs only in useEffect (client), so the static build is never blocked.
export function useLive<T>(
  fetcher: () => Promise<T>,
  mock: T,
  deps: unknown[] = []
): LiveState<T> {
  const [state, setState] = useState<LiveState<T>>({
    data: MOCK_MODE ? mock : null,
    source: "mock",
    loading: !MOCK_MODE,
    error: null,
  });

  useEffect(() => {
    if (MOCK_MODE) {
      setState({ data: mock, source: "mock", loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (cancelled) return;
        setState({ data, source: "live", loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          data: mock,
          source: "mock",
          loading: false,
          error: e instanceof Error ? e.message : "live call failed",
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
