"use client";

import { useEffect, useMemo, useState } from "react";

import ConnectBankButton from "@/src/components/ConnectBankButton";
import SankeyChart from "@/src/components/SankeyChart";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";


type Range = "1W" | "1M" | "3M" | "1Y";

const financeData = {
  "1W": { income: 1200, expenses: 800, savings: 400 },
  "1M": { income: 5000, expenses: 3200, savings: 1800 },
  "3M": { income: 15000, expenses: 9800, savings: 5200 },
  "1Y": { income: 60000, expenses: 42000, savings: 18000 },
};

const transactions = {
  "1W": [
    { date: "Sep 18", description: "Grocery Store", category: "Food", amount: -84 },
    { date: "Sep 17", description: "Gas Station", category: "Transport", amount: -45 },
    { date: "Sep 16", description: "Paycheck", category: "Income", amount: 1200 },
  ],
  "1M": [
    { date: "Sep 18", description: "Grocery Store", category: "Food", amount: -84 },
    { date: "Sep 15", description: "Rent", category: "Housing", amount: -1200 },
    { date: "Sep 10", description: "Paycheck", category: "Income", amount: 2500 },
    { date: "Sep 05", description: "Electric Bill", category: "Utilities", amount: -120 },
  ],
  "3M": [
    { date: "Aug", description: "Vacation", category: "Travel", amount: -1800 },
    { date: "Jul", description: "Paycheck", category: "Income", amount: 7500 },
    { date: "Jun", description: "Car Repair", category: "Auto", amount: -600 },
  ],
  "1Y": [
    { date: "Q4", description: "Bonus", category: "Income", amount: 5000 },
    { date: "Q3", description: "Tuition", category: "Education", amount: -8000 },
    { date: "Q2", description: "Paychecks", category: "Income", amount: 30000 },
  ],
};

type DashboardTxn = {
  date: string;          // YYYY-MM-DD
  description: string;
  category: string;
  amount: number;        // income positive, expense negative
  accountId: string;
  accountName: string;
};

function rangeStartDate(range: Range) {
  const end = new Date();
  const start = new Date(end);

  const days =
    range === "1W" ? 7 :
    range === "1M" ? 30 :
    range === "3M" ? 90 :
    365;

  start.setDate(end.getDate() - days);
  // compare as YYYY-MM-DD strings
  return start.toISOString().slice(0, 10);
}

type BaseTxn = {
  date: string;
  description: string;
  category: string;
  amount: number;
};

// Plaid amounts are often positive for spending; income is best detected via personal_finance_category when available.
// This normalizes to: income (+), expense (-).
function normalizePlaidTxn(tx: any): BaseTxn {
  const date = tx.date; // already YYYY-MM-DD
  const description = tx.name ?? tx.merchant_name ?? "Transaction";

  const category =
    tx.personal_finance_category?.primary ??
    (Array.isArray(tx.category) ? tx.category[0] : undefined) ??
    "Other";

  const isIncome =
    tx.personal_finance_category?.primary === "INCOME" ||
    (typeof tx.personal_finance_category?.detailed === "string" &&
      tx.personal_finance_category.detailed.startsWith("INCOME"));

  const raw = Number(tx.amount ?? 0);

  // If Plaid marks it as INCOME, treat as +amount. Otherwise treat as expense (-amount).
  const amount = isIncome ? Math.abs(raw) : -Math.abs(raw);

  return { date, description, category, amount };
}

function computeSummary(txns: DashboardTxn[]) {
  const income = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const savings = income - expenses;
  return { income, expenses, savings };
}

