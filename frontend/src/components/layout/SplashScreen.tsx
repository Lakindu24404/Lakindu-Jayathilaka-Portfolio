"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { site } from "@/content/site";
import styles from "./SplashScreen.module.css";

/** Signed-in surfaces are reached by navigating, never by landing on the site,
 *  so they open straight into their content the way the reference's own
 *  preloader-free editor views do. */
const PRIVATE_ROUTES = ["/dashboard", "/sign-in", "/sign-up"];

/** 1500ms holding the curtain plus the 900ms it takes to roll up. */
const SEQUENCE_MS = 2400;

/**
 * Fabrica®'s `PreLoader` (fabrica.framer.media), rebuilt around this site's
 * wordmark. `SplashScreen.module.css` owns the whole sequence and carries the
 * measurements; this component only names the routes that skip it and drops
 * the overlay out of the tree once the curtain has finished rolling up.
 */
export function SplashScreen() {
  const pathname = usePathname();
  // The root layout survives client-side navigation, so a splash that has
  // already played stays played — and one that never started on a private
  // route never starts later either.
  const [done, setDone] = useState(() =>
    PRIVATE_ROUTES.some((route) => pathname.startsWith(route)),
  );

  // The curtain's `animationend` is the ordinary way out. This is the one
  // that matters when there is no such event to wait for: a browser with CSS
  // animations turned off would otherwise leave a visitor staring at a black
  // rectangle that also swallows their clicks. The countdown starts with the
  // first frame the visitor could actually see, because a document loaded in a
  // background tab holds its timeline — and therefore the whole sequence —
  // until it is looked at.
  useEffect(() => {
    if (done) return;
    let timer = 0;
    const arm = () => {
      if (timer || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => setDone(true), SEQUENCE_MS + 800);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [done]);

  if (done) return null;

  return (
    <div className={styles.overlay} aria-hidden="true">
      {/* The curtain's lift is the last animation to finish, so its end is the
          end of the splash. */}
      <div className={styles.curtain} onAnimationEnd={() => setDone(true)} />
      <div className={styles.word}>
        <div className={styles.exit}>
          <p className={styles.line}>
            {[...site.fullName].map((character, index) => (
              <span
                key={`${character}-${index}`}
                className={styles.char}
                style={{ "--i": index } as CSSProperties}
              >
                {character}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
