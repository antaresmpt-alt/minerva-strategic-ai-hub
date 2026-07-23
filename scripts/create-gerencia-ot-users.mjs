/**
 * Alta Albert / Gemma / Zaida + flags cierre OT (club de 6).
 * Uso: node scripts/create-gerencia-ot-users.mjs
 *
 * Contraseñas aleatorias si no se pasan por env:
 *   ALBERT_USER_PASSWORD, GEMMA_USER_PASSWORD, ZAIDA_USER_PASSWORD
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

/** Usuarios a crear / alinear rol */
const USERS = [
  {
    email: "albert@minervaglobal.es",
    password: process.env.ALBERT_USER_PASSWORD?.trim() || randomPassword(),
    role: "gerencia",
    displayName: "Albert Paradell",
    puede_cerrar_ot: true,
    puede_reabrir_ot: true,
  },
  {
    email: "gemma@minervaglobal.es",
    password: process.env.GEMMA_USER_PASSWORD?.trim() || randomPassword(),
    role: "gerencia",
    displayName: "Gemma Gaya",
    puede_cerrar_ot: true,
    puede_reabrir_ot: true,
  },
  {
    email: "zaida@minervaglobal.es",
    password: process.env.ZAIDA_USER_PASSWORD?.trim() || randomPassword(),
    role: "oficina_tecnica",
    displayName: "Zaida Planells",
    puede_cerrar_ot: true,
    puede_reabrir_ot: true,
  },
];

/** Club de 6: asegurar flags (gerencia/admin ya pueden por rol; flags documentan el club). */
const CLUB_EMAILS = [
  "manel.puigcerver@minervaglobal.es",
  "jordi@minervaglobal.es",
  "albert@minervaglobal.es",
  "gemma@minervaglobal.es",
  "zaida@minervaglobal.es",
  "produccion@minervaglobal.es",
];

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 });
  if (error) throw error;
  return (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureUser(spec) {
  const { email, password, role, displayName, puede_cerrar_ot, puede_reabrir_ot } = spec;
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error: profErr } = await supabase.from("profiles").upsert(
      {
        id: existing.id,
        role,
        puede_cerrar_ot,
        puede_reabrir_ot,
      },
      { onConflict: "id" },
    );
    if (profErr) throw profErr;
    console.log(`✓ Ya existía ${email} — rol ${role} + flags actualizados (${displayName})`);
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

  const { error: profErr } = await supabase.from("profiles").upsert(
    {
      id: data.user.id,
      role,
      puede_cerrar_ot,
      puede_reabrir_ot,
    },
    { onConflict: "id" },
  );
  if (profErr) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw profErr;
  }

  console.log(`✓ Creado ${email} (${displayName}) — rol ${role}`);
  console.log(`  Contraseña temporal: ${password}`);
  return { email, password, skipped: false };
}

async function ensureClubFlags() {
  console.log("\nAlineando flags del club de 6…");
  for (const email of CLUB_EMAILS) {
    const u = await findUserByEmail(email);
    if (!u) {
      console.log(`⚠ No existe aún ${email} — omitido`);
      continue;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ puede_cerrar_ot: true, puede_reabrir_ot: true })
      .eq("id", u.id);
    if (error) throw error;
    console.log(`✓ Flags cierre/reabrir ON → ${email}`);
  }
}

async function main() {
  console.log("Alta gerencia / oficina técnica…\n");
  for (const spec of USERS) {
    await ensureUser(spec);
  }
  await ensureClubFlags();
  console.log("\nListo. Entregar contraseñas temporales por canal seguro; pedir cambio en primer login.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
