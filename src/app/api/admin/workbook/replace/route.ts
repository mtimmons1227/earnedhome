import { NextResponse } from "next/server";
import { requireWorkbookAdmin } from "@/lib/auth-admin";
import { looksLikeXlsx, replaceWorkbook, verifyNamedRange } from "@/lib/workbook-file";

export const dynamic = "force-dynamic";

const MIN_BYTES = 5_000;          // a real workbook is bigger than this
const MAX_BYTES = 50_000_000;     // guard against accidental huge uploads

// POST (multipart/form-data, field "file") — replace the workbook in place.
// The app controls the destination + filename; the LO only picks which local file.
export async function POST(req: Request) {
  const gate = await requireWorkbookAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Expected a file upload" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "File must be an .xlsx workbook" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "File size looks wrong for a workbook — upload was not applied." },
      { status: 400 },
    );
  }
  if (!looksLikeXlsx(buf)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid .xlsx file — upload was not applied." },
      { status: 400 },
    );
  }

  try {
    await replaceWorkbook(buf);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  // Confirm the replaced file still has its tags. If not, the LO should restore
  // the previous version from SharePoint version history.
  const verified = await verifyNamedRange();
  return NextResponse.json({
    ok: true,
    verified,
    message: verified
      ? "Workbook replaced and verified. The website will use the new rates."
      : "Workbook was replaced, but its named ranges could not be verified. " +
        "If the site shows errors, restore the previous version from SharePoint version history.",
  });
}
