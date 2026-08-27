import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { requireTenantAdmin } from "@/lib/auth-admin";

export const dynamic = "force-dynamic";

// POST (multipart/form-data, field "file") — convert an uploaded Word .docx into
// clean HTML for the broadcast body, preserving bold/italics/bullets/links. Merge
// tokens Richard typed in Word (e.g. {first_name}, {link}) survive as plain text and
// are filled in at send time. Admin-only.
export async function POST(req: Request) {
  const gate = await requireTenantAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected a file upload" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!/\.docx$/i.test(file.name)) return NextResponse.json({ error: "Please upload a Word .docx file" }, { status: 422 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { value: html } = await mammoth.convertToHtml({ buffer });
    if (!html || !html.trim()) return NextResponse.json({ error: "That document appears to be empty." }, { status: 422 });
    return NextResponse.json({ html, filename: file.name });
  } catch (e) {
    return NextResponse.json({ error: `Could not read the document: ${(e as Error).message}` }, { status: 422 });
  }
}
