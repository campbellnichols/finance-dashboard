import { NextResponse } from "next/server";
import { readStore } from "../../../../lib/persist";

export const runtime = "nodejs";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    connected: Boolean(store.access_token),
    last_synced: store.updated_at ?? null,
  });
}
