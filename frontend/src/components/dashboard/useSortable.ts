"use client";

import {
  useCallback,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";

/** Move one element of an array, returning a new array. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.min(to, next.length), 0, moved);
  return next;
}

type SortableOptions = {
  /** Labels the list for the screen-reader announcements. */
  label: string;
  itemLabel: (index: number) => string;
  onMove: (from: number, to: number) => void;
  count: number;
  disabled?: boolean;
};

/**
 * Drag-and-drop reordering with a keyboard equivalent, written against native
 * DOM events rather than pulling in a drag library.
 *
 * Keyboard: focus the handle, press Space or Enter to pick the row up, move it
 * with the arrow keys, and press Space, Enter or Escape to drop it. Every
 * change is announced through the returned live-region message.
 */
export function useSortable({
  label,
  itemLabel,
  onMove,
  count,
  disabled = false,
}: SortableOptions) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [grabbedIndex, setGrabbedIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // The label is passed in rather than looked up, because after a move the
  // item at that index is the one that was displaced, not the one that moved.
  const announce = useCallback(
    (name: string, verb: string, index: number) => {
      setAnnouncement(
        `${name} ${verb}, position ${index + 1} of ${count} in ${label}.`,
      );
    },
    [count, label],
  );

  const commit = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      onMove(from, to);
    },
    [onMove],
  );

  const getHandleProps = useCallback(
    (index: number) => ({
      type: "button" as const,
      className: "dashHandle",
      draggable: !disabled,
      disabled,
      "aria-label": `Reorder ${itemLabel(index)}`,
      "aria-describedby": "dash-sortable-help",
      "aria-pressed": grabbedIndex === index,
      "data-grabbed": grabbedIndex === index ? "true" : undefined,
      onDragStart: (event: DragEvent<HTMLButtonElement>) => {
        if (disabled) return;
        setDragIndex(index);
        event.dataTransfer.effectAllowed = "move";
        // Firefox needs data on the transfer for a drag to start at all.
        event.dataTransfer.setData("text/plain", String(index));
      },
      onDragEnd: () => {
        setDragIndex(null);
        setOverIndex(null);
      },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;

        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          if (grabbedIndex === index) {
            setGrabbedIndex(null);
            announce(itemLabel(index), "dropped", index);
          } else {
            setGrabbedIndex(index);
            announce(itemLabel(index), "grabbed", index);
          }
          return;
        }

        if (event.key === "Escape" && grabbedIndex !== null) {
          event.preventDefault();
          setGrabbedIndex(null);
          setAnnouncement("Reordering cancelled.");
          return;
        }

        if (grabbedIndex !== index) return;

        const delta =
          event.key === "ArrowUp" || event.key === "ArrowLeft"
            ? -1
            : event.key === "ArrowDown" || event.key === "ArrowRight"
              ? 1
              : 0;

        if (delta === 0) return;
        event.preventDefault();

        const target = index + delta;
        if (target < 0 || target >= count) return;

        const name = itemLabel(index);
        commit(index, target);
        setGrabbedIndex(target);
        announce(name, "moved", target);
      },
    }),
    [announce, commit, count, disabled, grabbedIndex, itemLabel],
  );

  const getRowProps = useCallback(
    (index: number) => ({
      "data-dragging": dragIndex === index ? "true" : undefined,
      "data-drop-target":
        overIndex === index && dragIndex !== null && dragIndex !== index
          ? "true"
          : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (disabled || dragIndex === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOverIndex(index);
      },
      onDragLeave: () => {
        setOverIndex((current) => (current === index ? null : current));
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (disabled || dragIndex === null) return;
        event.preventDefault();
        commit(dragIndex, index);
        setDragIndex(null);
        setOverIndex(null);
      },
    }),
    [commit, disabled, dragIndex, overIndex],
  );

  return { getHandleProps, getRowProps, announcement, grabbedIndex };
}

export const SORTABLE_HELP =
  "Press Space to pick up, arrow keys to move, Space again to drop.";
