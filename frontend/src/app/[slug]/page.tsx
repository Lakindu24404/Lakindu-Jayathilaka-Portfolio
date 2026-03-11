import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectCase } from "@/components/project/ProjectCase";
import {
  getPublishedProject,
  getPublishedProjects,
  relatedProjects,
} from "@/lib/data/public";

/**
 * Case study pages stay statically prerendered: `generateStaticParams` builds
 * every published slug, and the reads behind it are cached under the
 * `portfolio:projects` tag, which the dashboard invalidates on publish.
 *
 * `dynamicParams` stays on so a project published after the last deploy is
 * rendered on first request rather than 404ing.
 */
export const dynamicParams = true;

export async function generateStaticParams() {
  const projects = await getPublishedProjects();
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata(
  props: PageProps<"/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const project = await getPublishedProject(slug);

  if (!project) return { title: "Project not found" };

  const description =
    project.intro.slice(0, 200) ||
    `${project.title} — ${project.tag} case study.`;

  return {
    title: project.title,
    description,
    alternates: { canonical: `/${project.slug}` },
    openGraph: {
      type: "article",
      title: project.title,
      description,
      url: `/${project.slug}`,
      images: project.image ? [{ url: project.image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: project.title,
      description,
      images: project.image ? [project.image] : undefined,
    },
  };
}

export default async function ProjectPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;

  const projects = await getPublishedProjects();
  const project = projects.find((item) => item.slug === slug);

  // Drafts and unknown slugs are indistinguishable from the outside.
  if (!project) notFound();

  return (
    <ProjectCase
      project={project}
      related={relatedProjects(projects, project.slug)}
    />
  );
}
