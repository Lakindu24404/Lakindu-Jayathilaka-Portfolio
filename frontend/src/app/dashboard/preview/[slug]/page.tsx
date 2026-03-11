import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectCase } from "@/components/project/ProjectCase";
import { requireAdmin } from "@/lib/auth";
import { toPublicProject } from "@/lib/data/types";

export const metadata: Metadata = {
  title: "Draft preview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A draft rendered through the real `ProjectCase` layout.
 *
 * Only administrators can reach it — the same guard as the rest of the
 * dashboard — so an unpublished case study is never publicly readable, while
 * the editor still sees exactly what visitors will get.
 */
export default async function DraftPreviewPage(
  props: PageProps<"/dashboard/preview/[slug]">,
) {
  const { slug } = await props.params;
  const { repository } = await requireAdmin();

  const project = await repository.getProjectBySlug(slug);
  if (!project) notFound();

  const others = await repository.listProjects();

  return (
    <>
      <p
        className="dashNotice dashNoticeWarn"
        role="status"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 60,
          margin: 0,
          borderRadius: 0,
          textAlign: "center",
        }}
      >
        Draft preview — {project.published ? "this project is live" : "not visible to visitors"}.
      </p>
      <div className="dashBleed">
        <ProjectCase
          project={toPublicProject(project)}
          related={others
            .filter((entry) => entry.published && entry.slug !== project.slug)
            .slice(0, 4)
            .map(toPublicProject)}
        />
      </div>
    </>
  );
}
