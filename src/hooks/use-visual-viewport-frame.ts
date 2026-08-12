import { useLayoutEffect, useRef, useState } from "react";

import { CHAT_CONTROL } from "@/lib/chat/control-bar-geometry";

/** Apply VV layout only when the soft keyboard visibly overlaps the layout viewport. */
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

  const height = viewport.height;
  const offsetTop = viewport.offsetTop;
  // iOS/WKWebView may shrink `innerHeight` with the visual viewport while
  // `documentElement.clientHeight` stays at the layout size. Overlay
  // WebViews (Messenger) keep both large. Take the max so the keyboard
  // is detected in either case.
  const layoutHeight = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight,
  );
  const keyboardInset = Math.max(0, layoutHeight - height - offsetTop);

  return { height, offsetTop, keyboardInset };
}

/**
 * Tracks `visualViewport` on mobile so chat chrome can shrink above the
 * soft keyboard in in-app browsers (Messenger, Instagram, etc.) where
 * `100dvh` does not follow the visible viewport.
 */
export function useVisualViewportFrame(): VisualViewportFrame | null {
  const [frame, setFrame] = useState<VisualViewportFrame | null>(null);
  const [mobile, setMobile] = useState(false);
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
    if (!mobile) {
      wasKeyboardOpenRef.current = false;
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
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

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      viewport.removeEventListener("resize", scheduleSync);
      viewport.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      wasKeyboardOpenRef.current = false;
    };
  }, [mobile]);

  useLayoutEffect(() => {
    if (!mobile || !isKeyboardViewportActive(frame)) {
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
  }, [mobile, frame]);

  return mobile ? frame : null;
}
