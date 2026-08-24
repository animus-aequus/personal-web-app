"use client";

import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useState } from "react";

/**
 * Epoch + handler so a parent can remount `<Canvas>` after GPU context loss
 * (tab backgrounding, memory pressure).
 */
export function useWebGlRemountEpoch(): {
  glEpoch: number;
  onContextLost: () => void;
} {
  const [glEpoch, setGlEpoch] = useState(0);
  const onContextLost = useCallback(() => {
    setGlEpoch((n) => n + 1);
  }, []);
  return { glEpoch, onContextLost };
}

/** Registers webglcontextlost with explicit teardown on unmount / remount. */
export function WebGlContextGuard({
  onContextLost,
}: {
  onContextLost: () => void;
}) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      // Remount with a new context — common after backgrounding on mobile GPUs.
      queueMicrotask(onContextLost);
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
    };
  }, [gl, onContextLost]);

  return null;
}
