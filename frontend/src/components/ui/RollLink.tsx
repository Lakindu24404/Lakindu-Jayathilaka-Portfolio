"use client";

import type { MouseEvent, ReactNode } from "react";
import { handleHashClick } from "@/lib/scroll";

/**
 * Vertical text roll: two stacked copies behind a one-line clip.
 * Live nav links render as "HomeHome" with overflow:hidden and a 32–42px window.
 */
export function RollLink({
  href,
  children,
  className = "",
  lineClassName = "",
  height,
  onClick,
  current,
  immediate = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  lineClassName?: string;
  height: number;
  onClick?: () => void;
  current?: "page" | "location";
  immediate?: boolean;
}) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    handleHashClick(href, e, { immediate });
    onClick?.();
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-current={current}
      className={`group relative block overflow-hidden ${className}`}
      style={{ height }}
    >
      <span
        className="flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1/2"
      >
        <span
          className={`flex items-center ${lineClassName}`}
          style={{ height }}
        >
          {children}
        </span>
        <span
          className={`flex items-center ${lineClassName}`}
          style={{ height }}
          aria-hidden
        >
          {children}
        </span>
      </span>
    </a>
  );
}
