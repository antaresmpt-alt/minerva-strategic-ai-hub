/**
 * Política mínima de contraseñas (alta usuario / reset admin).
 * Ajusta constantes según política interna de la empresa.
 */
export const PASSWORD_MIN_LENGTH = 14;

const UPPER = /[A-ZÁÉÍÓÚÑ]/;
const LOWER = /[a-záéíóúñ]/;
const DIGIT = /\d/;
/** Carácter especial o símbolo típico de teclado */
const SPECIAL = /[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]/;
const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "admin123",
  "qwerty123",
  "12345678",
  "123456789",
  "1234567890",
  "letmein",
  "welcome123",
  "minerva123",
]);

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validatePassword(password: string | undefined | null): PasswordValidationResult {
  const p = password ?? "";
  const normalized = p.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    return {
      ok: false,
      error: "La contraseña es demasiado común. Elige una más robusta.",
    };
  }
  if (p.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    };
  }
  if (!LOWER.test(p)) {
    return { ok: false, error: "La contraseña debe incluir al menos una letra minúscula." };
  }
  if (!UPPER.test(p)) {
    return { ok: false, error: "La contraseña debe incluir al menos una letra mayúscula." };
  }
  if (!DIGIT.test(p)) {
    return { ok: false, error: "La contraseña debe incluir al menos un dígito." };
  }
  if (!SPECIAL.test(p)) {
    return {
      ok: false,
      error: "La contraseña debe incluir al menos un símbolo (p. ej. !@#$%).",
    };
  }
  return { ok: true };
}

export function assertPasswordOrMessage(password: string | undefined | null): string | null {
  const r = validatePassword(password);
  return r.ok ? null : r.error;
}
