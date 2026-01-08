"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export default function ConnectBankButton() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((res) => res.json())
      .then((data) => setToken(data.link_token));
  }, []);

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: async (public_token) => {
      await fetch("/api/plaid/exchange", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ public_token }),
});


      // Reload to allow transaction fetch
      window.location.reload();
    },
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="px-4 py-2 bg-black text-white rounded-lg"
    >
      Connect Bank
    </button>
  );
}
