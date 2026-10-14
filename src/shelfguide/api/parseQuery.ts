import type { NextRequest } from "next/server";

export type ParsedQuery =
  | { ok: true; from: string; to: string; locationId: number | undefined }
  | { ok: false; error: string };

export function parseShelfGuideQuery(req: NextRequest): ParsedQuery {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
    return { ok: false, error: "from and to are required as YYYY-MM-DD" };
  }
  if (from > to) {
    return { ok: false, error: "from must be on or before to" };
  }

  const locationIdParam = searchParams.get("locationId");
  let locationId: number | undefined;
  if (locationIdParam) {
    const n = Number(locationIdParam);
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, error: "locationId must be a positive integer" };
    }
    locationId = n;
  }

  return { ok: true, from, to, locationId };
}
