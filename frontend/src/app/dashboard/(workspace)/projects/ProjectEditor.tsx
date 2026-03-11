"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveProject } from "@/app/dashboard/actions";
import { GalleryField } from "@/components/dashboard/GalleryField";
import { ImageField } from "@/components/dashboard/ImageField";
import { useToast } from "@/components/dashboard/Toast";
import {
  CheckboxField,
  ConfirmDialog,
  DragHandleIcon,
  TextAreaField,
  TextField,
  useUnsavedChangesWarning,
} from "@/components/dashboard/ui";
import { moveItem, useSortable } from "@/components/dashboard/useSortable";
import { slugify } from "@/lib/data/schemas";
import type { ProjectRecord, ProjectSection } from "@/lib/data/types";

type Draft = {
  title: string;
  slug: string;
  tag: string;
  image: string;
  gallery: string[];
  client: string;
  duration: string;
  previewUrl: string;
  templateLabel: string;
  templateUrl: string;
  intro: string;
  approach: string;
  sections: ProjectSection[];
  features: string;
  a11yNotes: string;
  conclusion: string;
  published: boolean;
  showOnHomepage: boolean;
};

export const BLANK_PROJECT: Draft = {
  title: "",
  slug: "",
  tag: "Web Design",
  image: "",
  gallery: [],
  client: "",
  duration: "",
  previewUrl: "",
  templateLabel: "",
  templateUrl: "",
  intro: "",
  approach: "",
  sections: [],
  features: "",
  a11yNotes: "",
  conclusion: "",
  published: false,
  showOnHomepage: true,
};

function toDraft(project: ProjectRecord): Draft {
  return {
    title: project.title,
    slug: project.slug,
    tag: project.tag,
    image: project.image,
    gallery: project.gallery,
    client: project.client,
    duration: project.duration,
    previewUrl: project.previewUrl,
    templateLabel: project.templateLabel,
    templateUrl: project.templateUrl,
    intro: project.intro,
    approach: project.approach,
    sections: project.sections,
    features: project.features,
    a11yNotes: project.a11yNotes,
    conclusion: project.conclusion,
    published: project.published,
    showOnHomepage: project.showOnHomepage,
  };
}

function toFormData(draft: Draft): FormData {
  const form = new FormData();
  form.set("title", draft.title);
  form.set("slug", draft.slug);
  form.set("tag", draft.tag);
  form.set("image", draft.image);
  form.set("gallery", JSON.stringify(draft.gallery));
  form.set("client", draft.client);
  form.set("duration", draft.duration);
  form.set("previewUrl", draft.previewUrl);
  form.set("templateLabel", draft.templateLabel);
  form.set("templateUrl", draft.templateUrl);
  form.set("intro", draft.intro);
  form.set("approach", draft.approach);
  form.set("sections", JSON.stringify(draft.sections));
  form.set("features", draft.features);
  form.set("a11yNotes", draft.a11yNotes);
  form.set("conclusion", draft.conclusion);
  if (draft.published) form.set("published", "on");
  if (draft.showOnHomepage) form.set("showOnHomepage", "on");
  return form;
}

