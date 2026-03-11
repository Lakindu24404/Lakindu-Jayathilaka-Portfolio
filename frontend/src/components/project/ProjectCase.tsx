import { Fragment } from "react";
import { ProjectPhotos } from "@/components/project/ProjectPhotos";
import { ProjectActionLink, ProjectNavigation } from "@/components/project/ProjectActions";
import { ProjectRelated } from "@/components/project/ProjectRelated";
import { Contact } from "@/components/layout/Contact";
import { TextReveal } from "@/components/effects/TextReveal";
import type { PublicProject } from "@/lib/data/types";
import styles from "./ProjectCase.module.css";

function ProjectActions({ project }: { project: PublicProject }) {
  return (
    <div className={styles.actions}>
      {project.previewUrl ? (
        <ProjectActionLink href={project.previewUrl}>Preview</ProjectActionLink>
      ) : null}
      {project.templateUrl && project.templateLabel ? (
        <ProjectActionLink href={project.templateUrl} accent>
          {project.templateLabel}
        </ProjectActionLink>
      ) : null}
    </div>
  );
}

export function ProjectCase({
  project,
  related,
}: {
  project: PublicProject;
  related: PublicProject[];
}) {
  return (
    <>
      <ProjectNavigation />
      <main className={styles.main}>
        <header className={styles.hero}>
          <h1 className={styles.title}>
            <TextReveal>{project.title}</TextReveal>
          </h1>
          {/* A dashboard-authored project may not have a gallery yet; the card
              thumbnail keeps the three-plate composition intact. */}
          <ProjectPhotos
            images={project.gallery.length > 0 ? project.gallery : [project.image]}
            alt={project.title}
          />
        </header>

        <div className={styles.story}>
          <aside className={styles.sidebar} aria-label="Project information">
            <dl className={styles.metadata}>
              <div><dt>Category:</dt><dd>{project.tag}</dd></div>
              {project.client ? <div><dt>Client:</dt><dd>{project.client}</dd></div> : null}
              {project.duration ? <div><dt>Duration:</dt><dd>{project.duration}</dd></div> : null}
            </dl>
            <ProjectActions project={project} />
          </aside>

          <article className={styles.article} aria-label="Project case study">
            {project.intro ? <p>{project.intro}</p> : null}
            {project.approach ? (
              <>
                <h2>
                  <TextReveal>My Approach</TextReveal>
                </h2>
                <p>{project.approach}</p>
              </>
            ) : null}
            {project.sections.map((section) => (
              <Fragment key={section.heading}>
                <h3>
                  <TextReveal>{section.heading}</TextReveal>
                </h3>
                <p>{section.body}</p>
              </Fragment>
            ))}
            {project.features ? (
              <>
                <h2>
                  <TextReveal>Detailed Pages and Features</TextReveal>
                </h2>
                <p>{project.features}</p>
              </>
            ) : null}
            {project.a11yNotes ? (
              <>
                <h3>
                  <TextReveal>Accessibility and Optimization</TextReveal>
                </h3>
                <p>{project.a11yNotes}</p>
              </>
            ) : null}
            {project.conclusion ? (
              <>
                <h3>
                  <TextReveal>Conclusions</TextReveal>
                </h3>
                <p>{project.conclusion}</p>
              </>
            ) : null}
          </article>
        </div>

        <div className={styles.mobileActions}>
          <ProjectActions project={project} />
        </div>
        <ProjectRelated items={related} />
      </main>
      <Contact />
    </>
  );
}
