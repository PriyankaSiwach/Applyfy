/** Same behavior as POST /api/analyze (match scores come from that pipeline). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export { POST } from "../analyze/route";
