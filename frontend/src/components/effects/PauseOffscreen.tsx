"use client";

import { useEffect } from "react";

/**
 * Pauses the endless CSS loops inside each target section (the floating
 * solids' bob, the orbit, the tool ticker…) while the section is well away
 * from the screen, and resumes them half a screen before it comes back. The
 * loops have no phase anyone could notice, so the pause is invisible; the
 * rule that applies it lives in globals.css under `[data-offscreen]`.
 */
export function PauseOffscreen({ targets }: { targets: readonly string[] }) {
  const key = targets.join(" ");

  useEffect(() => {
    const elements = key
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) delete target.dataset.offscreen;
          else target.dataset.offscreen = "true";
        }
      },
      { rootMargin: "50% 0px" },
    );
    for (const element of elements) observer.observe(element);

    return () => {
      observer.disconnect();
      for (const element of elements) delete element.dataset.offscreen;
    };
  }, [key]);

  return null;
}
