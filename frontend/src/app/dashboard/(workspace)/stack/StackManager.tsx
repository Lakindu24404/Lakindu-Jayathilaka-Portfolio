"use client";

import { useMemo, useState, useTransition } from "react";
import {
  deleteStackTech,
  reorderStackRing,
  saveStackTech,
  setStackTechRing,
} from "@/app/dashboard/actions";
import { ImageField } from "@/components/dashboard/ImageField";
import { LogoFitField } from "@/components/dashboard/LogoFitField";
import { useToast } from "@/components/dashboard/Toast";
import {
  CheckboxField,
  ConfirmDialog,
  DragHandleIcon,
  EmptyState,
  SelectField,
  TextField,
} from "@/components/dashboard/ui";
import { moveItem, useSortable } from "@/components/dashboard/useSortable";
import { StackNodePreview } from "@/components/home/StackNode";
import { StackOrbit } from "@/components/home/StackOrbit";
import { LOGO_FIT_DEFAULT, type LogoFit } from "@/lib/data/logo-fit";
import {
  activeCountWarning,
  layoutRing,
  ringCapacityWarnings,
} from "@/lib/data/orbit";
import {
  ICON_MODES,
  MAX_ACTIVE_TECHNOLOGIES,
  ORBIT_RINGS,
  RING_CAPACITY,
  type IconMode,
  type OrbitRing,
  type StackTechRecord,
} from "@/lib/data/types";

const RING_LABEL: Record<OrbitRing, string> = {
  farOuter: "Far outer ring",
  outer: "Outer ring",
  middle: "Middle ring",
  inner: "Inner ring",
};

const RING_NOTE: Record<OrbitRing, string> = {
  farOuter: "Counter-clockwise, 61s per turn",
  outer: "Clockwise, 48s per turn",
  middle: "Counter-clockwise, 38s per turn",
  inner: "Clockwise, 29s per turn",
};

type Draft = {
  id: string | null;
  name: string;
  brandKey: string;
  logoPath: string;
  ring: OrbitRing;
  enabled: boolean;
  nodeBackground: string;
  iconMode: IconMode;
  manualAngle: boolean;
  angle: string;
  /**
   * Display-only framing of `logoPath`, held as numbers rather than as form
   * strings: the sliders and the drag surface both produce numbers, and there
   * is no "empty" state to represent.
   */
  logoScale: number;
  logoOffsetX: number;
  logoOffsetY: number;
};

/** The draft's framing, in the shape the shared renderer and editor take. */
function draftFit(draft: Draft): LogoFit {
  return {
    scale: draft.logoScale,
    offsetX: draft.logoOffsetX,
    offsetY: draft.logoOffsetY,
  };
}

/** The same three values back on a draft. */
function withFit(draft: Draft, fit: LogoFit): Draft {
  return {
    ...draft,
    logoScale: fit.scale,
    logoOffsetX: fit.offsetX,
    logoOffsetY: fit.offsetY,
  };
}

function blankDraft(ring: OrbitRing): Draft {
  return {
    id: null,
    name: "",
    brandKey: "",
    logoPath: "",
    ring,
    enabled: true,
    nodeBackground: "",
    iconMode: "original",
    manualAngle: false,
    angle: "",
    logoScale: LOGO_FIT_DEFAULT.scale,
    logoOffsetX: LOGO_FIT_DEFAULT.offsetX,
    logoOffsetY: LOGO_FIT_DEFAULT.offsetY,
  };
}

function toDraft(item: StackTechRecord): Draft {
  return {
    id: item.id,
    name: item.name,
    brandKey: item.brandKey,
    logoPath: item.logoPath,
    ring: item.ring,
    enabled: item.enabled,
    nodeBackground: item.nodeBackground ?? "",
    iconMode: item.iconMode,
    manualAngle: item.manualAngle,
    angle: item.angle === null ? "" : String(item.angle),
    logoScale: item.logoScale,
    logoOffsetX: item.logoOffsetX,
    logoOffsetY: item.logoOffsetY,
  };
}

