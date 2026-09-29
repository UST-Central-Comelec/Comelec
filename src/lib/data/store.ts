import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { seedContent } from "./seed";
import type { ContentDb } from "./types";

// Content store used by both the public site and the portal, backed by Supabase tables
// (see supabase/migrations). Rows use snake_case columns; the app uses camelCase fields.
//
// Until Supabase is configured, reads fall back to the built-in starter content so the site still
// builds and renders, and writes fail with a clear message.

export type Collection = keyof ContentDb;
export type Item<C extends Collection> = ContentDb[C][number];
type NewItem<C extends Collection> = Omit<Item<C>, "id" | "createdAt" | "updatedAt" | "updatedBy">;

const tables: Record<Collection, string> = { news: "news", documents: "documents", members: "members", accounts: "portal_accounts" };

// Fields whose column name isn't plain snake_case (`order` is a reserved word in SQL).
const columnOverrides: Record<string, string> = { order: "display_order" };
const fieldOverrides = Object.fromEntries(Object.entries(columnOverrides).map(([field, column]) => [column, field]));

const toColumn = (field: string) => columnOverrides[field] ?? field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toField = (column: string) => fieldOverrides[column] ?? column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function toRow(item: object) {
  return Object.fromEntries(Object.entries(item).map(([key, value]) => [toColumn(key), value]));
}

function fromRow<T>(row: object) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toField(key), value])) as T;
}

function db() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase isn’t configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in .env.local.");
  }
  return createAdminClient();
}

function fail(action: string, collection: Collection, error: { message: string }): never {
  throw new Error(`Couldn’t ${action} ${collection}: ${error.message}`);
}

function slugify(text: string) {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export const store = {
  async list<C extends Collection>(collection: C): Promise<Item<C>[]> {
    if (!isSupabaseConfigured()) return structuredClone(seedContent[collection]) as Item<C>[];
    const { data, error } = await db().from(tables[collection]).select("*");
    if (error) fail("load", collection, error);
    return data.map((row) => fromRow<Item<C>>(row));
  },

  async get<C extends Collection>(collection: C, id: string): Promise<Item<C> | null> {
    if (!isSupabaseConfigured()) return (seedContent[collection] as Item<C>[]).find((item) => item.id === id) ?? null;
    const { data, error } = await db().from(tables[collection]).select("*").eq("id", id).maybeSingle();
    if (error) fail("load", collection, error);
    return data ? fromRow<Item<C>>(data) : null;
  },

  async create<C extends Collection>(collection: C, data: NewItem<C>, author: string, idHint: string): Promise<Item<C>> {
    const client = db();
    const base = slugify(idHint) || "item";
    const { data: taken, error: lookupError } = await client.from(tables[collection]).select("id").like("id", `${base}%`);
    if (lookupError) fail("save", collection, lookupError);
    const ids = new Set(taken.map((row) => row.id as string));
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;

    const now = new Date().toISOString();
    const { data: row, error } = await client.from(tables[collection]).insert(toRow({ ...data, id, createdAt: now, updatedAt: now, updatedBy: author })).select().single();
    if (error) fail("save", collection, error);
    return fromRow<Item<C>>(row);
  },

  async update<C extends Collection>(collection: C, id: string, data: Partial<NewItem<C>>, author: string): Promise<Item<C> | null> {
    const { data: row, error } = await db().from(tables[collection]).update(toRow({ ...data, updatedAt: new Date().toISOString(), updatedBy: author })).eq("id", id).select().maybeSingle();
    if (error) fail("save", collection, error);
    return row ? fromRow<Item<C>>(row) : null;
  },

  async remove<C extends Collection>(collection: C, id: string): Promise<Item<C> | null> {
    const { data: row, error } = await db().from(tables[collection]).delete().eq("id", id).select().maybeSingle();
    if (error) fail("delete", collection, error);
    return row ? fromRow<Item<C>>(row) : null;
  },
};
