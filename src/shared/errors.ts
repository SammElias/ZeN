export function diagnose(error: unknown): string {
  const e = error as { status?: number; code?: string; name?: string; message?: string };
  if (e.name === 'AbortError' || e.name === 'APIUserAbortError') return 'Tarea detenida o tiempo agotado.';
  if (e.status === 401) return 'Clave OpenAI inválida o revocada. Revisa Configuración.';
  if (e.status === 403 || e.status === 404) return 'Sin acceso al modelo configurado. Comprueba proyecto y permisos; no se ha cambiado de modelo.';
  if (e.status === 429) return e.code === 'insufficient_quota' ? 'Sin saldo o cuota API. Revisa la facturación del proyecto OpenAI.' : 'Límite de solicitudes OpenAI alcanzado. Espera antes de intentarlo de nuevo.';
  if (e.status && e.status >= 500) return 'OpenAI no está disponible temporalmente. No se ha reintentado la operación.';
  if (e.status === 400) return 'OpenAI rechazó los parámetros o el modelo configurado. Revisa docs/openai-capabilities.md.';
  if (e.name === 'APIConnectionError' || e.name === 'APIConnectionTimeoutError' || e.name === 'TimeoutError' || e.name === 'TypeError') return 'No se pudo conectar con OpenAI. Revisa conexión, proxy y firewall.';
  // Only expose deliberate local messages; never raw upstream bodies or credentials.
  return error instanceof ZenError ? error.message : 'Error inesperado. Consulta los metadatos del registro local.';
}
export class ZenError extends Error {}
