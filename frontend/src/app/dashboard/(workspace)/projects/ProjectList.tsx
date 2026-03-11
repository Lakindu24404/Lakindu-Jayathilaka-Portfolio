"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteProject,
  duplicateProject,
  reorderProjects,
  setProjectPublished,
} from "@/app/dashboard/actions";
import { useToast } from "@/components/dashboard/Toast";
import {
  ConfirmDialog,
  DragHandleIcon,
  EmptyState,
} from "@/components/dashboard/ui";
import { moveItem, useSortable } from "@/components/dashboard/useSortable";
import type { ProjectRecord } from "@/lib/data/types";

type Filter = "all" | "published" | "draft";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
];

export function ProjectList({ initial }: { initial: ProjectRecord[] }) {
  const router = useRouter();
  const toast = useToast();
  const [projects, setProjects] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingDelete, setPendingDelete] = useState<ProjectRecord | null>(null);
  const [busy, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (filter === "published" && !project.published) return false;
      if (filter === "draft" && project.published) return false;
      if (!needle) return true;
      return (
        project.title.toLowerCase().includes(needle) ||
        project.slug.toLowerCase().includes(needle) ||
        project.tag.toLowerCase().includes(needle)
      );
    });
  }, [filter, projects, query]);

  // Dragging reorders the whole list, so it is only offered on the unfiltered
  // view where the visible order is the stored order.
  const sortingEnabled = filter === "all" && query.trim() === "";

  const sortable = useSortable({
    label: "the project list",
    itemLabel: (index) => visible[index]?.title ?? "project",
    count: visible.length,
    disabled: busy || !sortingEnabled,
    onMove: (from, to) => {
      const next = moveItem(projects, from, to).map((project, index) => ({
        ...project,
        displayOrder: index,
      }));
      setProjects(next);

      startTransition(async () => {
        const result = await reorderProjects(next.map((project) => project.id));
        if (!result.ok) toast.error(result.message);
      });
    },
  });

  function togglePublished(project: ProjectRecord) {
    const next = !project.published;
    startTransition(async () => {
      const result = await setProjectPublished(project.id, next);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setProjects((current) =>
        current.map((item) =>
          item.id === project.id ? { ...item, published: next } : item,
        ),
      );
      toast.success(result.message ?? "Saved.");
    });
  }

  function duplicate(project: ProjectRecord) {
    startTransition(async () => {
      const result = await duplicateProject(project.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message ?? "Duplicated.");
      // The copy is created server-side, so open it rather than trying to
      // reconstruct the new row here.
      router.push(`/dashboard/projects/${result.data.id}`);
    });
  }

  function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;

    startTransition(async () => {
      const result = await deleteProject(target.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setProjects((current) => current.filter((item) => item.id !== target.id));
      setPendingDelete(null);
      toast.success(`${target.title} deleted.`);
    });
  }

  if (projects.length === 0) {
    return (
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
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <label className="dashSrOnly" htmlFor="project-search">
          Search projects
        </label>
        <input
          id="project-search"
          type="search"
          className="dashInput"
          style={{ maxWidth: 280 }}
          placeholder="Search by title, slug or category"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div role="group" aria-label="Filter by state" style={{ display: "flex", gap: 6 }}>
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="dashButton dashButtonSmall"
              aria-pressed={filter === option.value}
              style={
                filter === option.value
                  ? { borderColor: "var(--dash-indigo)", background: "var(--dash-surface)" }
                  : undefined
              }
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!sortingEnabled ? (
        <p className="dashHint" style={{ marginBottom: 10 }}>
          Clear the search and filter to change the display order.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description="No project matches that search and filter. Try a different term, or switch back to All."
        />
      ) : (
        <ul className="dashList">
          {visible.map((project, index) => (
            <li
              key={project.id}
              className="dashRow"
              {...sortable.getRowProps(index)}
            >
              <button {...sortable.getHandleProps(index)}>
                <DragHandleIcon />
              </button>

              <div className="dashRowBody">
                <span className="dashThumb">
                  {project.image ? (
                    <Image
                      src={project.image}
                      alt=""
                      fill
                      sizes="56px"
                      unoptimized
                    />
                  ) : null}
                </span>
                <span className="dashRowText">
                  <span className="dashRowTitle">{project.title}</span>
                  <span className="dashRowMeta">
                    {project.tag} · /{project.slug}
                    {project.showOnHomepage ? "" : " · hidden from homepage"}
                  </span>
                </span>
              </div>

              <div className="dashRowActions">
                <button
                  type="button"
                  className={`dashChip ${
                    project.published ? "dashChipLive" : "dashChipDraft"
                  }`}
                  style={{ border: 0, cursor: "pointer", font: "inherit", fontSize: 12 }}
                  onClick={() => togglePublished(project)}
                  disabled={busy}
                  aria-label={`${project.title} is ${
                    project.published ? "published" : "a draft"
                  }. ${project.published ? "Unpublish" : "Publish"}.`}
                >
                  {project.published ? "Published" : "Draft"}
                </button>

                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="dashButton dashButtonSmall"
                >
                  Edit
                </Link>
                <a
                  href={
                    project.published
                      ? `/${project.slug}`
                      : `/dashboard/preview/${project.slug}`
                  }
                  className="dashButton dashButtonSmall dashButtonGhost"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Preview
                </a>
                <button
                  type="button"
                  className="dashButton dashButtonSmall dashButtonGhost"
                  onClick={() => duplicate(project)}
                  disabled={busy}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="dashButton dashButtonSmall dashButtonDanger"
                  onClick={() => setPendingDelete(project)}
                  disabled={busy}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="dashSrOnly" aria-live="polite">
        {sortable.announcement}
      </p>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this project?"
        description={`${pendingDelete?.title ?? "This project"} and its case study page will be removed from the portfolio. This cannot be undone.`}
        confirmLabel="Delete project"
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
