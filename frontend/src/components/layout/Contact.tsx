"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { RollLink } from "@/components/ui/RollLink";
import { TextReveal } from "@/components/effects/TextReveal";
import { contact, footer, site } from "@/content/site";
import { footerSpring } from "@/lib/motion";

/**
 * Brand marks for the social row. Each renders inside a 44px black disc at
 * 20px, matching the reference's 12px padding.
 */
const socialPaths: Record<string, string[]> = {
  framer: ["M4 0h16v8h-8z", "M4 8h16l-8 8H4z", "M4 16h8v8H4z"],
  linkedin: [
    "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05A4.2 4.2 0 0 1 16.6 8.7c4 0 4.4 2.4 4.4 5.6V21h-4v-5.8c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9V9Z",
  ],
  x: [
    "M17.5 3h3.2l-7 8 8.3 10h-6.5l-5-6.2L4.7 21H1.5l7.5-8.6L1 3h6.6l4.6 5.7L17.5 3Zm-1.1 16h1.8L7.7 4.8H5.8L16.4 19Z",
  ],
  github: [
    "M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10 10 0 0 0 12 2Z",
  ],
  instagram: [
    "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"
  ],
};

export function Contact() {
  const reduce = useReducedMotion();
  const wordRef = useRef<HTMLDivElement>(null);
  const wordTextRef = useRef<HTMLParagraphElement>(null);
  const wordInView = useInView(wordRef, { amount: 0.4 });
  const [wordSize, setWordSize] = useState(0);
  const [email, setEmail] = useState("");

  // The reference sets the wordmark inside an SVG whose viewBox is the text's
  // own box, so it always spans the full width whatever the string is. Same
  // result here: measure the run at a known size, then scale to the gutter.
  useEffect(() => {
    const box = wordRef.current;
    const text = wordTextRef.current;
    if (!box || !text) return;
    // Refitting changes the box's height, which would re-trigger the observer
    // and loop. The only real inputs are the available width and the width of
    // the run itself, which moves once when the webfont swaps in.
    let fittedTo = "";
    const fit = () => {
      // Measure a detached copy: mutating the live node would clobber the
      // inline font-size React puts there.
      const probe = document.createElement("p");
      const from = getComputedStyle(text);
      probe.textContent = text.textContent;
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;width:max-content;font-size:100px;letter-spacing:-0.06em";
      probe.style.fontFamily = from.fontFamily;
      probe.style.fontWeight = from.fontWeight;
      box.appendChild(probe);
      const natural = probe.offsetWidth;
      probe.remove();
      const boxStyle = getComputedStyle(box);
      const available =
        box.clientWidth -
        parseFloat(boxStyle.paddingLeft) -
        parseFloat(boxStyle.paddingRight);
      const key = `${available}/${natural}`;
      if (!natural || available <= 0 || key === fittedTo) return;
      fittedTo = key;
      setWordSize((available / natural) * 100);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, []);

  // No newsletter backend here — hand the address to the mail client the same
  // way the inquiry form does.
  const subscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = `Please add ${email} to the mailing list.`;
    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent("Newsletter signup")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <footer
      id="contact"
      className="flex flex-col overflow-clip bg-black/35 pt-16 text-white backdrop-blur-xl [--gutter:20px] md:pt-20 md:[--gutter:40px] lg:[--gutter:64px]"
    >
      {/* Row 1 — 500px newsletter column against the two link columns. */}
      <div className="flex flex-col gap-12 px-[var(--gutter)] lg:flex-row lg:items-start lg:justify-between">
        <div className="flex w-full max-w-[500px] flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-[clamp(32px,3.44vw,44px)] font-semibold leading-[1.1] text-white">
              <TextReveal>{footer.newsletter.heading}</TextReveal>
            </h2>
            <p className="text-base font-medium leading-[1.3] text-white/70">
              <TextReveal variant="copy" delay={0.1}>
                {footer.newsletter.blurb}
              </TextReveal>
            </p>
          </div>

          <form onSubmit={subscribe} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="footer-email" className="sr-only">
              Email address
            </label>
            <input
              id="footer-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={footer.newsletter.placeholder}
              className="h-[51px] w-full rounded-[12px] border border-white/15 bg-black/40 px-4 text-base font-medium leading-[1.2] text-white outline-none placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-white/45 sm:flex-1"
            />
            <button
              type="submit"
              className="h-[51px] w-full rounded-[12px] bg-white text-base font-medium leading-[1.2] text-black transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-[#ededed] sm:w-auto sm:px-8"
            >
              {footer.newsletter.submit}
            </button>
          </form>
        </div>

        <div className="flex w-full justify-between gap-8 sm:justify-start sm:gap-16 lg:w-auto lg:gap-20">
          {footer.columns.map((column) => (
            <div key={column.label} className="flex flex-col gap-4">
              <p className="text-[15px] font-medium leading-[1.3] tracking-[-0.03em] text-white/55">
                {column.label}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <RollLink
                      href={link.href}
                      height={34}
                      className="w-max"
                      lineClassName="whitespace-nowrap text-[clamp(22px,5.4vw,28px)] font-medium leading-[1.2] tracking-[-0.04em] text-white"
                    >
                      {link.label}
                    </RollLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — email on the left, social discs pinned right. */}
      <div className="mt-12 flex flex-col gap-8 px-[var(--gutter)] lg:mt-16 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 lg:gap-6">
          <p className="whitespace-nowrap text-[15px] font-medium leading-[1.3] tracking-[-0.03em] text-white/55">
            {footer.emailLabel}
          </p>
          <h3 className="min-w-0 text-[clamp(18px,4.5vw,26px)] font-medium leading-[1.2] text-white lg:text-[clamp(24px,3vw,32px)]">
            <a
              href={`mailto:${contact.email}`}
              className="break-all transition-colors duration-300 ease-[var(--ease-out-soft)] hover:text-accent lg:break-normal"
            >
              <TextReveal>{contact.email}</TextReveal>
            </a>
          </h3>
        </div>

        <ul className="flex flex-wrap gap-3 sm:gap-4">
          {footer.socials.map((social) => (
            <li key={social.label}>
              <a
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  {socialPaths[social.icon].map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Row 3 — the wordmark fills the width at 5% ink and springs up on
          entry, its descender band clipped by the footer. */}
      <div ref={wordRef} className="mt-6 overflow-clip px-3 md:mt-8 md:px-5">
        <motion.p
          ref={wordTextRef}
          initial={false}
          animate={{ y: reduce || wordInView ? 0 : "60%" }}
          transition={footerSpring}
          style={wordSize ? { fontSize: wordSize } : undefined}
          className="whitespace-nowrap text-center text-[18.4vw] font-semibold leading-[0.85] tracking-[-0.06em] text-white opacity-10"
        >
          {site.footerWordmark}
        </motion.p>
      </div>
    </footer>
  );
}
