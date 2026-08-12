import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { CHAT_CONTROL } from "@/lib/chat/control-bar-geometry";

/** Treat the IME as open when inset exceeds this (overflow lock / scroll reset). */
export const KEYBOARD_INSET_THRESHOLD_PX = 50;

export type VisualViewportFrame = {
  height: number;
  offsetTop: number;
  keyboardInset: number;
};

export function isKeyboardViewportActive(
  frame: VisualViewportFrame | null,
): frame is VisualViewportFrame {
  return frame !== null && frame.keyboardInset > KEYBOARD_INSET_THRESHOLD_PX;
}

/** Facebook / Messenger / Instagram in-app browsers (and similar IABs). */
const IN_APP_BROWSER_UA =
  /FBAN|FBAV|FB_IAB|FBIOS|FBSS|Instagram|MessengerLite|Orca-Android|Line\//i;

export function isEmbeddedInAppBrowser(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return IN_APP_BROWSER_UA.test(navigator.userAgent);
}

function subscribeInAppBrowser() {
  return () => {};
}

type VirtualKeyboardLike = {
  overlaysContent: boolean;
  boundingRect: DOMRect;
  addEventListener(type: "geometrychange", listener: () => void): void;
  removeEventListener(type: "geometrychange", listener: () => void): void;
};

function getVirtualKeyboard(): VirtualKeyboardLike | null {
  const keyboard = (
    navigator as Navigator & { virtualKeyboard?: VirtualKeyboardLike }
  ).virtualKeyboard;
  return keyboard ?? null;
}

function framesEqual(a: VisualViewportFrame, b: VisualViewportFrame): boolean {
  return (
    a.height === b.height &&
    a.offsetTop === b.offsetTop &&
    a.keyboardInset === b.keyboardInset
  );
}

function readVisualViewportFrame(): VisualViewportFrame | null {
  const viewport = window.visualViewport;
  if (!viewport) {
    return null;
  }

  const offsetTop = viewport.offsetTop;
  const layoutHeight = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight,
  );
  const vkHeight = Math.max(
    0,
    getVirtualKeyboard()?.boundingRect.height ?? 0,
  );
  // Android 15+ / Messenger WebView often overlay the IME without shrinking
  // visualViewport. Fall back to Virtual Keyboard API height in that case.
  const vvOverlap = Math.max(
    0,
    layoutHeight - viewport.height - offsetTop,
  );
  const keyboardInset = Math.max(vvOverlap, vkHeight);
  const height = Math.max(0, layoutHeight - keyboardInset);

  return { height, offsetTop, keyboardInset };
}

/**
 * Tracks the visible viewport on mobile so chat chrome stays above the
 * soft keyboard in in-app browsers (Messenger, Instagram, etc.).
 */
export function useVisualViewportFrame(): VisualViewportFrame | null {
  const [frame, setFrame] = useState<VisualViewportFrame | null>(null);
  const [mobile, setMobile] = useState(false);
  const inAppBrowser = useSyncExternalStore(
    subscribeInAppBrowser,
    isEmbeddedInAppBrowser,
    () => false,
  );
  const wasKeyboardOpenRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(
      `(min-width: ${CHAT_CONTROL.DESKTOP_MIN_PX}px)`,
    );
    const syncMobile = () => setMobile(!mediaQuery.matches);
    syncMobile();
    mediaQuery.addEventListener("change", syncMobile);
    return () => mediaQuery.removeEventListener("change", syncMobile);
  }, []);

  useLayoutEffect(() => {
    if (!mobile || !inAppBrowser) {
      wasKeyboardOpenRef.current = false;
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const virtualKeyboard = getVirtualKeyboard();
    if (virtualKeyboard) {
      virtualKeyboard.overlaysContent = true;
    }

    const commit = () => {
      rafIdRef.current = null;
      const next = readVisualViewportFrame();
      if (!next) {
        return;
      }

      setFrame((prev) => {
        if (prev && framesEqual(prev, next)) {
          return prev;
        }
        return next;
      });

      const keyboardOpen = isKeyboardViewportActive(next);
      if (keyboardOpen && !wasKeyboardOpenRef.current) {
        window.scrollTo(0, 0);
      }
      wasKeyboardOpenRef.current = keyboardOpen;
    };

    const scheduleSync = () => {
      if (rafIdRef.current !== null) {
        return;
      }
      rafIdRef.current = requestAnimationFrame(commit);
    };

    scheduleSync();
    viewport.addEventListener("resize", scheduleSync);
    viewport.addEventListener("scroll", scheduleSync);
    window.addEventListener("orientationchange", scheduleSync);
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("focusin", scheduleSync);
    window.addEventListener("focusout", scheduleSync);
    virtualKeyboard?.addEventListener("geometrychange", scheduleSync);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      viewport.removeEventListener("resize", scheduleSync);
      viewport.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("focusin", scheduleSync);
      window.removeEventListener("focusout", scheduleSync);
      virtualKeyboard?.removeEventListener("geometrychange", scheduleSync);
      wasKeyboardOpenRef.current = false;
    };
  }, [mobile, inAppBrowser]);

  useLayoutEffect(() => {
    if (!mobile || !inAppBrowser || !isKeyboardViewportActive(frame)) {
      return;
    }

    const html = document.documentElement;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [mobile, inAppBrowser, frame]);

  return mobile && inAppBrowser ? frame : null;
}
