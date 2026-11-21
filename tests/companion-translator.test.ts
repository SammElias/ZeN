import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, expect, it, vi} from 'vitest';
import {CompanionTranslator} from '../src/main/companion-translator';
import {TranslatorAction,translatorTextLimit} from '../src/shared/companion-translator';

const roots:string[] = [];
const key = 'synthetic-azure-translator-key';
const stubProtection = {
  isEncryptionAvailable:()=>true,
  encryptString:(value:string)=>Buffer.from(value,'utf16le'),
  decryptString:(value:Buffer)=>value.toString('utf16le'),
};
afterEach(()=>{for (const root of roots.splice(0)) rmSync(root,{recursive:true,force:true});});

function fixture(request=vi.fn<typeof fetch>()) {
  const root=mkdtempSync(join(tmpdir(),'zen-translator-test-'));
  roots.push(root);
  const path=join(root,'translator.bin');
  let allowed=true;
  const reopen=()=>new CompanionTranslator(path,stubProtection,()=>allowed,request);
  return {path,request,reopen,translator:reopen(),allow:(value:boolean)=>{allowed=value;}};
}

it('persists only a protected key and sends the original text solely to the Global Translator endpoint',async()=>{
  const {path,request,reopen,translator}=fixture();
  expect(await translator.handle({type:'configure',key})).toEqual({type:'status',configured:true});
  expect(request).not.toHaveBeenCalled();
  expect(readFileSync(path).includes(Buffer.from(key))).toBe(false);
  const restored=reopen();
  expect(await restored.handle({type:'status'})).toEqual({type:'status',configured:true});
  request.mockResolvedValueOnce(Response.json([{translations:[{text:'Hello, team!',to:'en'}]}]));
  expect(await restored.handle({type:'translate',from:'es',text:'¡Hola, equipo!'})).toEqual({type:'translation',text:'Hello, team!'});
  const [url,options]=request.mock.calls[0];
  expect(String(url)).toBe('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=es&to=en');
  expect(options).toMatchObject({method:'POST',redirect:'error',headers:{'Ocp-Apim-Subscription-Key':key},body:JSON.stringify([{Text:'¡Hola, equipo!'}])});
  await restored.handle({type:'disconnect'});
  expect(await reopen().handle({type:'status'})).toEqual({type:'status',configured:false});
});

it('cancels in-flight requests and rejects stale results after leaving the view',async()=>{
  const {translator,allow,request}=fixture();
  await translator.handle({type:'configure',key});
  let resolve!: (response:Response)=>void;
  request.mockReturnValueOnce(new Promise<Response>(done=>{resolve=done;}));
  const pending=translator.handle({type:'translate',from:'en',text:'Test'});
  const rejected=expect(pending).rejects.toThrow('La vista de Traductor se cerró');
  await expect(translator.handle({type:'translate',from:'en',text:'Duplicate'})).rejects.toThrow('Espera');
  await translator.handle({type:'leave'});
  expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
  resolve(Response.json([{translations:[{text:'Prueba',to:'es'}]}]));
  await rejected;
  allow(false);
  await expect(translator.handle({type:'translate',from:'en',text:'Test'})).rejects.toThrow('Abre Traductor');
  expect(request).toHaveBeenCalledTimes(1);
});

it('reports Azure errors without forwarding response bodies or failing on malformed success responses',async()=>{
  const {translator,request}=fixture();
  await translator.handle({type:'configure',key});
  const action={type:'translate',from:'en',text:'Example'} as const;
  request.mockResolvedValueOnce(new Response('details from provider',{status:401}));
  await expect(translator.handle(action)).rejects.toThrow('Azure no acepta la clave');
  request.mockResolvedValueOnce(new Response(null,{status:429}));
  await expect(translator.handle(action)).rejects.toThrow('límite de solicitudes');
  request.mockResolvedValueOnce(Response.json([{translations:[{text:'Example',to:'en'}]}]));
  await expect(translator.handle(action)).rejects.toThrow('traducción incompleta');
  expect(TranslatorAction.safeParse({...action,text:' '.repeat(8)}).success).toBe(false);
  expect(TranslatorAction.safeParse({...action,text:'x'.repeat(translatorTextLimit+1)}).success).toBe(false);
  expect(TranslatorAction.safeParse({type:'configure',key:key+'\r\nInjected: value'}).success).toBe(false);
});
