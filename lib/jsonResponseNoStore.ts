import { NextResponse } from "next/server";

/** JSON response with Cache-Control: no-store (avoids intermediary caching). */
export function jsonNoStore(
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
