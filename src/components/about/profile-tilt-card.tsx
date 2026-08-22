"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import { AURA_PALETTE_CSS } from "@/lib/visualizer/aura-palette";

const auraBorderGradient = `conic-gradient(in oklch, ${AURA_PALETTE_CSS.join(", ")}, ${AURA_PALETTE_CSS[0]})`;

const MAX_TILT_DEG = 10;
const SPRING = { stiffness: 180, damping: 22, mass: 0.45 };
const ENTRANCE_SPRING = {
  type: "spring" as const,
  stiffness: 320,
  damping: 26,
  mass: 0.55,
};
const ENTRANCE_OFFSET_X = -48;

type ProfileTiltCardProps = {
  className?: string;
};

export function ProfileTiltCard({ className }: ProfileTiltCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [hovering, setHovering] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const hoverLift = useMotionValue(0);
  const idleFloatY = useMotionValue(0);

  const rotateX = useSpring(
    useTransform(pointerY, [-0.5, 0.5], [MAX_TILT_DEG, -MAX_TILT_DEG]),
    SPRING,
  );
  const rotateY = useSpring(
    useTransform(pointerX, [-0.5, 0.5], [-MAX_TILT_DEG, MAX_TILT_DEG]),
    SPRING,
  );
  const liftY = useSpring(useTransform(hoverLift, [0, 1], [0, -10]), SPRING);
  const scale = useSpring(useTransform(hoverLift, [0, 1], [1, 1.02]), SPRING);
  const totalY = useTransform(
    [idleFloatY, liftY] as const,
    ([idle, lift]: number[]) => idle + lift,
  );

  const shadowX = useTransform(rotateY, (value) => `${-value * 1.4}px`);
  const shadowY = useTransform(
    [rotateX, liftY, idleFloatY] as const,
    ([rx, ly, idle]: number[]) =>
      `${12 + Math.abs(rx) * 0.9 + Math.abs(ly) * 0.35 + Math.abs(idle) * 0.25}px`,
  );
  const shadowBlur = useTransform(
    [rotateX, rotateY, liftY] as const,
    ([rx, ry, ly]: number[]) =>
      `${28 + Math.abs(rx) * 1.2 + Math.abs(ry) * 1.2 + Math.abs(ly) * 0.5}px`,
  );
  const boxShadow = useMotionTemplate`${shadowX} ${shadowY} ${shadowBlur} oklch(0.08 0.03 260 / 0.55)`;

  useEffect(() => {
    if (reducedMotion || hovering) {
      idleFloatY.set(0);
      return;
    }
    const controls = animate(idleFloatY, [0, -6, 0], {
      duration: 4.5,
      repeat: Infinity,
      ease: "easeInOut",
    });
    return () => controls.stop();
  }, [hovering, idleFloatY, reducedMotion]);

  const resetTilt = useCallback(() => {
    pointerX.set(0);
    pointerY.set(0);
    hoverLift.set(0);
    setHovering(false);
  }, [hoverLift, pointerX, pointerY]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reducedMotion || !cardRef.current) {
        return;
      }
      const rect = cardRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      pointerX.set(Math.max(-0.5, Math.min(0.5, x)));
      pointerY.set(Math.max(-0.5, Math.min(0.5, y)));
    },
    [pointerX, pointerY, reducedMotion],
  );

  const handlePointerEnter = useCallback(() => {
    if (reducedMotion) {
      return;
    }
    setHovering(true);
    hoverLift.set(1);
  }, [hoverLift, reducedMotion]);

  const handlePointerLeave = useCallback(() => {
    resetTilt();
  }, [resetTilt]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  useEffect(() => {
    const img = imageRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImageLoaded(true);
    }
  }, []);

  return (
    <motion.div
      className={cn("relative mx-auto w-full max-w-xs lg:mx-0 lg:max-w-sm", className)}
      style={{ perspective: reducedMotion ? undefined : "1200px" }}
      initial={reducedMotion ? false : { opacity: 0, x: ENTRANCE_OFFSET_X }}
      animate={{ opacity: 1, x: 0 }}
      transition={ENTRANCE_SPRING}
    >
      <motion.div
        ref={cardRef}
        className="relative will-change-transform"
        style={
          reducedMotion
            ? { boxShadow: "0 20px 40px oklch(0.08 0.03 260 / 0.45)" }
            : {
                rotateX,
                rotateY,
                y: totalY,
                scale,
                transformStyle: "preserve-3d",
                boxShadow,
              }
        }
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <div className="relative overflow-hidden rounded-2xl p-[2px]">
          <div
            aria-hidden
            className="invite-welcome-border-spin pointer-events-none absolute inset-[-100%] z-0"
            style={{ background: auraBorderGradient }}
          />
          <div className="relative z-10 overflow-hidden rounded-[calc(var(--radius-2xl)-2px)] bg-card">
            <div className="relative isolate aspect-[3/4] w-full overflow-hidden bg-card">
              {!imageLoaded ? (
                <div
                  role="status"
                  aria-label="Loading profile photo"
                  className="absolute inset-0 z-0 flex items-center justify-center bg-card"
                >
                  <Loader2
                    className={cn("size-8 text-primary", !reducedMotion && "animate-spin")}
                    aria-hidden
                  />
                </div>
              ) : null}
              <Image
                ref={imageRef}
                src="/profile_picture.jpg"
                alt="Kacper Fleming"
                fill
                priority
                sizes="(max-width: 1024px) 320px, 384px"
                onLoad={handleImageLoad}
                className={cn(
                  "relative z-10 object-cover object-[center_18%]",
                  imageLoaded ? "opacity-100" : "opacity-0",
                  !reducedMotion && "transition-opacity duration-500 ease-out",
                )}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