function draftToRecord(draft: Draft, fallback?: StackTechRecord): StackTechRecord {
  return {
    id: draft.id ?? "draft-preview",
    name: draft.name || "New technology",
    brandKey: draft.brandKey || "new",
    logoPath: draft.logoPath,
    ring: draft.ring,
    displayOrder: fallback?.displayOrder ?? Number.MAX_SAFE_INTEGER,
    enabled: draft.enabled,
    nodeBackground: draft.nodeBackground || null,
    iconMode: draft.iconMode,
    manualAngle: draft.manualAngle,
    angle: draft.angle === "" ? null : Number(draft.angle),
    logoScale: draft.logoScale,
    logoOffsetX: draft.logoOffsetX,
    logoOffsetY: draft.logoOffsetY,
    updatedAt: fallback?.updatedAt ?? null,
  };
}

function draftToFormData(draft: Draft): FormData {
  const form = new FormData();
  form.set("name", draft.name);
  form.set("brandKey", draft.brandKey);
  form.set("logoPath", draft.logoPath);
  form.set("ring", draft.ring);
  form.set("iconMode", draft.iconMode);
  form.set("nodeBackground", draft.nodeBackground);
  form.set("logoScale", String(draft.logoScale));
  form.set("logoOffsetX", String(draft.logoOffsetX));
  form.set("logoOffsetY", String(draft.logoOffsetY));
  if (draft.enabled) form.set("enabled", "on");
  if (draft.manualAngle) {
    form.set("manualAngle", "on");
    form.set("angle", draft.angle);
  }
  return form;
}

