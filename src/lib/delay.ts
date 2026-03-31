/** Espera `ms` milisegundos (útil para espaciar llamadas a APIs con cuota). */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
