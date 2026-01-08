import { NextResponse } from "next/server";
import { plaidClient } from "../../../../lib/plaid";
import { getAccessTokenFromDisk } from "../../../../lib/persist";

export const runtime = "nodejs";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const accessToken = await getAccessTokenFromDisk();

  if (!accessToken) {
    return NextResponse.json({ error: "NOT_CONNECTED", transactions: [] });
  }

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  const response = await plaidClient.transactionsGet({
    access_token: accessToken,
    start_date: toISODate(start),
    end_date: toISODate(end),
  });

  return NextResponse.json({
    accounts: response.data.accounts,
    transactions: response.data.transactions,
    total_transactions: response.data.total_transactions,
  });
}
