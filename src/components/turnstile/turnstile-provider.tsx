"use client";

import {
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  isTurnstileClientEnabled,
  TURNSTILE_TOKEN_FIELD,
} from "@/lib/turnstile/turnstile-config";
import { showTurnstileErrorToast } from "@/lib/turnstile/turnstile-toast";

type TurnstileContextValue = {
  enabled: boolean;
  /** Obtain a fresh Turnstile token (waits for the widget when needed). */
  acquireToken: () => Promise<string>;
  /** Mark the current token consumed; next acquire will reset the widget. */
  resetAfterUse: () => void;
  tokenField: typeof TURNSTILE_TOKEN_FIELD;
};

type TurnstileMountContextValue = {
  setMountNode: (node: HTMLDivElement | null) => void;
};

const TurnstileContext = createContext<TurnstileContextValue | null>(null);
const TurnstileMountContext = createContext<TurnstileMountContextValue | null>(
  null,
);

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
const WIDGET_READY_TIMEOUT_MS = 15_000;
const TOKEN_TIMEOUT_MS = 30_000;

function waitWithTimeout(
  wait: Promise<void>,
  ms: number,
  message: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    wait.then(
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function TurnstileProvider({ children }: { children: ReactNode }) {
  const enabled = isTurnstileClientEnabled();
  const widgetRef = useRef<TurnstileInstance | null>(null);
  /** Token was sent to an API; refresh the widget only on the next acquire. */
  const tokenConsumedRef = useRef(false);
  const readyWaitersRef = useRef<Array<() => void>>([]);
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);

  const resolveReadyWaiters = useCallback(() => {
    const waiters = readyWaitersRef.current;
    readyWaitersRef.current = [];
    for (const resolve of waiters) {
      resolve();
    }
  }, []);

  const waitForWidget = useCallback((): Promise<void> => {
    if (widgetRef.current) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      readyWaitersRef.current.push(resolve);
    });
  }, []);

  const resetAfterUse = useCallback(() => {
    // Defer widget.reset() until the next acquireToken(). Immediate reset with
    // appearance: interaction-only (esp. Brave) re-shows the checkbox while idle.
    // The verification gate unmounts after the token is consumed, so the solved
    // widget does not linger over chat UI.
    tokenConsumedRef.current = true;
  }, []);

  const acquireToken = useCallback(async (): Promise<string> => {
    if (!enabled) {
      return "";
    }

    await waitWithTimeout(
      waitForWidget(),
      WIDGET_READY_TIMEOUT_MS,
      "Turnstile widget is not ready",
    );

    const widget = widgetRef.current;
    if (!widget) {
      throw new Error("Turnstile widget is not ready");
    }

    if (tokenConsumedRef.current || widget.isExpired()) {
      tokenConsumedRef.current = false;
      widget.reset();
    }

    return await widget.getResponsePromise(TOKEN_TIMEOUT_MS);
  }, [enabled, waitForWidget]);

  const value = useMemo(
    (): TurnstileContextValue => ({
      enabled,
      acquireToken,
      resetAfterUse,
      tokenField: TURNSTILE_TOKEN_FIELD,
    }),
    [enabled, acquireToken, resetAfterUse],
  );

  const mountValue = useMemo(
    (): TurnstileMountContextValue => ({
      setMountNode,
    }),
    [],
  );

  return (
    <TurnstileContext.Provider value={value}>
      <TurnstileMountContext.Provider value={mountValue}>
        {children}
        {enabled && mountNode
          ? createPortal(
              <Turnstile
                ref={(instance) => {
                  widgetRef.current = instance ?? null;
                  if (instance) {
                    resolveReadyWaiters();
                  }
                }}
                siteKey={SITE_KEY}
                options={{
                  theme: "dark",
                  appearance: "interaction-only",
                  retry: "never",
                }}
                onWidgetLoad={() => {
                  resolveReadyWaiters();
                }}
                onError={() => {
                  showTurnstileErrorToast();
                  tokenConsumedRef.current = true;
                  widgetRef.current?.reset();
                }}
                onExpire={() => {
                  tokenConsumedRef.current = true;
                  widgetRef.current?.reset();
                }}
                onTimeout={() => {
                  tokenConsumedRef.current = true;
                  widgetRef.current?.reset();
                }}
              />,
              mountNode,
            )
          : null}
      </TurnstileMountContext.Provider>
    </TurnstileContext.Provider>
  );
}

/**
 * Mount slot for the verification gate. The provider portals the widget here
 * while `acquireToken()` waits — never as an overlay on chat chrome.
 */
export function TurnstileChallenge() {
  const mount = useContext(TurnstileMountContext);
  if (!mount) {
    throw new Error("TurnstileChallenge must be used within TurnstileProvider");
  }

  const nodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mount.setMountNode(nodeRef.current);
    return () => {
      mount.setMountNode(null);
    };
  }, [mount]);

  return (
    <div
      ref={nodeRef}
      className="flex min-h-[65px] items-center justify-center"
      aria-label="Security verification"
    />
  );
}

export function useTurnstile(): TurnstileContextValue {
  const context = useContext(TurnstileContext);
  if (!context) {
    throw new Error("useTurnstile must be used within TurnstileProvider");
  }
  return context;
}
