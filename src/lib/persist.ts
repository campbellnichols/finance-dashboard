import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "plaid_store.json");

type Store = {
  access_token?: string;
  updated_at?: string;
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

export async function writeStore(update: Store) {
  await ensureDir();
  const current = await readStore();
  const next: Store = {
    ...current,
    ...update,
    updated_at: new Date().toISOString(),
  };
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf-8");
}

export async function getAccessTokenFromDisk() {
  const store = await readStore();
  return store.access_token ?? null;
}
