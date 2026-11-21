import {readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {z} from 'zod';
import {azureTranslatorKey, oppositeLanguage, type TranslatorAction, type TranslatorReply} from '../shared/companion-translator';

type Protection = Pick<Electron.SafeStorage, 'isEncryptionAvailable' | 'encryptString' | 'decryptString'>;
type Translation = Extract<TranslatorAction, {type:'translate'}>;
const responseSchema = z.array(z.object({translations:z.array(z.object({text:z.string().min(1), to:z.string()})).length(1)})).length(1);

function rejection(status: number) {
  if (status===401) return 'Azure no acepta la clave. Revisa que sea la del recurso Translator Global.';
  if (status===403) return 'Azure rechazó la traducción. Revisa el recurso y la cuota mensual.';
  if (status===429) return 'Azure alcanzó el límite de solicitudes. Espera un momento y vuelve a intentarlo.';
  return 'Azure no pudo traducir el texto. Vuelve a intentarlo.';
}

export class CompanionTranslator {
  private key?: string;
  private pending?: AbortController;

  constructor(private readonly path:string, private readonly protection:Protection,
    private readonly allowed:()=>boolean, private readonly request:typeof fetch = fetch) {
    try { this.key = azureTranslatorKey.parse(protection.decryptString(readFileSync(path))); }
    catch { /* A missing or unreadable key can be configured again. */ }
  }

  cancel() {
    this.pending?.abort();
    this.pending = undefined;
  }

  private configure(key: string) {
    if (!this.protection.isEncryptionAvailable()) throw Error('El almacenamiento seguro de Windows no está disponible.');
    const temporary = `${this.path}.tmp`;
    try {
      writeFileSync(temporary,this.protection.encryptString(key),{mode:0o600});
      renameSync(temporary,this.path);
    } catch {
      throw Error('No se pudo guardar la clave de Azure.');
    } finally {
      try { rmSync(temporary,{force:true}); } catch { /* The temporary key is encrypted. */ }
    }
    this.key = key;
  }

  private async translate({text,from}: Translation): Promise<TranslatorReply> {
    if (!this.key) throw Error('Configura la clave de Azure para traducir.');
    const controller = new AbortController();
    const timeout = AbortSignal.timeout(15000);
    const signal = AbortSignal.any([controller.signal, timeout]);
    const to = oppositeLanguage(from);
    const url = new URL('https://api.cognitive.microsofttranslator.com/translate');
    url.search = new URLSearchParams({'api-version':'3.0', from, to}).toString();
    this.pending = controller;
    try {
      let response: Response;
      try {
        response = await this.request(url,{
          method:'POST', redirect:'error', signal,
          headers:{'Content-Type':'application/json', 'Ocp-Apim-Subscription-Key':this.key},
          body:JSON.stringify([{Text:text}]),
        });
      } catch {
        if (controller.signal.aborted || !this.allowed()) throw Error('La vista de Traductor se cerró.');
        throw Error(timeout.aborted?'Azure tardó demasiado en responder.':'No se pudo conectar con Azure Translator.');
      }
      if (!response.ok) {
        void response.body?.cancel().catch(()=>undefined);
        throw Error(rejection(response.status));
      }
      const result = responseSchema.safeParse(await response.json().catch(()=>undefined));
      if (controller.signal.aborted || !this.allowed()) throw Error('La vista de Traductor se cerró.');
      if (!result.success || result.data[0].translations[0].to!==to) throw Error('Azure devolvió una traducción incompleta.');
      return {type:'translation', text:result.data[0].translations[0].text};
    } finally {
      if (this.pending===controller) this.pending = undefined;
    }
  }

  async handle(action:TranslatorAction): Promise<TranslatorReply> {
    if (action.type==='leave') {
      this.cancel();
      return {type:'status', configured:false};
    }
    if (!this.allowed()) throw Error('Abre Traductor en HUB y desactiva Pausa o Presentación.');
    if (action.type==='status') return {type:'status', configured:!!this.key};
    if (this.pending) throw Error('Espera a que termine la traducción.');
    if (action.type==='translate') return this.translate(action);
    if (action.type==='configure') this.configure(action.key);
    else {
      try { rmSync(this.path,{force:true}); }
      catch { throw Error('No se pudo quitar la clave de Azure.'); }
      this.key = undefined;
    }
    return {type:'status', configured:!!this.key};
  }
}
