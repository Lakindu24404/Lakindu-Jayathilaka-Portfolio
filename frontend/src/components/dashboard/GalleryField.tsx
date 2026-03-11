"use client";

import Image from "next/image";
import { useRef } from "react";
import {
  SORTABLE_HELP,
  moveItem,
  useSortable,
} from "@/components/dashboard/useSortable";
import { useUpload } from "@/components/dashboard/useUpload";
import { describeRule } from "@/lib/uploads";

/**
 * The ordered gallery for a project. The first three entries are what
 * `ProjectPhotos` fans out on the case study page, which the hint spells out
 * so ordering has an obvious consequence.
 */
export function GalleryField({
  images,
  onChange,
  max = 12,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error } = useUpload("project");

  const sortable = useSortable({
    label: "the gallery",
    itemLabel: (index) => `Image ${index + 1}`,
    count: images.length,
    onMove: (from, to) => onChange(moveItem(images, from, to)),
  });

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const room = max - images.length;
    const next: string[] = [];

    for (const file of Array.from(files).slice(0, Math.max(room, 0))) {
      const url = await upload(file);
      if (url) next.push(url);
    }

    if (next.length > 0) onChange([...images, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="dashField">
      <span className="dashLabel">Gallery images</span>

      {images.length === 0 ? (
        <p className="dashHint">
          No gallery images yet. The case study falls back to the card thumbnail
          until you add some.
        </p>
      ) : (
        <ul className="dashGallery">
          {images.map((image, index) => (
            <li
              key={`${image}-${index}`}
              className="dashGalleryItem"
              {...sortable.getRowProps(index)}
            >
              <div className="dashGalleryFrame">
                <Image
                  src={image}
                  alt={`Gallery image ${index + 1}`}
                  fill
                  sizes="160px"
                  unoptimized
                />
              </div>
              <div className="dashGalleryActions">
                <button {...sortable.getHandleProps(index)}>
                  <span aria-hidden="true">⠿</span>
                </button>
                <span className="dashRowMeta">{index + 1}</span>
                <button
                  type="button"
                  className="dashButton dashButtonSmall dashButtonDanger"
                  onClick={() =>
                    onChange(images.filter((_, position) => position !== index))
                  }
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <button
          type="button"
          className="dashButton dashButtonSmall"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || images.length >= max}
        >
          {uploading ? `Uploading ${progress}%` : "Add images"}
        </button>
        <span className="dashRowMeta">
          {images.length} of {max}
        </span>
      </div>

      {uploading ? (
        <div
          className="dashProgress"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Uploading gallery image"
          style={{ marginTop: 8 }}
        >
          <div className="dashProgressBar" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <p className="dashHint">
        The first three images are the ones the case study fans out at the top of
        the page. {describeRule("project")}. {SORTABLE_HELP}
      </p>
      {error ? <p className="dashError">{error}</p> : null}

      <p className="dashSrOnly" aria-live="polite">
        {sortable.announcement}
      </p>

      <input
        ref={fileRef}
        type="file"
        multiple
        className="dashSrOnly"
        tabIndex={-1}
        aria-hidden="true"
        accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
        onChange={(event) => void addFiles(event.target.files)}
      />
    </div>
  );
}
