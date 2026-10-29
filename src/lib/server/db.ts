import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "$env/dynamic/private";
const path = resolve(env.DATABASE_PATH || "data/juntachain.sqlite");
mkdirSync(dirname(path), { recursive: true });
export const db = new DatabaseSync(path);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS challenges (nonce TEXT PRIMARY KEY, address TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, address TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (address TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments (hash TEXT PRIMARY KEY, group_id TEXT NOT NULL, address TEXT NOT NULL, round INTEGER NOT NULL, created TEXT NOT NULL);
`);
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
export function getGroup(id: string): Group | undefined {
  const row = db.prepare("SELECT data FROM groups WHERE id=?").get(id) as
    { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function saveGroup(group: Group) {
  db.prepare("INSERT OR REPLACE INTO groups(id,data) VALUES (?,?)").run(
    group.id,
    JSON.stringify(group),
  );
}
export function listGroups(address: string): Group[] {
  return (db.prepare("SELECT data FROM groups").all() as { data: string }[])
    .map((row) => JSON.parse(row.data) as Group)
    .filter((g) => g.members.includes(address));
}
