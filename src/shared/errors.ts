const classes = new Set(['Error', 'ZenError', 'ProviderResponseError', 'TypeError', 'SyntaxError', 'RangeError', 'ZodError', 'DOMException', 'AbortError', 'TimeoutError', 'OpenAIError', 'APIError', 'APIUserAbortError', 'APIConnectionError', 'APIConnectionTimeoutError', 'BadRequestError', 'AuthenticationError', 'PermissionDeniedError', 'NotFoundError', 'ConflictError', 'UnprocessableEntityError', 'RateLimitError', 'InternalServerError']);
const codes = new Set(['invalid_api_key', 'insufficient_quota', 'rate_limit_exceeded', 'model_not_found', 'permission_denied', 'invalid_request_error', 'invalid_value', 'invalid_parameter', 'unsupported_parameter', 'unsupported_value', 'context_length_exceeded', 'invalid_image', 'invalid_image_format', 'invalid_base64_image', 'image_too_large', 'image_too_small', 'image_parse_error', 'image_content_policy_violation', 'invalid_image_url', 'server_error', 'internal_error', 'service_unavailable', 'overloaded', 'request_timeout', 'timeout', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET']);
const types = new Set(['invalid_request_error', 'authentication_error', 'permission_error', 'rate_limit_error', 'server_error', 'insufficient_quota']);
const transportCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET']);
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};

/** Only protocol metadata: never messages, bodies, headers, input, URLs or stacks. */
export function errorMetadata(error: unknown): {kind: string; status?: number; code?: string; type?: string; causeCode?: string; requestId?: string; unrecognizedCode?: boolean} {
  const e = record(error), nested = record(e.error);
  // SDK subclasses inherit name="Error"; constructor.name carries their actual type.
  const name = e.constructor?.name, kind = classes.has(name) ? name : classes.has(e.name) ? e.name : 'UnknownError';
  const code = typeof e.code === 'string' ? e.code : nested.code;
  const type = typeof e.type === 'string' ? e.type : nested.type;
  let causeCode: string | undefined, cause = record(e.cause);
  for (let depth = 0; depth < 3; depth++, cause = record(cause.cause)) if (transportCodes.has(cause.code)) { causeCode = cause.code; break; }
  return {
    kind,
    ...(Number.isInteger(e.status) && e.status >= 400 && e.status <= 599 ? { status: e.status as number } : {}),
    ...(codes.has(code) ? { code: code as string } : typeof code === 'string' ? { unrecognizedCode: true } : {}),
    ...(types.has(type) ? { type: type as string } : {}),
    ...(causeCode ? { causeCode } : {}),
    ...(typeof e.requestID === 'string' && /^req_[a-zA-Z0-9_-]{1,100}$/.test(e.requestID) ? { requestId: e.requestID as string } : {}),
  };
}

export function diagnose(error: unknown): string {
  if (error instanceof ZenError) return error.message;
  const e = record(error), m = errorMetadata(error), code = m.code;
  if (e.name === 'AbortError' || m.kind === 'APIUserAbortError') return 'Tarea detenida o tiempo agotado.';
  if (m.kind === 'APIConnectionTimeoutError' || e.name === 'TimeoutError' || m.status === 408 || ['request_timeout', 'timeout', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'].includes(code ?? m.causeCode ?? '')) return 'Se agotó el tiempo de espera de OpenAI. No se pudo confirmar la respuesta y no se ha reenviado la petición. Puedes revisar y reintentar.';
  if (m.kind === 'APIConnectionError' || transportCodes.has(code ?? m.causeCode ?? '')) return 'Se interrumpió la conexión con OpenAI. No se pudo confirmar la respuesta. Revisa la conexión y vuelve a intentarlo; no se ha reenviado la petición.';
  if (m.status === 401 || code === 'invalid_api_key' || m.type === 'authentication_error') return 'Clave OpenAI inválida o revocada. Revisa Configuración.';
  if (code === 'insufficient_quota' || m.type === 'insufficient_quota') return 'Sin saldo o cuota API. Revisa la facturación del proyecto OpenAI.';
  if (m.status === 429 || code === 'rate_limit_exceeded' || m.type === 'rate_limit_error') return 'Límite de solicitudes OpenAI alcanzado. Espera antes de intentarlo de nuevo.';
  if (m.status === 403 || m.status === 404 || code === 'model_not_found' || code === 'permission_denied' || m.type === 'permission_error') return 'Sin acceso al modelo configurado. Comprueba proyecto y permisos; no se ha cambiado de modelo.';
  if ((m.status && m.status >= 500) || ['server_error', 'internal_error', 'service_unavailable', 'overloaded'].includes(code ?? '') || m.type === 'server_error') return 'OpenAI no está disponible temporalmente. No se ha reintentado la operación.';
  if (code === 'context_length_exceeded') return 'El contexto supera el límite del modelo. Abre un chat nuevo y selecciona solo la información necesaria.';
  if (code?.includes('image')) return 'OpenAI no pudo aceptar la imagen adjunta. Actualiza o quita la captura antes de reintentar.';
  if (m.status === 400 || m.status === 422 || m.type === 'invalid_request_error' || ['invalid_request_error', 'invalid_value', 'invalid_parameter', 'unsupported_parameter', 'unsupported_value'].includes(code ?? '')) return 'OpenAI rechazó los parámetros de la petición. Se conserva la configuración; revisa el diagnóstico local antes de reintentar.';
  if (m.kind === 'APIError' || m.kind === 'OpenAIError' || m.kind === 'ProviderResponseError') return 'OpenAI no pudo completar la respuesta. Se guardó el diagnóstico local y no se ha reenviado la petición.';
  return 'Error inesperado. Consulta los metadatos del registro local.';
}
export class ZenError extends Error {}
export class ProviderResponseError extends Error {
  constructor(public code: string | null | undefined) { super('Provider response failed'); }
}
