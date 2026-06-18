/**
 * Crea usuarios CTP provisionales (Marc / Gemma).
 * Uso: node scripts/create-ctp-users.mjs
 *
 * Genera contraseñas aleatorias si no se pasan por env:
 *   CTP_USER_PASSWORD, CTP2_USER_PASSWORD
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function randomPassword() {
  return randomBytes(12).toString("base64url");
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const USERS = [
  {
    email: "ctp@minervaglobal.es",
    password: process.env.CTP_USER_PASSWORD?.trim() || randomPassword(),
    role: "ctp",
    displayName: "Gemma (CTP)",
  },
  {
    email: "ctp2@minervaglobal.es",
    password: process.env.CTP2_USER_PASSWORD?.trim() || randomPassword(),
    role: "ctp",
    displayName: "Marc (CTP)",
  },
];

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 });
  if (error) throw error;
  return (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureUser({ email, password, role, displayName }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error: profErr } = await supabase
      .from("profiles")
      .upsert({ id: existing.id, role }, { onConflict: "id" });
    if (profErr) throw profErr;
    console.log(`✓ Ya existía ${email} — rol ${role} actualizado (${displayName})`);
    return { email, skipped: true };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? `No se pudo crear ${email}`);
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .upsert({ id: data.user.id, role }, { onConflict: "id" });
  if (profErr) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw profErr;
  }

  console.log(`✓ Creado ${email} (${displayName}) — rol ${role}`);
  console.log(`  Contraseña: ${password}`);
  return { email, password, skipped: false };
}

async function main() {
  console.log("Creando usuarios CTP provisionales…\n");
  for (const spec of USERS) {
    await ensureUser(spec);
  }
  console.log("\nListo. Sustituir emails cuando Marc/Gemma tengan cuenta definitiva.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
