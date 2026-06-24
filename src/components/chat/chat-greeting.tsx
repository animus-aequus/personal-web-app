"use client";

import { motion } from "motion/react";

const GREETING_TEXT =
  "Hi there! I'm Kacper's assistant. Think of me as your go-to for answering questions, booking meetings, and pretty much anything in between.";

type ChatGreetingProps = {
  visible: boolean;
};

export function ChatGreeting({ visible }: ChatGreetingProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 top-[18%] flex justify-center px-6"
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 12,
      }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      aria-hidden={!visible}
    >
      <p className="max-w-lg text-center text-2xl font-normal leading-snug text-foreground/90 md:text-3xl">
        {GREETING_TEXT}
      </p>
    </motion.div>
  );
}
