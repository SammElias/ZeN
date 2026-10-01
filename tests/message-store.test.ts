import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageStore } from '../src/renderer/message-store';
describe('Presentación del streaming', () => {
  afterEach(() => vi.useRealTimers());
  it('agrupa deltas sin perder texto literal ni actualizar metadatos por fragmento', () => {
    vi.useFakeTimers(); const store = new MessageStore(); const changed = vi.fn(), summary = vi.fn(); store.subscribe(changed); store.subscribeMetadata(summary);
    store.utterance({ id:'live',speaker:'zen',phase:'start',text:' Hola',timeline:{startMs:0,endMs:1} });
    const count = summary.mock.calls.length;
    for(let n=2;n<=101;n++)store.utterance({id:'live',speaker:'zen',phase:'delta',text:' Hola'+' ñ'.repeat(n-1),timeline:{startMs:0,endMs:n}});
    expect(changed).toHaveBeenCalledTimes(1); expect(summary).toHaveBeenCalledTimes(count);
    vi.advanceTimersByTime(50);expect(store.snapshot().message?.text).toBe(' Hola'+' ñ'.repeat(100));expect(changed).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(700);expect(JSON.parse(store.metadata())[2]).toBe(false);store.dispose();
  });
  it('un mensaje final o una interrupción reemplaza inmediatamente deltas pendientes',()=>{
    vi.useFakeTimers();const store=new MessageStore();store.task({id:'t',state:'thinking',message:'',streamText:'Primero'});store.task({id:'t',state:'thinking',message:'',streamText:'Segundo'});store.task({id:'t',state:'completed',message:'Final exacto'});expect(store.snapshot().message?.text).toBe('Final exacto');vi.advanceTimersByTime(100);expect(store.snapshot().message?.text).toBe('Final exacto');
    store.utterance({id:'user',speaker:'user',phase:'start',text:'Nueva petición'});store.task({id:'old',state:'completed',request:'Otra',message:'Antiguo'});expect(store.snapshot().message?.text).toBe('Nueva petición');store.dispose();
  });
  it('conserva conversación durante errores y reinicia solo el reloj al reconectar voz',()=>{
    const store=new MessageStore();store.utterance({id:'old',speaker:'zen',phase:'delta',text:'Respuesta útil',timeline:{startMs:80000,endMs:85000}});store.task({id:'voice',state:'failed',message:'Voz desconectada por inactividad.'});expect(store.snapshot().message?.text).toBe('Respuesta útil');store.startLive();expect(store.snapshot().message?.text).toBe('Respuesta útil');store.utterance({id:'new',speaker:'user',phase:'start',text:'Nuevo',timeline:{startMs:0,endMs:100}});expect(store.snapshot().message?.text).toBe('Nuevo');store.dispose();
  });
});
