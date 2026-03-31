/**
 * Modelo de embeddings para `embedContent` (SDK `@google/generative-ai` y REST).
 * Recurso REST: `models/gemini-embedding-001`.
 *
 * Notas:
 * - `text-embedding-004` y el id corto `embedding-001` suelen devolver 404 en v1beta
 *   según cuenta/región; el modelo soportado en la API de Google AI es
 *   **gemini-embedding-001**.
 */
export const RAG_EMBEDDING_MODEL = "gemini-embedding-001";

/** Prefijo `models/` para el campo `model` en JSON de la API REST. */
export const RAG_EMBEDDING_MODEL_RESOURCE = `models/${RAG_EMBEDDING_MODEL}`;

/** Debe coincidir con la columna vector en Supabase (pgvector) y `outputDimensionality`. */
export const RAG_EMBEDDING_DIMENSIONS = 3072;
