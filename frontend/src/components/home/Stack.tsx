import { StackOrbit } from "@/components/home/StackOrbit";
import { TextReveal } from "@/components/effects/TextReveal";
import { stack } from "@/content/site";
import { orbitTickerItems } from "@/lib/data/orbit";
import type { StackTechRecord } from "@/lib/data/types";
import styles from "./Stack.module.css";

/**
 * The orbit nodes now come from the data layer instead of being written into
 * this file. Everything else — the heading, the six service cards, the CSS
 * rotation — is unchanged.
 */
export function Stack({ technologies }: { technologies: StackTechRecord[] }) {
  const tools = orbitTickerItems(technologies);

  return (
    <section id="stack" aria-labelledby="stack-heading" className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.intro}>
          <h2 id="stack-heading" className={styles.heading}>
            <TextReveal>
              {stack.heading.before}{" "}
              <em data-stack-accent>{stack.heading.accent}</em>{" "}
              {stack.heading.after}
            </TextReveal>
          </h2>
          <p className={styles.description}>
            <TextReveal variant="copy" delay={0.1}>
              {stack.description}
            </TextReveal>
          </p>
        </header>

        <div className={styles.content}>
          <ol className={styles.serviceGrid}>
            {stack.services.map((service, index) => (
              <li key={service.title} className={styles.serviceCard}>
                <span className={styles.serviceNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3>
                  <TextReveal>{service.title}</TextReveal>
                </h3>
                <p>{service.description}</p>
              </li>
            ))}
          </ol>

          <div className={styles.visual}>
            <StackOrbit technologies={technologies} />
          </div>
        </div>
      </div>

      {tools.length > 0 ? (
        <div className={styles.toolTicker} aria-label="Orbit technologies">
          <div className={styles.toolTrack}>
            <ul className={styles.toolGroup} data-stack-tools="primary">
              {tools.map((tool) => (
                <li key={tool.id} className={styles.toolPill}>
                  {tool.name}
                </li>
              ))}
            </ul>

            <ul className={styles.toolGroup} aria-hidden="true">
              {tools.map((tool) => (
                <li key={`duplicate-${tool.id}`} className={styles.toolPill}>
                  {tool.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
