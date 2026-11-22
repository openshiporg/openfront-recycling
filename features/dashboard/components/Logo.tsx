import React from "react";
import { Recycle } from "lucide-react";
import { cn } from "@/lib/utils";

const FALLBACK = "Openfront Recycling";

interface LogoIconProps {
  className?: string;
  logoUrl?: string | null;
  name?: string | null;
}

/** The business logo from onboarding, or a recycling mark when none is set. */
export const LogoIcon = ({ className, logoUrl, name }: LogoIconProps) =>
  logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={name || FALLBACK} className={cn("size-5 rounded-[4px] object-contain", className)} />
  ) : (
    <Recycle aria-hidden className={cn("size-5 text-emerald-700 dark:text-emerald-400", className)} />
  );

interface LogoProps {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  name?: string | null;
  logoUrl?: string | null;
}

export const Logo = ({ className, name, logoUrl, "aria-hidden": ariaHidden }: LogoProps) => (
  <div aria-hidden={ariaHidden} className={cn("flex min-w-0 items-center gap-2 text-zinc-800 dark:text-white", className)}>
    <LogoIcon logoUrl={logoUrl} name={name} className="shrink-0" />
    <span className="truncate text-base font-semibold tracking-tight">{name?.trim() || FALLBACK}</span>
  </div>
);
