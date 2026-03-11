import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { EmptyState } from "@/components/dashboard/ui";

export const metadata: Metadata = { title: "Overview" };

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Deliberately small: four counts, five recent projects, two shortcuts. */
export default async function OverviewPage() {
  const { repository } = await requireAdmin();
  const stats = await repository.overview();

  return (
    <>
      <div className="dashHeader">
        <div>
          <h1 className="dashTitle">Overview</h1>
          <p className="dashSubtitle">
            What is live on the portfolio right now.
          </p>
        </div>
        <div className="dashHeaderActions">
          <Link href="/dashboard/stack" className="dashButton">
            Add technology
          </Link>
          <Link
            href="/dashboard/projects/new"
            className="dashButton dashButtonPrimary"
          >
            Add project
          </Link>
        </div>
      </div>

      <div className="dashGrid dashStatGrid">
        <div className="dashStat">
          <span className="dashStatValue">{stats.publishedProjects}</span>
          <span className="dashStatLabel">Published projects</span>
        </div>
        <div className="dashStat">
          <span className="dashStatValue">{stats.draftProjects}</span>
          <span className="dashStatLabel">Drafts</span>
        </div>
        <div className="dashStat">
          <span className="dashStatValue">{stats.activeTechnologies}</span>
          <span className="dashStatLabel">
            Active orbit technologies
            {stats.totalTechnologies > stats.activeTechnologies
              ? ` of ${stats.totalTechnologies}`
              : ""}
          </span>
        </div>
      </div>

      <section className="dashPanel" style={{ marginTop: 20 }}>
        <h2 className="dashPanelTitle">Recently edited</h2>
        <p className="dashPanelNote">The last five projects you changed.</p>

        {stats.recentProjects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Add your first case study, or run npm run seed to import the six that shipped with the portfolio."
            action={
              <Link
                href="/dashboard/projects/new"
                className="dashButton dashButtonPrimary"
              >
                Add project
              </Link>
            }
          />
        ) : (
          <ul className="dashList">
            {stats.recentProjects.map((project) => (
              <li key={project.id} className="dashRow">
                <div className="dashRowBody">
                  <div className="dashRowText">
                    <span className="dashRowTitle">{project.title}</span>
                    <span className="dashRowMeta">
                      {project.tag} · edited {formatWhen(project.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="dashRowActions">
                  <span
                    className={`dashChip ${
                      project.published ? "dashChipLive" : "dashChipDraft"
                    }`}
                  >
                    {project.published ? "Published" : "Draft"}
                  </span>
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="dashButton dashButtonSmall"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