function buildSankey(txns: { category: string; amount: number }[]) {
  const INCOME = "Income";
  const EXPENSES = "Expenses";

  let totalIncome = 0;
  const spendByCategory: Record<string, number> = {};

  for (const t of txns) {
    if (t.amount > 0) totalIncome += t.amount;

    if (t.amount < 0) {
      const cat = t.category || "Other";
      spendByCategory[cat] = (spendByCategory[cat] || 0) + Math.abs(t.amount);
    }
  }

  // Sort categories by spend and take top visible ones
  const topCats = Object.entries(spendByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const totalExpenses = topCats.reduce((s, [, v]) => s + v, 0);

  const nodes = [
    { name: INCOME },
    { name: EXPENSES },
    ...topCats.map(([name]) => ({ name })),
  ];

  const links = [
    { source: 0, target: 1, value: Math.round(totalExpenses) },
    ...topCats.map(([_, v], idx) => ({
      source: 1,
      target: 2 + idx,
      value: Math.round(v),
    })),
  ];

  return { nodes, links, totalIncome, totalExpenses };
}

function buildNetCashflowSeries(txns: { date: string; amount: number }[]) {
  // Group by date (YYYY-MM-DD)
  const byDate: Record<string, number> = {};

  for (const t of txns) {
    byDate[t.date] = (byDate[t.date] || 0) + t.amount;
  }

  const dates = Object.keys(byDate).sort(); // ascending YYYY-MM-DD
  let running = 0;

  return dates.map((d) => {
    running += byDate[d]; // net that day
    return { date: d, net: byDate[d], running };
  });
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  const escape = (v: any) => {
    const s = String(v ?? "");
    return `"${s.replaceAll('"', '""')}"`;
  };

  if (rows.length === 0) {
    const blob = new Blob(["No data"], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.csv$/i, "") + ".txt";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function Home() {
  const [range, setRange] = useState<Range>("1M");

  const [plaidTxns, setPlaidTxns] = useState<any[]>([]);
const [plaidError, setPlaidError] = useState<string | null>(null);

const [plaidTxnsRaw, setPlaidTxnsRaw] = useState<any[]>([]);
const [plaidLoaded, setPlaidLoaded] = useState(false);

const [lastSynced, setLastSynced] = useState<string | null>(null);
const [syncing, setSyncing] = useState(false);

const [search, setSearch] = useState("");
const [categoryFilter, setCategoryFilter] = useState("All");
const [typeFilter, setTypeFilter] = useState<"All" | "Income" | "Expenses">("All");

const [plaidAccounts, setPlaidAccounts] = useState<any[]>([]);

const [accountFilter, setAccountFilter] = useState("All");

const [pageSize, setPageSize] = useState(25);
const [page, setPage] = useState(1);

const [budgets, setBudgets] = useState<Record<string, number>>({
  Food: 400,
  Housing: 1200,
  Utilities: 200,
  Transport: 150,
});

useEffect(() => {
  setPage(1);
}, [range, search, categoryFilter, typeFilter, accountFilter]);

const accountNameById = useMemo(() => {
  const map: Record<string, string> = {};
  for (const a of plaidAccounts) {
    const name = [a.name, a.official_name].filter(Boolean)[0] || "Account";
    map[a.account_id] = name;
  }
  return map;
}, [plaidAccounts]);

const accountOptions = useMemo(() => {
  return ["All", ...plaidAccounts.map((a) => a.account_id)];
}, [plaidAccounts]);

async function loadPlaid() {
  setSyncing(true);
  try {
    const [txRes, statusRes] = await Promise.all([
      fetch("/api/plaid/transactions"),
      fetch("/api/plaid/status"),
    ]);

    const txData = await txRes.json();
    const statusData = await statusRes.json();

    setPlaidTxnsRaw(txData?.transactions ?? []);
    setPlaidAccounts(txData?.accounts ?? []);
    setLastSynced(statusData?.last_synced ?? null);
  } finally {
    setSyncing(false);
  }
}

useEffect(() => {
  fetch("/api/plaid/transactions")
    .then(res => res.json())
    .then(data => {
      setPlaidTxnsRaw(data?.transactions ?? []);
      setPlaidLoaded(true);
    })
    .catch(() => setPlaidLoaded(true));
}, []);

const dashboardTxnsAll = useMemo(() => {
  return plaidTxnsRaw.map((tx: any) => {
    const base = normalizePlaidTxn(tx); // your existing normalizer returns {date, description, category, amount}
    const accountId = tx.account_id ?? "unknown";
    const accountName = accountNameById[accountId] ?? "Account";
    return { ...base, accountId, accountName };
  });
}, [plaidTxnsRaw, accountNameById]);

const startISO = useMemo(() => rangeStartDate(range), [range]);

const dashboardTxns = useMemo(
  () => dashboardTxnsAll.filter(t => t.date >= startISO),
  [dashboardTxnsAll, startISO]
);

const thisMonthSpentByCategory = useMemo(() => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `${yyyy}-${mm}`; // YYYY-MM

  const acc: Record<string, number> = {};

  for (const t of dashboardTxnsAll) {
    if (!t.date?.startsWith(monthPrefix)) continue;
    if (t.amount >= 0) continue; // expenses only
    const cat = t.category || "Other";
    acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
  }

  return acc;
}, [dashboardTxnsAll]);

const alerts = useMemo(() => {
  const a: { type: "info" | "warn"; message: string }[] = [];

  // Week-over-week spending (expenses only)
  const startThisWeek = isoDaysAgo(7);
  const startLastWeek = isoDaysAgo(14);

  const spendThisWeek = dashboardTxnsAll
    .filter((t) => t.date >= startThisWeek && t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const spendLastWeek = dashboardTxnsAll
    .filter((t) => t.date >= startLastWeek && t.date < startThisWeek && t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  if (spendLastWeek > 0) {
    const pct = Math.round(((spendThisWeek - spendLastWeek) / spendLastWeek) * 100);
    if (pct >= 20) {
      a.push({ type: "warn", message: `Spending is up ${pct}% vs last week.` });
    } else if (pct <= -20) {
      a.push({ type: "info", message: `Nice—spending is down ${Math.abs(pct)}% vs last week.` });
    }
  }

  // Budget overages (this month)
  const over = Object.entries(budgets)
    .filter(([cat, limit]) => (thisMonthSpentByCategory[cat] || 0) > limit)
    .map(([cat]) => cat);

  if (over.length) {
    a.push({ type: "warn", message: `Over budget: ${over.join(", ")}.` });
  }

  return a;
}, [dashboardTxnsAll, budgets, thisMonthSpentByCategory]);

const summary = useMemo(() => computeSummary(dashboardTxns), [dashboardTxns]);

useEffect(() => {
  loadPlaid();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const data = financeData[range];

const categoryTotals = dashboardTxns
  .filter((tx) => tx.amount < 0)
  .reduce<Record<string, number>>((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + Math.abs(tx.amount);
    return acc;
  }, {});

  const sankey = useMemo(() => buildSankey(dashboardTxns), [dashboardTxns]);

const categoryChartData = Object.entries(categoryTotals).map(
  ([category, total]) => ({
    category,
    total,
  })
);

const netSeries = useMemo(
  () => buildNetCashflowSeries(dashboardTxns),
  [dashboardTxns]
);

const categoryOptions = useMemo(() => {
  const set = new Set<string>();
  for (const t of dashboardTxns) set.add(t.category || "Other");
  return ["All", ...Array.from(set).sort()];
}, [dashboardTxns]);

// 1️⃣ Filtered transactions (NO pagination here)
const filteredTxns = useMemo(() => {
  const q = search.trim().toLowerCase();

  return dashboardTxns.filter((t) => {
    // Type filter
    if (typeFilter === "Income" && t.amount <= 0) return false;
    if (typeFilter === "Expenses" && t.amount >= 0) return false;

    // Account filter
    if (accountFilter !== "All" && t.accountId !== accountFilter) return false;

    // Category filter
    if (categoryFilter !== "All" && t.category !== categoryFilter) return false;

    // Search filter
    if (q) {
      const hay = `${t.description} ${t.category} ${t.accountName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}, [dashboardTxns, search, categoryFilter, typeFilter, accountFilter]);

// 2️⃣ Pagination logic (MUST be outside useMemo)
const totalPages = Math.max(1, Math.ceil(filteredTxns.length / pageSize));
const startIdx = (page - 1) * pageSize;
const endIdx = startIdx + pageSize;
const pagedTxns = filteredTxns.slice(startIdx, endIdx);

  return (
    <main className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">
        Personal Finance Dashboard
      </h1>
      
      

    {plaidLoaded && plaidTxnsRaw.length === 0 && (
  <p className="text-sm text-gray-500">
    No Plaid transactions yet. Click “Connect Bank” to load Sandbox data.
  </p>
)}

<div className="flex items-center gap-3">
  <ConnectBankButton />

  <button
    onClick={loadPlaid}
    disabled={syncing}
    className="px-4 py-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50"
  >
    {syncing ? "Syncing..." : "Sync Plaid"}
  </button>

  {lastSynced && (
    <p className="text-sm text-gray-500">
      Last synced: {new Date(lastSynced).toLocaleString()}
    </p>
  )}
</div>

{/* Alerts */}
{alerts.length > 0 && (
  <div className="space-y-2">
    {alerts.map((al, idx) => (
      <div
        key={idx}
        className={`p-3 border rounded-lg ${
          al.type === "warn"
            ? "bg-red-50 border-red-200"
            : "bg-blue-50 border-blue-200"
        }`}
      >
        <p className="text-sm">{al.message}</p>
      </div>
    ))}
  </div>
)}

      {/* Time Range Filters */}
      <div className="flex gap-3">
        {(["1W", "1M", "3M", "1Y"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-lg border
              ${range === r ? "bg-black text-white" : "hover:bg-gray-100"}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border rounded-xl">
          <p className="text-gray-500">Income</p>
          <p className="text-2xl font-semibold">
            ${summary.income.toLocaleString()}
          </p>
        </div>

        <div className="p-6 border rounded-xl">
          <p className="text-gray-500">Expenses</p>
          <p className="text-2xl font-semibold">
            ${summary.expenses.toLocaleString()}
          </p>
        </div>

        <div className="p-6 border rounded-xl">
          <p className="text-gray-500">Savings</p>
          <p className="text-2xl font-semibold">
            ${summary.savings.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Budgets (This Month) */}
<div className="p-6 border rounded-xl">
  <h2 className="text-lg font-semibold mb-4">Budgets (This Month)</h2>

  <div className="space-y-4">
    {Object.entries(budgets).map(([cat, limit]) => {
      const spent = thisMonthSpentByCategory[cat] || 0;
      const pct =
        limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

      return (
        <div key={cat} className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <p className="font-medium w-40">{cat}</p>

            <p className="text-sm text-gray-600">
              Spent ${spent.toLocaleString()} / ${limit.toLocaleString()}
            </p>

            <p
              className={`text-sm font-medium ${
                spent > limit ? "text-red-600" : "text-gray-700"
              }`}
            >
              {pct}%
            </p>

            <div className="md:ml-auto flex items-center gap-2">
              <label className="text-sm text-gray-600">Budget:</label>
              <input
                type="number"
                value={limit}
                onChange={(e) =>
                  setBudgets((b) => ({
                    ...b,
                    [cat]: Number(e.target.value) || 0,
                  }))
                }
                className="w-28 px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="w-full h-3 border rounded-full overflow-hidden">
            <div
              className={`h-full ${
                spent > limit ? "bg-red-500" : "bg-green-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
</div>

      {/* Net Cash Flow Over Time */}
<div className="p-6 border rounded-xl">
  <h2 className="text-lg font-semibold mb-4">
    Balance Over Time
  </h2>

  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={netSeries}>
  <XAxis
  dataKey="date"
  tickFormatter={(d) => d.slice(5)} // shows MM-DD
/>
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="running" strokeWidth={3} />
</LineChart>

  </ResponsiveContainer>
</div>

{/* Spending by Category */}
<div className="p-6 border rounded-xl">
  <h2 className="text-lg font-semibold mb-4">
    Spending by Category
  </h2>

  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={categoryChartData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="category" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="total" />
    </BarChart>
  </ResponsiveContainer>
</div>

{/* Cash Flow */}
<div className="p-6 border rounded-xl">
  <div className="flex items-end justify-between gap-4 mb-4">
    <h2 className="text-lg font-semibold">Cash Flow</h2>
    <p className="text-sm text-gray-500">
      Range: <span className="font-medium">{range}</span>
    </p>
  </div>
  <p className="text-sm text-gray-500 mb-3">
  Range {range} • Expenses shown: ${sankey.totalExpenses.toLocaleString()}
</p>

  <SankeyChart data={sankey} />
</div>

{/* Transactions */}
<div className="p-6 border rounded-xl">
  <h2 className="text-lg font-semibold mb-4">
    Recent Transactions
  </h2>

<div className="flex flex-col md:flex-row md:items-center gap-3 mt-4">
  <div className="flex items-center gap-2">
    <button
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      disabled={page === 1}
      className="px-3 py-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50"
    >
      Prev
    </button>

    <p className="text-sm text-gray-600">
      Page <span className="font-medium">{page}</span> of{" "}
      <span className="font-medium">{totalPages}</span>
    </p>

    <button
      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
      disabled={page >= totalPages}
      className="px-3 py-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50"
    >
      Next
    </button>
  </div>

  <div className="flex items-center gap-2 md:ml-auto">
    <p className="text-sm text-gray-600">Rows:</p>
    <select
      value={pageSize}
      onChange={(e) => setPageSize(Number(e.target.value))}
      className="px-3 py-2 border rounded-lg"
    >
      <option value={25}>25</option>
      <option value={50}>50</option>
      <option value={100}>100</option>
    </select>
  </div>
</div>

<div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
  {/* Search */}
  <input
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="Search transactions…"
    className="px-3 py-2 border rounded-lg w-full md:w-80"
  />

  {/* Category */}
  <select
    value={categoryFilter}
    onChange={(e) => setCategoryFilter(e.target.value)}
    className="px-3 py-2 border rounded-lg w-full md:w-56"
  >
    {categoryOptions.map((c) => (
      <option key={c} value={c}>
        {c}
      </option>
    ))}
  </select>

  {/* Type */}
  <select
    value={typeFilter}
    onChange={(e) => setTypeFilter(e.target.value as any)}
    className="px-3 py-2 border rounded-lg w-full md:w-44"
  >
    <option value="All">All</option>
    <option value="Income">Income</option>
    <option value="Expenses">Expenses</option>
  </select>

  {/* Account */}
  <select
    value={accountFilter}
    onChange={(e) => setAccountFilter(e.target.value)}
    className="px-3 py-2 border rounded-lg w-full md:w-64"
  >
    <option value="All">All Accounts</option>
    {plaidAccounts.map((a) => (
      <option key={a.account_id} value={a.account_id}>
        {accountNameById[a.account_id] ?? a.name}
      </option>
    ))}
  </select>

  {/* Clear */}
  <button
    onClick={() => {
      setSearch("");
      setCategoryFilter("All");
      setTypeFilter("All");
      setAccountFilter("All");
    }}
    className="px-4 py-2 rounded-lg border hover:bg-gray-100"
  >
    Clear
  </button>

  {/* EXPORT CSV — 👈 STEP 2.2 GOES HERE */}
  <button
    onClick={() => {
      const rows = filteredTxns.map((t) => ({
        date: t.date,
        description: t.description,
        category: t.category,
        amount: t.amount,
        account: t.accountName,
      }));
      downloadCsv(`transactions_${range}.csv`, rows);
    }}
    className="px-4 py-2 rounded-lg border hover:bg-gray-100"
  >
    Export CSV
  </button>

  {/* Count */}
  <p className="text-sm text-gray-500 md:ml-auto">
    Showing {filteredTxns.length} of {dashboardTxns.length}
  </p>
</div>

  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b text-gray-500">
          <th className="py-2">Date</th>
          <th>Description</th>
          <th>Account</th>
          <th>Category</th>
          <th className="text-right">Amount</th>
        </tr>
      </thead>

      <tbody>
        {pagedTxns.map((tx, i) => (
          <tr key={i} className="border-b last:border-none">
            <td className="py-2">{tx.date}</td>
            <td>{tx.description}</td>
            <td>{tx.accountName}</td>
            <td>{tx.category}</td>
            <td
              className={`text-right font-medium ${
                tx.amount > 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {tx.amount > 0 ? "+" : "-"}$
              {Math.abs(tx.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

{/* Plaid Transactions (Sandbox) */}
<div className="p-6 border rounded-xl">
  <h2 className="text-lg font-semibold mb-4">
    Plaid Transactions (Sandbox)
  </h2>

  {plaidError && <p className="text-red-600">{plaidError}</p>}

  {plaidTxns.length === 0 ? (
    <p className="text-gray-500">
      No Plaid transactions yet. Click “Connect Bank” first.
    </p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2">Date</th>
            <th>Description</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {plaidTxns.slice(0, 15).map((tx: any) => (
            <tr key={tx.transaction_id} className="border-b last:border-none">
              <td className="py-2">{tx.date}</td>
              <td>{tx.name}</td>
              <td className="text-right font-medium">
                ${tx.amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>

    </main>
  );
}
