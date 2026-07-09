"use client";

import {
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import {
  isTurnstileClientEnabled,
  TURNSTILE_TOKEN_FIELD,
} from "@/lib/turnstile/turnstile-config";
import { showTurnstileErrorToast } from "@/lib/turnstile/turnstile-toast";

type TurnstileContextValue = {
  enabled: boolean;
  /** Obtain a fresh Turnstile token (waits for the widget when needed). */
  acquireToken: () => Promise<string>;
  /** Reset the widget after a token has been consumed by an API call. */
  resetAfterUse: () => void;
  tokenField: typeof TURNSTILE_TOKEN_FIELD;
};

const TurnstileContext = createContext<TurnstileContextValue | null>(null);

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export function TurnstileProvider({ children }: { children: ReactNode }) {
  const enabled = isTurnstileClientEnabled();
  const widgetRef = useRef<TurnstileInstance | null>(null);

  const resetAfterUse = useCallback(() => {
    widgetRef.current?.reset();
  }, []);

  const acquireToken = useCallback(async (): Promise<string> => {
    if (!enabled) {
      return "";
    }

    const widget = widgetRef.current;
    if (!widget) {
      throw new Error("Turnstile widget is not ready");
    }

    if (widget.isExpired()) {
      widget.reset();
    }

    return widget.getResponsePromise(30_000);
  }, [enabled]);

  const value = useMemo(
    (): TurnstileContextValue => ({
      enabled,
      acquireToken,
      resetAfterUse,
      tokenField: TURNSTILE_TOKEN_FIELD,
    }),
    [enabled, acquireToken, resetAfterUse],
  );

  return (
    <TurnstileContext.Provider value={value}>
      {children}
      {enabled ? (
        <div
          className="fixed bottom-24 left-4 z-20"
          aria-label="Security verification"
        >
          <Turnstile
            ref={widgetRef}
            siteKey={SITE_KEY}
            options={{
              theme: "dark",
              appearance: "interaction-only",
            }}
            onError={() => {
              showTurnstileErrorToast();
              widgetRef.current?.reset();
            }}
            onExpire={() => {
              widgetRef.current?.reset();
            }}
          />
        </div>
      ) : null}
    </TurnstileContext.Provider>
  );
}

export function useTurnstile(): TurnstileContextValue {
  const context = useContext(TurnstileContext);
  if (!context) {
    throw new Error("useTurnstile must be used within TurnstileProvider");
  }
  return context;
}
