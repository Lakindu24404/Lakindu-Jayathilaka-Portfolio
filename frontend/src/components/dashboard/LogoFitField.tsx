"use client";

import { useId, useRef, type CSSProperties, type PointerEvent } from "react";
import stackStyles from "@/components/home/Stack.module.css";
import { StackNodeLogo, nodeBackgroundStyle } from "@/components/home/StackNode";
import {
  clampLogoOffset,
  fromZoomPercent,
  toZoomPercent,
  LOGO_FIT_DEFAULT,
  LOGO_OFFSET,
  LOGO_SCALE,
  type LogoFit,
} from "@/lib/data/logo-fit";
import type { IconMode } from "@/lib/data/types";

/**
 * Frame an already-uploaded logo inside its circular orbit node.
 *
 * The preview is the real `.node` from `Stack.module.css` at editing size —
 * same circle, same clip, same brand rules, same transform — so nothing here
 * re-implements the rendering the public orbit does. Editing is purely local:
 * every change is handed straight back through `onChange`, and nothing is
 * written until the surrounding form is saved.
 *
 * Dragging uses Pointer Events with pointer capture, so mouse, touch and pen
 * behave identically and a drag that leaves the circle keeps tracking. The
 * three sliders are a complete keyboard-accessible alternative to it: they
 * reach every value a drag can, and the zoom is only reachable that way.
 */

/** The editing size of the preview circle. */
const PREVIEW_SIZE = 176;

type PreviewStyle = CSSProperties & { "--node-size": string };

type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  /** The offsets when the drag began, so a drag never accumulates rounding. */
  originX: number;
  originY: number;
  /** The rendered diameter, which is what the offsets are a percentage of. */
  size: number;
};

export function LogoFitField({
  logoPath,
  brandKey,
  iconMode,
  nodeBackground,
  fit,
  onChange,
}: {
  logoPath: string;
  brandKey: string;
  iconMode: IconMode;
  nodeBackground: string | null;
  fit: LogoFit;
  onChange: (fit: LogoFit) => void;
}) {
  const groupId = useId();
  const zoomId = `${groupId}-zoom`;
  const xId = `${groupId}-x`;
  const yId = `${groupId}-y`;
  const drag = useRef<Drag | null>(null);

  const zoomPercent = toZoomPercent(fit.scale);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // Ignore secondary mouse buttons; touch and pen report button 0 as well.
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const circle = event.currentTarget;
    const { width } = circle.getBoundingClientRect();
    circle.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: fit.offsetX,
      originY: fit.offsetY,
      size: width || PREVIEW_SIZE,
    };
    // Stops the browser starting its own image drag from inside the circle.
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;

    // Pointer travel as a share of the node's diameter, which is exactly what
    // the stored offsets mean — so a drag of half the circle is 50 units, at
    // any preview size and any orbit size.
    const deltaX = ((event.clientX - active.startX) / active.size) * 100;
    const deltaY = ((event.clientY - active.startY) / active.size) * 100;

    onChange({
      scale: fit.scale,
      offsetX: clampLogoOffset(active.originX + deltaX),
      offsetY: clampLogoOffset(active.originY + deltaY),
    });
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const previewStyle: PreviewStyle = { "--node-size": `${PREVIEW_SIZE}px` };

  return (
    <div className="dashField">
      <span className="dashLabel" id={groupId}>
        Logo fit
      </span>

      <div className="dashFit" role="group" aria-labelledby={groupId}>
        <div className="dashFitStage">
          <div
            className={stackStyles.fitPreview}
            // The same two hooks the orbit anchor sets, so the brand disc
            // colours, the brand logo base sizes and the icon colour mode all
            // apply here exactly as they will on the homepage.
            data-brand={brandKey || undefined}
            data-icon={iconMode}
            style={previewStyle}
            onPointerDownCapture={handlePointerDown}
            onPointerMoveCapture={handlePointerMove}
            onPointerUpCapture={endDrag}
            onPointerCancelCapture={endDrag}
            onLostPointerCapture={endDrag}
          >
            <div
              className={stackStyles.node}
              style={nodeBackgroundStyle(nodeBackground)}
            >
              <StackNodeLogo logoPath={logoPath} fit={fit} />
            </div>
          </div>

          <button
            type="button"
            className="dashButton dashButtonSmall"
            onClick={() => onChange({ ...LOGO_FIT_DEFAULT })}
          >
            Reset fit
          </button>
        </div>

        <div className="dashFitControls">
          <div className="dashFitRow">
            <div className="dashFitRowHead">
              <label className="dashLabel" htmlFor={zoomId}>
                Zoom
              </label>
              <span className="dashFitValue">{zoomPercent}%</span>
            </div>
            <input
              id={zoomId}
              className="dashRange"
              type="range"
              min={toZoomPercent(LOGO_SCALE.min)}
              max={toZoomPercent(LOGO_SCALE.max)}
              step={toZoomPercent(LOGO_SCALE.step)}
              value={zoomPercent}
              aria-valuetext={`${zoomPercent} percent`}
              onChange={(event) =>
                onChange({
                  ...fit,
                  scale: fromZoomPercent(Number(event.target.value)),
                })
              }
            />
          </div>

          <div className="dashFitRow">
            <div className="dashFitRowHead">
              <label className="dashLabel" htmlFor={xId}>
                Horizontal position
              </label>
              <span className="dashFitValue">{fit.offsetX}</span>
            </div>
            <input
              id={xId}
              className="dashRange"
              type="range"
              min={LOGO_OFFSET.min}
              max={LOGO_OFFSET.max}
              step={LOGO_OFFSET.step}
              value={fit.offsetX}
              onChange={(event) =>
                onChange({
                  ...fit,
                  offsetX: clampLogoOffset(Number(event.target.value)),
                })
              }
            />
          </div>

          <div className="dashFitRow">
            <div className="dashFitRowHead">
              <label className="dashLabel" htmlFor={yId}>
                Vertical position
              </label>
              <span className="dashFitValue">{fit.offsetY}</span>
            </div>
            <input
              id={yId}
              className="dashRange"
              type="range"
              min={LOGO_OFFSET.min}
              max={LOGO_OFFSET.max}
              step={LOGO_OFFSET.step}
              value={fit.offsetY}
              onChange={(event) =>
                onChange({
                  ...fit,
                  offsetY: clampLogoOffset(Number(event.target.value)),
                })
              }
            />
          </div>

          <p className="dashHint">
            Drag the logo inside the circle to reposition it, or use the
            sliders — they reach every value a drag can. The uploaded file is
            never changed; only the framing is stored, and it is saved with the
            rest of the technology.
          </p>
        </div>
      </div>
    </div>
  );
}
