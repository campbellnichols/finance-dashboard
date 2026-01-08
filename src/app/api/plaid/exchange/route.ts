import { NextResponse } from "next/server";
import { plaidClient } from "../../../../lib/plaid";
import { writeStore } from "../../../../lib/persist";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { public_token } = await req.json();

  const response = await plaidClient.itemPublicTokenExchange({
    public_token,
  });

  await writeStore({ access_token: response.data.access_token });

  return NextResponse.json({ success: true });
}
