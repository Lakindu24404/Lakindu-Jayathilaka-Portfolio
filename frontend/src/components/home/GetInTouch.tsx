"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useTransform } from "motion/react";
import { TextReveal } from "@/components/effects/TextReveal";
import { contact, getInTouch, site } from "@/content/site";
import styles from "./GetInTouch.module.css";

type ContactMode = "message" | "call";
const tabTransition = { type: "spring" as const, stiffness: 500, damping: 45 };
const panelTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };
const fieldRows = [["name", "email"], ["company", "stage"], ["service"], ["budget", "timeline"], ["notes"]];

function ContactIcon({ mode }: { mode: ContactMode }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {mode === "message" ? <>
        <path d="M12 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-7" />
        <path d="m10 14 1-4 9-9 3 3-9 9-4 1Z" transform="translate(-1 2) scale(.9)" />
      </> : <>
        <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z" />
        <path d="M14 3a7 7 0 0 1 7 7M14 7a3 3 0 0 1 3 3" />
      </>}
    </svg>
  );
}

export function GetInTouch() {
  const section = useRef<HTMLElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = !!useReducedMotion();
  const [mode, setMode] = useState<ContactMode>("message");
  const [focused, setFocused] = useState(false);
  const [draftOpened, setDraftOpened] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    getInTouch.fields.map(field => [field.name, field.type === "select" ? field.options[0] : ""]),
  ));

  // Folira's ellipse, fade and scale track scrolling in both directions.
  // Measure the untransformed section, not the animated content inside it.
  const { scrollYProgress } = useScroll({ target: section, offset: ["start end", "end end"] });
  const bandWidth = useMotionValue(1280);
  const bandHeight = useMotionValue(900);
  useEffect(() => {
    const element = band.current;
    if (!element) return;
    const measure = () => {
      bandWidth.set(element.offsetWidth);
      bandHeight.set(element.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [bandWidth, bandHeight]);
  const maskWidth = useTransform(() => 100 + Math.max(0, Math.min(1, scrollYProgress.get())) * (bandWidth.get() * 2.5 - 100));
  const maskHeight = useTransform(() => 100 + Math.max(0, Math.min(1, scrollYProgress.get())) * (bandHeight.get() * 2.5 - 100));
  const maskSize = useMotionTemplate`${maskWidth}px ${maskHeight}px`;
  // Keep content on the same JS scroll clock as the mask. Motion 13 promotes
  // range-based opacity transforms to a native ViewTimeline, which can report
  // a different progress and leave the content transparent after the reveal.
  const contentProgress = useTransform(() => Math.max(0, Math.min(1, scrollYProgress.get() / 0.55)));
  const opacity = contentProgress;
  const scale = useTransform(() => 0.8 + contentProgress.get() * 0.2);
  const reveal = reduce || focused;

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = 1 - index;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 1;
    else return;
    event.preventDefault();
    setMode(next === 0 ? "message" : "call");
    tabRefs.current[next]?.focus();
  };

  const submitInquiry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = getInTouch.fields.map(field => `${field.label}: ${values[field.name] || "Not specified"}`).join("\n\n");
    const subject = `Project inquiry from ${values.name}`;
    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setDraftOpened(true);
  };

  return (
    <section ref={section} id="get-in-touch" aria-labelledby="get-in-touch-heading" className={styles.section}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <motion.div ref={band} className={styles.band} style={{ maskSize, WebkitMaskSize: maskSize, ...(reveal ? { maskImage: "none", WebkitMaskImage: "none" } : {}) }}>
        <div className={styles.container}>
          <motion.div className={styles.layout} style={{ opacity: reveal ? 1 : opacity, scale: reveal ? 1 : scale }}>
            <div className={styles.sidebar}>
              <div className={styles.headingGroup}>
                <h2 id="get-in-touch-heading">
                  <TextReveal>{getInTouch.heading}</TextReveal>
                </h2>
                <p>{getInTouch.blurb}</p>
              </div>
              <div className={styles.media}>
                <div className={styles.portrait}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/get-in-touch-photo.png" width="1158" height="1214" alt={`${site.firstName} — let's work together`} loading="lazy" />
                </div>
                <div className={styles.tabs} role="tablist" aria-label="How would you like to get in touch?">
                  {(["message", "call"] as const).map((tab, index) => (
                    <motion.button key={tab} ref={element => { tabRefs.current[index] = element; }}
                      type="button" role="tab" id={`contact-tab-${tab}`} aria-controls={`contact-panel-${tab}`}
                      aria-selected={mode === tab} aria-label={tab === "message" ? "Send a message" : "Book a call"}
                      tabIndex={mode === tab ? 0 : -1} onClick={() => setMode(tab)} onKeyDown={event => onTabKey(event, index)}
                      className={styles.tab} initial={false}
                      animate={{ width: mode === tab ? "calc(100% - 106px)" : "100px", backgroundColor: mode === tab ? "#ffffff" : "#3c3c3c", color: mode === tab ? "#000000" : "#ffffff" }}
                      transition={reduce ? { duration: 0 } : tabTransition}>
                      <ContactIcon mode={tab} />
                      <AnimatePresence initial={false}>
                        {mode === tab && <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={reduce ? { duration: 0 } : panelTransition}>
                          {tab === "message" ? "Send a message" : "Book a call"}
                        </motion.span>}
                      </AnimatePresence>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.panelArea}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={mode} role="tabpanel" id={`contact-panel-${mode}`} aria-labelledby={`contact-tab-${mode}`}
                  initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -12 }}
                  transition={reduce ? { duration: 0 } : panelTransition}>
                  {mode === "message" ? (
                    <form className={styles.form} onSubmit={submitInquiry}>
                      <div className={styles.fields}>
                        {fieldRows.map((row, rowIndex) => (
                          <div key={row.join("-")} className={`${styles.row} ${row.length === 2 ? styles.pair : ""} ${rowIndex < 2 ? styles.identityRow : ""}`}>
                            {row.map(name => {
                              const field = getInTouch.fields.find(item => item.name === name)!;
                              const shared = {
                                id: `git-${field.name}`,
                                name: field.name,
                                value: values[field.name],
                                onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
                                  const value = event.target.value;
                                  setValues(previous => ({ ...previous, [field.name]: value }));
                                },
                              };
                              return <div key={field.name} className={styles.field}>
                                <label htmlFor={shared.id}>{field.label}</label>
                                {field.type === "textarea" ? <textarea {...shared} rows={5} placeholder={field.placeholder} className={styles.input} />
                                  : field.type === "select" ? <div className={styles.selectWrap}>
                                    <select {...shared} className={styles.input}>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select>
                                    <svg aria-hidden="true" width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="m1 1.5 5 5 5-5" /></svg>
                                  </div>
                                  : <input {...shared} type={field.type} required={"required" in field ? field.required : undefined} autoComplete={field.name === "name" ? "name" : field.name === "email" ? "email" : "organization"} placeholder={field.placeholder} className={styles.input} />}
                              </div>;
                            })}
                          </div>
                        ))}
                      </div>
                      <div className={styles.submitGroup}>
                        <button type="submit" className={styles.submit}>{getInTouch.submit}</button>
                        {draftOpened && <p className={styles.status} role="status">Continue in your email app to send your inquiry. Nothing has been sent automatically.</p>}
                      </div>
                    </form>
                  ) : (
                    <div className={styles.booking}>
                      <span className={styles.bookingIcon}><ContactIcon mode="call" /></span>
                      <h3>
                        <TextReveal>Let’s talk about your project.</TextReveal>
                      </h3>
                      <p>The booking calendar isn’t connected yet. Send me an email and we can find a time that works.</p>
                      <a className={styles.submit} href={`mailto:${contact.email}?subject=Let%E2%80%99s%20schedule%20a%20call`}>Arrange a call by email</a>
                      <span className={styles.email}>{contact.email}</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