export function ProjectEditor({
  project,
  takenSlugs,
}: {
  project: ProjectRecord | null;
  /** Every other project's slug, so uniqueness is flagged while typing. */
  takenSlugs: string[];
}) {
  const router = useRouter();
  const toast = useToast();

  const initial = useMemo(
    () => (project ? toDraft(project) : BLANK_PROJECT),
    [project],
  );

  const [draft, setDraft] = useState<Draft>(initial);
  const [baseline, setBaseline] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(Boolean(project));
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [baseline, draft],
  );

  useUnsavedChangesWarning(dirty);

  const slugTaken = draft.slug !== "" && takenSlugs.includes(draft.slug);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      // Generating the slug stops as soon as it has been edited by hand, so a
      // published URL is never rewritten by a title tweak.
      if (key === "title" && !slugTouched) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  const sectionSort = useSortable({
    label: "the content sections",
    itemLabel: (index) => draft.sections[index]?.heading || `Section ${index + 1}`,
    count: draft.sections.length,
    onMove: (from, to) => update("sections", moveItem(draft.sections, from, to)),
  });

  function save(publishOverride?: boolean) {
    const payload =
      publishOverride === undefined
        ? draft
        : { ...draft, published: publishOverride };

    startSaving(async () => {
      const result = await saveProject(project?.id ?? null, toFormData(payload));

      if (!result.ok) {
        setErrors(result.errors ?? {});
        toast.error(result.message);
        return;
      }

      setErrors({});
      setDraft(payload);
      setBaseline(payload);
      toast.success(result.message ?? "Saved.");

      if (!project) {
        router.replace(`/dashboard/projects/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  function leave(href: string) {
    if (dirty) {
      setLeavingTo(href);
      return;
    }
    router.push(href);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="dashHeader">
        <div>
          <h1 className="dashTitle">
            {project ? project.title || "Untitled project" : "New project"}
          </h1>
          <p className="dashSubtitle">
            {project
              ? `Editing /${project.slug}`
              : "Fill in the case study, then publish when it is ready."}
            {dirty ? " · Unsaved changes" : ""}
          </p>
        </div>
        <div className="dashHeaderActions">
          <button
            type="button"
            className="dashButton dashButtonGhost"
            onClick={() => leave("/dashboard/projects")}
            disabled={saving}
          >
            Back to projects
          </button>
          {project && !draft.published ? (
            <a
              href={`/dashboard/preview/${project.slug}`}
              className="dashButton"
              target="_blank"
              rel="noopener noreferrer"
            >
              Preview draft
            </a>
          ) : null}
          <button
            type="button"
            className="dashButton"
            onClick={() => save(false)}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="dashButton dashButtonPrimary"
            onClick={() => save(true)}
            disabled={saving}
          >
            {draft.published ? "Save & republish" : "Publish"}
          </button>
        </div>
      </div>

      <section className="dashPanel">
        <h2 className="dashPanelTitle">Basics</h2>
        <p className="dashPanelNote">
          The title, category and thumbnail are what the homepage card shows.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <TextField
            label="Title"
            value={draft.title}
            error={errors.title}
            required
            onChange={(event) => update("title", event.target.value)}
          />

          <div className="dashFieldRow">
            <TextField
              label="Slug"
              value={draft.slug}
              error={errors.slug ?? (slugTaken ? "Another project uses this slug." : undefined)}
              hint={`The case study lives at /${draft.slug || "your-slug"}`}
              onChange={(event) => {
                setSlugTouched(true);
                update("slug", slugify(event.target.value));
              }}
            />
            <TextField
              label="Category"
              value={draft.tag}
              error={errors.tag}
              hint="Shown above the title on the card, e.g. Web Design."
              onChange={(event) => update("tag", event.target.value)}
            />
          </div>

          <ImageField
            label="Card thumbnail"
            kind="project"
            value={draft.image}
            error={errors.image}
            onChange={(image) => update("image", image)}
          />

          <div className="dashFieldRow">
            <TextField
              label="Client"
              value={draft.client}
              error={errors.client}
              onChange={(event) => update("client", event.target.value)}
            />
            <TextField
              label="Duration"
              value={draft.duration}
              error={errors.duration}
              placeholder="4 weeks"
              onChange={(event) => update("duration", event.target.value)}
            />
          </div>

          <div className="dashFieldRow">
            <TextField
              label="Live preview URL"
              type="url"
              inputMode="url"
              value={draft.previewUrl}
              error={errors.previewUrl}
              placeholder="https://example.com"
              hint="Leave empty to hide the Preview button."
              onChange={(event) => update("previewUrl", event.target.value)}
            />
            <TextField
              label="Action label"
              value={draft.templateLabel}
              error={errors.templateLabel}
              placeholder="Get Template"
              onChange={(event) => update("templateLabel", event.target.value)}
            />
          </div>

          <TextField
            label="Action URL"
            type="url"
            inputMode="url"
            value={draft.templateUrl}
            error={errors.templateUrl}
            placeholder="https://example.com/buy"
            hint="Both the label and the URL are needed for the accent button to appear."
            onChange={(event) => update("templateUrl", event.target.value)}
          />
        </div>
      </section>

      <section className="dashPanel">
        <h2 className="dashPanelTitle">Gallery</h2>
        <p className="dashPanelNote">
          The images that fan out at the top of the case study.
        </p>
        <GalleryField
          images={draft.gallery}
          onChange={(gallery) => update("gallery", gallery)}
        />
      </section>

      <section className="dashPanel">
        <h2 className="dashPanelTitle">Case study</h2>
        <p className="dashPanelNote">
          These map one-to-one onto the sections of the published page.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <TextAreaField
            label="Introduction"
            value={draft.intro}
            error={errors.intro}
            onChange={(event) => update("intro", event.target.value)}
          />
          <TextAreaField
            label="My Approach"
            value={draft.approach}
            error={errors.approach}
            onChange={(event) => update("approach", event.target.value)}
          />

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span className="dashLabel">Content sections</span>
              <button
                type="button"
                className="dashButton dashButtonSmall"
                onClick={() =>
                  update("sections", [
                    ...draft.sections,
                    { heading: "", body: "" },
                  ])
                }
              >
                Add section
              </button>
            </div>

            {draft.sections.length === 0 ? (
              <p className="dashHint">
                No sections yet. Most case studies use four, from vision through
                to user-centric design.
              </p>
            ) : (
              <ul className="dashList">
                {draft.sections.map((section, index) => (
                  <li
                    key={index}
                    className="dashRow"
                    style={{ alignItems: "flex-start" }}
                    {...sectionSort.getRowProps(index)}
                  >
                    <button {...sectionSort.getHandleProps(index)}>
                      <DragHandleIcon />
                    </button>
                    <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 0 }}>
                      <TextField
                        label={`Section ${index + 1} heading`}
                        value={section.heading}
                        error={errors[`sections.${index}.heading`]}
                        onChange={(event) =>
                          update(
                            "sections",
                            draft.sections.map((entry, position) =>
                              position === index
                                ? { ...entry, heading: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                      <TextAreaField
                        label={`Section ${index + 1} body`}
                        value={section.body}
                        error={errors[`sections.${index}.body`]}
                        onChange={(event) =>
                          update(
                            "sections",
                            draft.sections.map((entry, position) =>
                              position === index
                                ? { ...entry, body: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="dashButton dashButtonSmall dashButtonDanger"
                      onClick={() =>
                        update(
                          "sections",
                          draft.sections.filter(
                            (_, position) => position !== index,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="dashSrOnly" aria-live="polite">
              {sectionSort.announcement}
            </p>
          </div>

          <TextAreaField
            label="Detailed pages and features"
            value={draft.features}
            error={errors.features}
            onChange={(event) => update("features", event.target.value)}
          />
          <TextAreaField
            label="Accessibility and optimisation"
            value={draft.a11yNotes}
            error={errors.a11yNotes}
            onChange={(event) => update("a11yNotes", event.target.value)}
          />
          <TextAreaField
            label="Conclusions"
            value={draft.conclusion}
            error={errors.conclusion}
            onChange={(event) => update("conclusion", event.target.value)}
          />
        </div>
      </section>

      <section className="dashPanel">
        <h2 className="dashPanelTitle">Visibility</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <CheckboxField
            label="Published"
            hint="Drafts return a 404 on the public site and are only reachable from the dashboard preview."
            checked={draft.published}
            onChange={(published) => update("published", published)}
          />
          <CheckboxField
            label="Show in the homepage grid"
            hint="Turn off to keep the case study reachable by URL without listing it."
            checked={draft.showOnHomepage}
            onChange={(showOnHomepage) =>
              update("showOnHomepage", showOnHomepage)
            }
          />
          {project ? (
            <p className="dashHint">
              <Link href={`/${project.slug}`} target="_blank" rel="noopener noreferrer">
                /{project.slug}
              </Link>{" "}
              · display order {project.displayOrder + 1}
            </p>
          ) : null}
        </div>
      </section>

      <ConfirmDialog
        open={leavingTo !== null}
        title="Leave without saving?"
        description="This project has changes that have not been saved. Leaving now discards them."
        confirmLabel="Discard changes"
        onCancel={() => setLeavingTo(null)}
        onConfirm={() => {
          const href = leavingTo;
          setLeavingTo(null);
          if (href) router.push(href);
        }}
      />
    </div>
  );
}
