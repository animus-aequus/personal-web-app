"use client";

import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const logoButtonVariants = cva(
  "overflow-hidden p-0 hover:bg-transparent focus-visible:ring-ring/50",
  {
    variants: {
      appearance: {
        sidebar:
          "size-9",
        fab: "size-11 rounded-full border border-border bg-card/90 p-1.5 shadow-lg backdrop-blur-sm transition-shadow hover:shadow-xl",
      },
    },
    defaultVariants: {
      appearance: "sidebar",
    },
  },
);

type LogoIconButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "aria-label"
> &
  VariantProps<typeof logoButtonVariants> & {
    label: string;
  };

export function LogoIconButton({
  appearance,
  className,
  label,
  ...props
}: LogoIconButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(logoButtonVariants({ appearance }), className)}
      {...props}
    >
      <Image
        src="/logo.svg"
        alt={label}
        width={44}
        height={44}
        className="size-full object-contain"
        priority
      />
    </Button>
  );
}
