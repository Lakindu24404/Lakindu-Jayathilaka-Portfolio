import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  UPLOAD_RULES,
  isUploadKind,
  safeObjectName,
  sniffImageType,
  validateSvg,
} from "@/lib/uploads";

/**
 * Asset uploads.
 *
 * A route handler rather than a Server Action so the browser can report real
 * upload progress via XHR, and because Server Actions cap request bodies at
 * 1 MB by default. Everything that matters — the admin check, the type sniff,
 * the SVG scan, the size limit — happens here on the server; the client's
 * matching checks exist only to fail fast.
 */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: "You need to sign in as an administrator to upload files." },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "That upload could not be read." },
      { status: 400 },
    );
  }

  const kind = form.get("kind");
  const file = form.get("file");

  if (!isUploadKind(kind)) {
    return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was sent." }, { status: 400 });
  }

  const rule = UPLOAD_RULES[kind];

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > rule.maxBytes) {
    return NextResponse.json(
      { error: `That file is too large. Accepted: ${rule.label}.` },
      { status: 413 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!rule.extensions.includes(extension)) {
    return NextResponse.json(
      { error: `Unsupported file type. Accepted: ${rule.label}.` },
      { status: 415 },
    );
  }

  // Trust the bytes, not the extension or the declared content type.
  let contentType: string;

  if (extension === "svg") {
    const problem = validateSvg(new TextDecoder().decode(buffer));
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 415 });
    }
    contentType = "image/svg+xml";
  } else {
    const sniffed = sniffImageType(buffer);
    if (!sniffed || !rule.mimeTypes.includes(sniffed)) {
      return NextResponse.json(
        { error: "That file is not a valid image." },
        { status: 415 },
      );
    }
    contentType = sniffed;
  }

  const objectName = safeObjectName(file.name);

  const { error } = await session.client.storage
    .from(rule.bucket)
    .upload(objectName, buffer, { contentType, upsert: false });

  if (error) {
    console.error("[dashboard] upload failed:", error);
    return NextResponse.json(
      { error: "The file could not be stored. Try again." },
      { status: 502 },
    );
  }

  const {
    data: { publicUrl },
  } = session.client.storage.from(rule.bucket).getPublicUrl(objectName);

  return NextResponse.json({ url: publicUrl, name: objectName });
}
