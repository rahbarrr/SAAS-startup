"use client";

import { useEffect, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export type GoogleMapsStatus = "unconfigured" | "loading" | "ready" | "error";

export interface UseGoogleMapsResult {
  status: GoogleMapsStatus;
  error: string | null;
  google: typeof google | null;
}

let optionsConfigured = false;
let sharedPromise: Promise<typeof google> | null = null;

async function loadGoogleMapsLibraries(apiKey: string): Promise<typeof google> {
  if (typeof window !== "undefined" && window.google?.maps?.places) {
    return window.google;
  }

  if (!optionsConfigured) {
    setOptions({
      key: apiKey,
      v: "weekly",
    });
    optionsConfigured = true;
  }

  if (!sharedPromise) {
    sharedPromise = (async () => {
      await Promise.all([importLibrary("maps"), importLibrary("places")]);
      return window.google;
    })();
  }

  return sharedPromise;
}

/**
 * Resilient hook for loading Google Maps JavaScript API with Places library
 * using the current recommended Google functional importLibrary approach.
 * Gracefully reports "unconfigured" when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.
 */
export function useGoogleMaps(): UseGoogleMapsResult {
  const apiKey =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
      : undefined;

  const [status, setStatus] = useState<GoogleMapsStatus>(() => {
    if (!apiKey) return "unconfigured";
    if (typeof window !== "undefined" && window.google?.maps?.places) return "ready";
    return "loading";
  });
  const [error, setError] = useState<string | null>(null);
  const [googleInstance, setGoogleInstance] = useState<typeof google | null>(() => {
    if (typeof window !== "undefined" && window.google?.maps) {
      return window.google;
    }
    return null;
  });

  useEffect(() => {
    if (!apiKey) {
      setStatus("unconfigured");
      return undefined;
    }

    if (typeof window !== "undefined" && window.google?.maps?.places) {
      setStatus("ready");
      setGoogleInstance(window.google);
      return undefined;
    }

    let isMounted = true;
    setStatus("loading");

    loadGoogleMapsLibraries(apiKey)
      .then((g) => {
        if (isMounted) {
          setGoogleInstance(g);
          setStatus("ready");
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const message =
            err instanceof Error ? err.message : "Failed to load Google Maps API";
          setError(message);
          setStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  return {
    status,
    error,
    google: googleInstance,
  };
}
