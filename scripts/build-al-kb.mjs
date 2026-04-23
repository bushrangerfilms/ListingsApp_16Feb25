#!/usr/bin/env node
// Bundles Listings/docs/user/*.md into a single knowledge-base.json for the Al chatbot.
// Usage:
//   node scripts/build-al-kb.mjs          # writes dist/al-kb/knowledge-base.json
//   node scripts/build-al-kb.mjs --upload # also uploads to Supabase Storage bucket "al-kb"

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, "..", "docs", "user");
const OUT_DIR = path.resolve(__dirname, "..", "dist", "al-kb");
const OUT_FILE = path.join(OUT_DIR, "knowledge-base.json");

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  const fm = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, valueRaw] = m;
    const value = valueRaw.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      fm[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    } else {
      fm[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
  return { frontmatter: fm, body: match[2].trim() };
}

// Rough token estimate: ~4 chars per token. Good enough for budget tracking.
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

async function main() {
  const files = (await fs.readdir(DOCS_DIR))
    .filter((f) => f.endsWith(".md"))
    .sort();

  const sections = [];
  let totalTokens = 0;

  for (const file of files) {
    const raw = await fs.readFile(path.join(DOCS_DIR, file), "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);
    if (!frontmatter.id || !frontmatter.title) {
      console.warn(`[skip] ${file}: missing id or title`);
      continue;
    }
    const tokens = estimateTokens(body);
    totalTokens += tokens;
    sections.push({
      id: frontmatter.id,
      title: frontmatter.title,
      apps: frontmatter.apps || ["listings", "socials"],
      route_hints: frontmatter.route_hints || [],
      plan_gates: frontmatter.plan_gates || [],
      content: body,
      estimated_tokens: tokens,
    });
  }

  const bundle = {
    version: new Date().toISOString().slice(0, 10),
    built_at: new Date().toISOString(),
    section_count: sections.length,
    estimated_tokens_total: totalTokens,
    sections,
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(bundle, null, 2));

  console.log(`[al-kb] built ${sections.length} sections, ~${totalTokens.toLocaleString()} tokens`);
  console.log(`[al-kb] output: ${OUT_FILE}`);
  if (totalTokens > 50_000) {
    console.warn(`[al-kb] WARNING: bundle is over 50K tokens — caching becomes more expensive. Consider sharding or trimming.`);
  }

  if (process.argv.includes("--upload")) {
    await uploadToSupabase(bundle);
  }
}

async function uploadToSupabase(bundle) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[al-kb] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for --upload");
    process.exit(1);
  }
  const filename = "knowledge-base.json";
  const endpoint = `${url}/storage/v1/object/al-kb/${filename}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "x-upsert": "true",
    },
    body: JSON.stringify(bundle),
  });
  if (!res.ok) {
    console.error(`[al-kb] upload failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`[al-kb] uploaded to al-kb/${filename}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
