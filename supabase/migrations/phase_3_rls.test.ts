import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(new URL("./20260802_phase_3_user_experience.sql", import.meta.url));
const migration = readFileSync(migrationPath, "utf8");

describe("Phase 3 RLS migration contract", () => {
  it.each(["practice_history", "favorite_topics"])("enables and forces RLS on %s", (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security;`);
    expect(migration).toContain(`alter table public.${table} force row level security;`);
    expect(migration).toContain(`revoke all on table public.${table} from anon;`);
  });

  it.each([
    ["practice_history", "select"],
    ["practice_history", "insert"],
    ["practice_history", "update"],
    ["practice_history", "delete"],
    ["favorite_topics", "select"],
    ["favorite_topics", "insert"],
    ["favorite_topics", "update"],
    ["favorite_topics", "delete"]
  ])("scopes %s %s policy to auth.uid() = user_id", (table, operation) => {
    const policyStart = migration.indexOf(`create policy \"${table}_${operation}_own\"`);
    expect(policyStart).toBeGreaterThan(-1);
    const policyText = migration.slice(policyStart, migration.indexOf(";", policyStart) + 1);
    expect(policyText).toContain("to authenticated");
    expect(policyText).toContain("auth.uid()) = user_id");
  });
});
