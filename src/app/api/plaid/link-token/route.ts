import { NextResponse } from "next/server";
import { plaidClient } from "../../../../lib/plaid";
import { Products, CountryCode } from "plaid";

export const runtime = "nodejs";

async function createLinkToken() {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: "demo-user" },
    client_name: "Personal Finance Dashboard",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });

  return response.data.link_token;
}

export async function GET() {
  try {
    const link_token = await createLinkToken();
    return NextResponse.json({ link_token });
  } catch (err: any) {
    return NextResponse.json(
      { error: "LINK_TOKEN_FAILED", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
