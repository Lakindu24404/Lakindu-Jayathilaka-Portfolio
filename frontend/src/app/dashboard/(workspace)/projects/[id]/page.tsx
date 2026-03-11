import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectEditor } from "@/app/dashboard/(workspace)/projects/ProjectEditor";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata(
  props: PageProps<"/dashboard/projects/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const { repository } = await requireAdmin();
  const project = await repository.getProject(id);
  return { title: project?.title ?? "Project" };
}

export default async function EditProjectPage(
  props: PageProps<"/dashboard/projects/[id]">,
) {
  const { id } = await props.params;
  const { repository } = await requireAdmin();

  const [project, projects] = await Promise.all([
    repository.getProject(id),
    repository.listProjects(),
  ]);

  if (!project) notFound();

  return (
    <ProjectEditor
      project={project}
      takenSlugs={projects
        .filter((entry) => entry.id !== project.id)
        .map((entry) => entry.slug)}
    />
  );
}
