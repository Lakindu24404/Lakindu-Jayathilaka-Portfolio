/**
 * Whether `next/image` can serve `src`: bundled `/images/...` assets, and the
 * Supabase Storage bucket `next.config.ts` allow-lists. Project imagery may be
 * any other https URL (see `assetPath` in lib/data/schemas.ts), which the
 * optimizer would reject, so those stay plain `<img>` elements.
 */
export function canOptimizeImage(src: string) {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  return (
    !!supabase &&
    supabase.startsWith("https://") &&
    src.startsWith(`${supabase}/storage/v1/object/public/`)
  );
}
