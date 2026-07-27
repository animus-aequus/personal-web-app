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
  useState,
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
  /** Mark the current token consumed; hide the widget until the next acquire. */
  resetAfterUse: () => void;
  tokenField: typeof TURNSTILE_TOKEN_FIELD;
};

const TurnstileContext = createContext<TurnstileContextValue | null>(null);

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export function TurnstileProvider({ children }: { children: ReactNode }) {
  const enabled = isTurnstileClientEnabled();
  const widgetRef = useRef<TurnstileInstance | null>(null);
  /** Token was sent to an API; refresh the widget only on the next acquire. */
  const tokenConsumedRef = useRef(false);
  /** Visible only while Cloudflare needs a click (e.g. Brave). */
  const [challengeVisible, setChallengeVisible] = useState(false);

  const resetAfterUse = useCallback(() => {
    // Defer widget.reset() until the next acquireToken(). Immediate reset with
    // appearance: interaction-only (esp. Brave) re-shows the checkbox while idle.
    tokenConsumedRef.current = true;
    setChallengeVisible(false);
  }, []);

  const acquireToken = useCallback(async (): Promise<string> => {
    if (!enabled) {
      return "";
    }

    const widget = widgetRef.current;
    if (!widget) {
      throw new Error("Turnstile widget is not ready");
    }

    try {
      if (tokenConsumedRef.current || widget.isExpired()) {
        tokenConsumedRef.current = false;
        widget.reset();
      }

      return await widget.getResponsePromise(30_000);
    } catch (error) {
      setChallengeVisible(false);
      throw error;
    }
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
          className={
            challengeVisible
              ? "fixed bottom-24 left-4 z-20"
              : "pointer-events-none fixed bottom-24 left-4 z-20 opacity-0"
          }
          aria-hidden={!challengeVisible}
          aria-label={challengeVisible ? "Security verification" : undefined}
        >
          <Turnstile
            ref={widgetRef}
            siteKey={SITE_KEY}
            options={{
              theme: "dark",
              appearance: "interaction-only",
              retry: "never",
            }}
            onBeforeInteractive={() => {
              setChallengeVisible(true);
            }}
            onError={() => {
              showTurnstileErrorToast();
              tokenConsumedRef.current = true;
              setChallengeVisible(false);
              widgetRef.current?.reset();
            }}
            onExpire={() => {
              tokenConsumedRef.current = true;
              setChallengeVisible(false);
              widgetRef.current?.reset();
            }}
            onTimeout={() => {
              tokenConsumedRef.current = true;
              setChallengeVisible(false);
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
