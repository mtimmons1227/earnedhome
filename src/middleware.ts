import { NextResponse, type NextRequest } from "next/server";
import { slugFromHost } from "@/lib/tenant";

// Resolves the tenant from the request host and exposes it via a request
// header so server components / route handlers can read it without re-parsing.
export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  const slug = slugFromHost(host);
  const res = NextResponse.next();
  res.headers.set("x-tenant-slug", slug);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
