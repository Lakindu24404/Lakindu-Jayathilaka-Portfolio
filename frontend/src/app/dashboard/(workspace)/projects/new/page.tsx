import type { Metadata } from "next";
import { ProjectEditor } from "@/app/dashboard/(workspace)/projects/ProjectEditor";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const { repository } = await requireAdmin();
  const projects = await repository.listProjects();

  return (
    <ProjectEditor
      project={null}
      takenSlugs={projects.map((project) => project.slug)}
    />
  );
}
