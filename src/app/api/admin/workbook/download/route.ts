import { NextResponse } from "next/server";
import { requireWorkbookAdmin } from "@/lib/auth-admin";
import { downloadWorkbook } from "@/lib/workbook-file";

export const dynamic = "force-dynamic";

// GET — stream the current workbook to the signed-in loan officer's browser.
// The app picks the source file + filename; the browser decides where it saves.
export async function GET() {
  const gate = await requireWorkbookAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  try {
    const { bytes, filename } = await downloadWorkbook();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
