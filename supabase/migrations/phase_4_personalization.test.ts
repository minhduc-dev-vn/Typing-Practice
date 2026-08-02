import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260803_phase_4_personalization.sql"),
  "utf8"
);

describe("Phase 4 personalization migration", () => {
  it("defines the shared source-topic cache contract", () => {
    expect(migration).toMatch(/create table if not exists public\.topic_suggestions/iu);
    expect(migration).toMatch(/source_topic text not null unique/iu);
    expect(migration).toMatch(/related_topic text not null/iu);
    expect(migration).toMatch(/created_at timestamptz not null default now\(\)/iu);
  });

  it("keeps the shared cache server-only", () => {
    expect(migration).toMatch(/enable row level security/iu);
    expect(migration).toMatch(/force row level security/iu);
    expect(migration).toMatch(/revoke all on table public\.topic_suggestions from anon, authenticated/iu);
  });
});

