import type {OfficinaGoal, OfficinaProject} from './companion-officina';

export type OfficinaBrowser = {mode: 'integrated'} | {mode: 'extension'; browser?: string};

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const browsers = ['Chrome', 'Edge', 'Brave', 'Opera', 'Vivaldi'] as const;

export function officinaBrowserFor(text: string): OfficinaBrowser | undefined {
  const input = normalize(text);
  const integrated = /(?:^|\s)@browser\b|\bnavegador (?:integrado|interno)\b/.test(input);
  if (integrated && !/\b(?:no (?:uses?|utilices?)|sin) (?:el )?(?:navegador (?:integrado|interno)|@browser)\b/.test(input)) {
    return {mode: 'integrated'};
  }
  const named = browsers.filter(browser => new RegExp(`\\b${browser.toLowerCase()}\\b`).test(input));
  const habitual = /(?:^|\s)@(?:chrome|edge|brave|opera|vivaldi)\b|\bmi navegador\b|\bnavegador (?:habitual|externo)\b|\bpestanas? (?:abiertas?|que tengo)\b/.test(input);
  const extension = /\bextension\b/.test(input) &&
    (named.length > 0 || /\bchat\s*gpt\b|\bnavegador\b/.test(input)) ||
    /\b(?:her{1,2}amienta|complemento)\b[^.!?\n]{0,80}\bchat\s*gpt\b[^.!?\n]{0,70}\bnavegador\b/.test(input);
  if ((habitual || extension) && !/\b(?:sin extension|no (?:uses?|utilices?) la extension)\b/.test(input)) {
    return {mode: 'extension', browser: named.length === 1 ? named[0] : undefined};
  }
  return undefined;
}

export function officinaActiveTabRequested(text: string) {
  return /\b(?:que (?:estoy|estamos) viendo|lo que (?:estoy|estamos) viendo|pestana (?:activa|actual|que tengo abierta)|pagina (?:activa|actual|que tengo abierta))\b/.test(normalize(text));
}

export function officinaGoalBrowser(project: OfficinaProject, goal: OfficinaGoal): OfficinaBrowser | undefined {
  const messages = [...goal.history].reverse().filter(item => item.from === 'human').map(item => item.text);
  const choose = (inputs: string[]) => {
    const choices = inputs.map(officinaBrowserFor).filter(Boolean);
    const first = choices[0];
    return first?.mode === 'extension' && !first.browser
      ? choices.find(choice => choice?.mode === 'extension' && choice.browser) ?? first : first;
  };
  const explicit = choose([...messages, goal.request, goal.pastedText ?? '']);
  if (explicit?.mode === 'integrated' || explicit?.mode === 'extension' && explicit.browser ||
      !messages.some(officinaActiveTabRequested)) return explicit;
  const previous = project.goals?.slice(0, project.goals.indexOf(goal)).reverse();
  const inherited = previous?.map(item => choose([...item.history].reverse().filter(message => message.from === 'human')
    .map(message => message.text).concat(item.request, item.pastedText ?? ''))).find(Boolean);
  return explicit?.mode === 'extension' && inherited?.mode !== 'extension' ? explicit : inherited ?? explicit;
}

export function officinaGoalRequest(goal: OfficinaGoal) {
  return [goal.request, goal.pastedText, ...goal.history.filter(item => item.from === 'human').map(item => item.text)]
    .filter(Boolean).join('\n');
}

export function isOfficinaTabReview(text: string, browser = officinaBrowserFor(text)) {
  const input = normalize(text);
  return browser?.mode === 'extension' && (officinaActiveTabRequested(text) ||
    /\b(?:navegador|pestanas?|chrome|edge|brave|opera|vivaldi)\b/.test(input) &&
    /\b(?:revis\w*|inspeccion\w*|analiz\w*|inventari\w*|enumera\w*|lista\w*|resum\w*|muestr\w*)\b|\bque contenido (?:hay|tengo)\b/.test(input)) &&
    !/\b(?:envi\w*|borr\w*|elimin\w*|publica\w*|instala\w*|modific\w*|descarg\w*|comprar|compra|pagar|paga|cerrar|cierra|abrir|abre|rellena\w*|historial|contrasena\w*|cookies?|token\w*)\b/.test(input);
}

export function officinaBrowserInstruction(browser?: OfficinaBrowser) {
  if (browser?.mode === 'extension') {
    const host = browser.browser ? ` @${browser.browser}` : ' el navegador habitual conectado con la extensión';
    return `Para este encargo usa${host} mediante la extensión de ChatGPT. Empieza comprobando la conexión y las pestañas abiertas que puedes consultar. Atiende las solicitudes de aprobación mediante los permisos de Codex. Si no puedes verificar el contenido, indica la limitación en la conclusión. Conserva el navegador solicitado y revisa las pestañas accesibles.`;
  }
  return 'Si el encargo necesita navegar, usa el navegador integrado de Codex (@Browser).';
}
