import type { Metadata } from "next";
import Link from "next/link";
import { ProjectList } from "@/app/dashboard/(workspace)/projects/ProjectList";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { repository } = await requireAdmin();
  const projects = await repository.listProjects();

  return (
    <>
      <div className="dashHeader">
        <div>
          <h1 className="dashTitle">Projects</h1>
          <p className="dashSubtitle">
            Case studies shown on the homepage grid and at{" "}
            <code>/your-project-slug</code>. Drag to set the order they appear
            in.
          </p>
        </div>
        <div className="dashHeaderActions">
          <Link
            href="/dashboard/projects/new"
            className="dashButton dashButtonPrimary"
          >
            Add project
          </Link>
        </div>
      </div>

      <ProjectList initial={projects} />
    </>
  );
}
