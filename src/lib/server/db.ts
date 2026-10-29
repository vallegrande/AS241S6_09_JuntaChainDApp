import {
  createClient,
  type Client,
  type Transaction,
  type InValue,
} from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "$env/dynamic/private";
export const remoteDatabase = !!env.TURSO_DATABASE_URL;
let client: Client | undefined, ready: Promise<void> | undefined;
const schema = [
  "CREATE TABLE IF NOT EXISTS challenges(nonce TEXT PRIMARY KEY,address TEXT NOT NULL,message TEXT NOT NULL,expires INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,address TEXT NOT NULL,expires INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS profiles(address TEXT PRIMARY KEY,name TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,data TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS payments(hash TEXT PRIMARY KEY,group_id TEXT NOT NULL,address TEXT NOT NULL,round INTEGER NOT NULL,created TEXT NOT NULL)",
];
export async function database() {
  if (!client) {
    if (remoteDatabase) {
      if (!env.TURSO_AUTH_TOKEN)
        throw new Error("Configura TURSO_AUTH_TOKEN en el servidor.");
      client = createClient({
        url: env.TURSO_DATABASE_URL!,
        authToken: env.TURSO_AUTH_TOKEN,
      });
    } else {
      if (env.RENDER === "true")
        console.warn(
          "Almacenamiento temporal: configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN para conservar las juntas en Render Free.",
        );
      const path = resolve(env.DATABASE_PATH || "data/juntachain.sqlite");
      mkdirSync(dirname(path), { recursive: true });
      client = createClient({ url: `file:${path.replaceAll("\\", "/")}` });
    }
  }
  ready ||= client
    .batch(schema, "write")
    .then(() => {})
    .catch((e) => {
      ready = undefined;
      throw e;
    });
  await ready;
  return client;
}
export type Executor = Client | Transaction;
export async function run(
  sql: string,
  args: InValue[] = [],
  connection?: Executor,
) {
  return (connection || (await database())).execute({ sql, args });
}
export async function one<T>(
  sql: string,
  args: InValue[] = [],
  connection?: Executor,
) {
  return (await run(sql, args, connection)).rows[0] as unknown as T | undefined;
}
export async function write<T>(
  callback: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const tx = await (await database()).transaction("write");
  try {
    const result = await callback(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
export type Group = {
  id: string;
  name: string;
  owner: string;
  chainId: number;
  amount: string;
  capacity: number;
  frequency: number;
  created: string;
  round: number;
  roundStarted: string;
  members: string[];
  payments: {
    hash: string;
    from: string;
    to: string;
    round: number;
    value: string;
    timestamp: string;
  }[];
};
export async function getGroup(
  id: string,
  connection?: Executor,
): Promise<Group | undefined> {
  const row = await one<{ data: string }>(
    "SELECT data FROM groups WHERE id=?",
    [id],
    connection,
  );
  return row ? JSON.parse(row.data) : undefined;
}
export async function saveGroup(group: Group, connection?: Executor) {
  await run(
    "INSERT OR REPLACE INTO groups(id,data) VALUES (?,?)",
    [group.id, JSON.stringify(group)],
    connection,
  );
}
export async function listGroups(address: string): Promise<Group[]> {
  const result = await run("SELECT data FROM groups");
  return result.rows
    .map((row) => JSON.parse(String(row.data)) as Group)
    .filter((g) => g.members.includes(address));
}
