import { NextResponse } from "next/server";
import { plaidClient } from "../../../../lib/plaid";
import { Products, CountryCode } from "plaid";

export const runtime = "nodejs";

export async function POST() {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: "demo-user" },
    client_name: "Personal Finance Dashboard",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });

  return NextResponse.json({ link_token: response.data.link_token });
}
