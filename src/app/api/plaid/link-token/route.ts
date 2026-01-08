import { NextResponse } from "next/server";
import { plaidClient } from "@/src/lib/plaid";

export async function POST() {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: "demo-user" },
    client_name: "Personal Finance Dashboard",
    products: ["transactions"],
    country_codes: ["US"],
    language: "en",
  });

  return NextResponse.json(response.data);
}