export function StackManager({ initial }: { initial: StackTechRecord[] }) {
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<StackTechRecord | null>(null);
  const [paused, setPaused] = useState(false);
  const [saving, startSaving] = useTransition();

  const byRing = useMemo(() => {
    return Object.fromEntries(
      ORBIT_RINGS.map((ring) => [
        ring,
        items
          .filter((item) => item.ring === ring)
          .sort((a, b) => a.displayOrder - b.displayOrder),
      ]),
    ) as Record<OrbitRing, StackTechRecord[]>;
  }, [items]);

  const warnings = useMemo(() => ringCapacityWarnings(items), [items]);
  const overCapacity = useMemo(() => activeCountWarning(items), [items]);

  // The preview shows the row being edited in place, so colour and angle
  // changes are visible before they are saved.
  const previewItems = useMemo(() => {
    if (!draft) return items;
    const existing = draft.id
      ? items.find((item) => item.id === draft.id)
      : undefined;
    const record = draftToRecord(draft, existing);

    return draft.id
      ? items.map((item) => (item.id === draft.id ? record : item))
      : [...items, record];
  }, [draft, items]);

  function applyOrder(ring: OrbitRing, ordered: StackTechRecord[]) {
    const renumbered = ordered.map((item, index) => ({
      ...item,
      ring,
      displayOrder: index,
    }));
    const ids = new Set(renumbered.map((item) => item.id));

    setItems((current) => [
      ...current.filter((item) => !ids.has(item.id)),
      ...renumbered,
    ]);

    return renumbered.map((item) => item.id);
  }

  function persistOrder(ring: OrbitRing, ids: string[]) {
    startSaving(async () => {
      const result = await reorderStackRing(ring, ids);
      if (!result.ok) toast.error(result.message);
    });
  }

  function handleMove(ring: OrbitRing, from: number, to: number) {
    const ordered = moveItem(byRing[ring], from, to);
    persistOrder(ring, applyOrder(ring, ordered));
  }

  function handleRingChange(item: StackTechRecord, ring: OrbitRing) {
    if (ring === item.ring) return;

    const target = [...byRing[ring], { ...item, ring }];
    const ids = applyOrder(ring, target);
    // Close the gap the node left behind on its old ring.
    const sourceIds = applyOrder(
      item.ring,
      byRing[item.ring].filter((entry) => entry.id !== item.id),
    );

    startSaving(async () => {
      const moved = await setStackTechRing(item.id, ring, ids);
      if (!moved.ok) {
        toast.error(moved.message);
        return;
      }
      if (sourceIds.length > 0) await reorderStackRing(item.ring, sourceIds);
      toast.success(`${item.name} moved to the ${RING_LABEL[ring].toLowerCase()}.`);
    });
  }

  function handleSave() {
    if (!draft) return;

    startSaving(async () => {
      const result = await saveStackTech(draft.id, draftToFormData(draft));

      if (!result.ok) {
        setErrors(result.errors ?? {});
        toast.error(result.message);
        return;
      }

      setErrors({});
      const record = result.data;

      setItems((current) =>
        draft.id
          ? current.map((item) => (item.id === draft.id ? record : item))
          : [...current, record],
      );
      setDraft(null);
      toast.success(result.message ?? "Saved.");
    });
  }

  function handleDelete() {
    const target = pendingDelete;
    if (!target) return;

    startSaving(async () => {
      const result = await deleteStackTech(target.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setItems((current) => current.filter((item) => item.id !== target.id));
      if (draft?.id === target.id) setDraft(null);
      setPendingDelete(null);
      toast.success(`${target.name} removed.`);
    });
  }

  return (
    <div className="dashWorkspace">
      <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
        {overCapacity || warnings.length > 0 ? (
          <div className="dashNotice dashNoticeWarn" role="status">
            {overCapacity ? (
              <p style={{ margin: 0 }}>
                The orbit is showing {overCapacity.count} technologies. It is
                designed for up to {overCapacity.max} — hide a few, or the
                composition gets busy long before the rings run out of room.
              </p>
            ) : null}
            {warnings.map((warning) => (
              <p key={warning.ring} style={{ margin: 0 }}>
                {RING_LABEL[warning.ring]} holds {warning.count} nodes.{" "}
                {warning.level === "overlapping"
                  ? `Above ${warning.capacity} they overlap on the narrowest screens — move one to another ring.`
                  : `It fits ${warning.capacity}; one more and the nodes start to touch.`}
              </p>
            ))}
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="The orbit is empty"
            description="Add your first technology, or run npm run seed to import the fourteen that shipped with the portfolio."
            action={
              <button
                type="button"
                className="dashButton dashButtonPrimary"
                onClick={() => setDraft(blankDraft("outer"))}
              >
                Add technology
              </button>
            }
          />
        ) : (
          ORBIT_RINGS.map((ring) => (
            <RingPanel
              key={ring}
              ring={ring}
              items={byRing[ring]}
              busy={saving}
              editingId={draft?.id ?? null}
              onMove={(from, to) => handleMove(ring, from, to)}
              onEdit={(item) => {
                setErrors({});
                setDraft(toDraft(item));
              }}
              onRingChange={handleRingChange}
              onDelete={setPendingDelete}
              onAdd={() => {
                setErrors({});
                setDraft(blankDraft(ring));
              }}
            />
          ))
        )}

        {draft ? (
          <section className="dashPanel" aria-label="Technology editor">
            <h2 className="dashPanelTitle">
              {draft.id ? `Edit ${draft.name || "technology"}` : "New technology"}
            </h2>
            <p className="dashPanelNote">
              Changes appear in the preview immediately and are stored when you
              save.
            </p>

            <div style={{ display: "grid", gap: 14 }}>
              <div className="dashFieldRow">
                <TextField
                  label="Name"
                  value={draft.name}
                  error={errors.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  hint="Read out by screen readers on the orbit node."
                />
                <TextField
                  label="Brand key"
                  value={draft.brandKey}
                  error={errors.brandKey}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      brandKey: event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, ""),
                    })
                  }
                  hint="Matches the styling hooks in Stack.module.css, e.g. javascript."
                />
              </div>

              <ImageField
                label="Logo"
                kind="logo"
                round
                value={draft.logoPath}
                error={errors.logoPath}
                onChange={(logoPath) =>
                  setDraft(
                    // A new image has nothing to do with how the previous one
                    // was framed, so replacing it starts from centred rather
                    // than silently inheriting a crop meant for another file.
                    logoPath === draft.logoPath
                      ? { ...draft, logoPath }
                      : withFit({ ...draft, logoPath }, LOGO_FIT_DEFAULT),
                  )
                }
              />

              {draft.logoPath ? (
                <LogoFitField
                  logoPath={draft.logoPath}
                  brandKey={draft.brandKey}
                  iconMode={draft.iconMode}
                  nodeBackground={draft.nodeBackground || null}
                  fit={draftFit(draft)}
                  onChange={(fit) => setDraft(withFit(draft, fit))}
                />
              ) : null}

              <div className="dashFieldRow">
                <SelectField
                  label="Orbit ring"
                  value={draft.ring}
                  onChange={(event) =>
                    setDraft({ ...draft, ring: event.target.value as OrbitRing })
                  }
                >
                  {ORBIT_RINGS.map((ring) => (
                    <option key={ring} value={ring}>
                      {RING_LABEL[ring]} — fits {RING_CAPACITY[ring]}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  label="Icon colour"
                  value={draft.iconMode}
                  hint="Dark and white recolour the logo; original leaves it alone."
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      iconMode: event.target.value as IconMode,
                    })
                  }
                >
                  {ICON_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode[0].toUpperCase() + mode.slice(1)}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="dashFieldRow">
                <TextField
                  label="Node background"
                  type="text"
                  placeholder="#FFFFFF"
                  value={draft.nodeBackground}
                  error={errors.nodeBackground}
                  hint="Optional hex colour. Leave empty to keep the brand default."
                  onChange={(event) =>
                    setDraft({ ...draft, nodeBackground: event.target.value })
                  }
                />
                <TextField
                  label="Angle (degrees)"
                  type="number"
                  min={0}
                  max={360}
                  step={1}
                  value={draft.angle}
                  disabled={!draft.manualAngle}
                  error={errors.angle}
                  hint={
                    draft.manualAngle
                      ? "0 is the top of the ring, increasing clockwise."
                      : "Angles are spread evenly around the ring."
                  }
                  onChange={(event) =>
                    setDraft({ ...draft, angle: event.target.value })
                  }
                />
              </div>

              <CheckboxField
                label="Place this node manually"
                hint="Off means the ring distributes its nodes evenly, in list order."
                checked={draft.manualAngle}
                onChange={(manualAngle) =>
                  setDraft({
                    ...draft,
                    manualAngle,
                    angle: manualAngle && draft.angle === "" ? "0" : draft.angle,
                  })
                }
              />

              <CheckboxField
                label="Show on the portfolio"
                hint="Disabled technologies stay here but leave the public orbit."
                checked={draft.enabled}
                onChange={(enabled) => setDraft({ ...draft, enabled })}
              />

              <div className="dashHeaderActions">
                <button
                  type="button"
                  className="dashButton dashButtonPrimary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save technology"}
                </button>
                <button
                  type="button"
                  className="dashButton dashButtonGhost"
                  onClick={() => {
                    setDraft(null);
                    setErrors({});
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <aside className="dashPreview" aria-label="Orbit preview">
        <div className="dashPreviewHead">
          <h2 className="dashPreviewTitle">Live preview</h2>
          <button
            type="button"
            className="dashButton dashButtonSmall"
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>

        <div className="dashOrbitStage">
          <div className="dashOrbitScale">
            <StackOrbit technologies={previewItems} paused={paused} />
          </div>
        </div>

        <p className="dashHint">
          The real Stack Orbit component at 58% scale, with its actual speeds and
          directions. Motion is disabled automatically for visitors who prefer
          reduced motion.
        </p>

        <dl style={{ display: "grid", gap: 4, margin: 0 }}>
          {ORBIT_RINGS.map((ring) => {
            const enabled = byRing[ring].filter((item) => item.enabled);
            const angles = layoutRing(enabled);
            return (
              <div
                key={ring}
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <dt className="dashRowMeta">{RING_LABEL[ring]}</dt>
                <dd className="dashRowMeta" style={{ margin: 0 }}>
                  {enabled.length} / {RING_CAPACITY[ring]}
                  {angles.length > 1
                    ? ` · ${Math.round(360 / angles.length)}° apart`
                    : ""}
                </dd>
              </div>
            );
          })}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid var(--dash-hairline, rgb(0 0 0 / 0.08))",
              marginTop: 4,
              paddingTop: 4,
            }}
          >
            <dt className="dashRowMeta">Showing</dt>
            <dd className="dashRowMeta" style={{ margin: 0 }}>
              {items.filter((item) => item.enabled).length} /{" "}
              {MAX_ACTIVE_TECHNOLOGIES}
            </dd>
          </div>
        </dl>
      </aside>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this technology?"
        description={`${pendingDelete?.name ?? "This technology"} will be deleted from the orbit. This cannot be undone.`}
        confirmLabel="Remove"
        busy={saving}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function RingPanel({
  ring,
  items,
  busy,
  editingId,
  onMove,
  onEdit,
  onRingChange,
  onDelete,
  onAdd,
}: {
  ring: OrbitRing;
  items: StackTechRecord[];
  busy: boolean;
  editingId: string | null;
  onMove: (from: number, to: number) => void;
  onEdit: (item: StackTechRecord) => void;
  onRingChange: (item: StackTechRecord, ring: OrbitRing) => void;
  onDelete: (item: StackTechRecord) => void;
  onAdd: () => void;
}) {
  const sortable = useSortable({
    label: RING_LABEL[ring],
    itemLabel: (index) => items[index]?.name ?? "technology",
    count: items.length,
    onMove,
    disabled: busy,
  });

  return (
    <section className="dashPanel" aria-label={RING_LABEL[ring]}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h2 className="dashPanelTitle">{RING_LABEL[ring]}</h2>
          <p className="dashPanelNote" style={{ margin: 0 }}>
            {RING_NOTE[ring]} · {items.length} of {RING_CAPACITY[ring]}
          </p>
        </div>
        <button type="button" className="dashButton dashButtonSmall" onClick={onAdd}>
          Add here
        </button>
      </div>

      {items.length === 0 ? (
        <p className="dashHint">Nothing on this ring yet.</p>
      ) : (
        <ul className="dashList">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="dashRow"
              data-selected={editingId === item.id ? "true" : undefined}
              {...sortable.getRowProps(index)}
            >
              <button {...sortable.getHandleProps(index)}>
                <DragHandleIcon />
              </button>

              <div className="dashRowBody">
                <StackNodePreview
                  brandKey={item.brandKey}
                  iconMode={item.iconMode}
                  nodeBackground={item.nodeBackground}
                  logoPath={item.logoPath}
                  fit={{
                    scale: item.logoScale,
                    offsetX: item.logoOffsetX,
                    offsetY: item.logoOffsetY,
                  }}
                />
                <span className="dashRowText">
                  <span className="dashRowTitle">{item.name}</span>
                  <span className="dashRowMeta">
                    {item.brandKey}
                    {item.manualAngle && item.angle !== null
                      ? ` · ${item.angle}°`
                      : ""}
                    {item.enabled ? "" : " · hidden"}
                  </span>
                </span>
              </div>

              <div className="dashRowActions">
                <label className="dashSrOnly" htmlFor={`ring-${item.id}`}>
                  Move {item.name} to another ring
                </label>
                <select
                  id={`ring-${item.id}`}
                  className="dashSelect"
                  style={{ width: "auto", minHeight: 30, fontSize: 13 }}
                  value={item.ring}
                  disabled={busy}
                  onChange={(event) =>
                    onRingChange(item, event.target.value as OrbitRing)
                  }
                >
                  {ORBIT_RINGS.map((option) => (
                    <option key={option} value={option}>
                      {RING_LABEL[option]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="dashButton dashButtonSmall"
                  onClick={() => onEdit(item)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="dashButton dashButtonSmall dashButtonDanger"
                  onClick={() => onDelete(item)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="dashSrOnly" aria-live="polite">
        {sortable.announcement}
      </p>
    </section>
  );
}
