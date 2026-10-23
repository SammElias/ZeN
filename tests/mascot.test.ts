import {describe,it,expect,afterEach} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {availableFace,observedActivity,resolveWardrobe,validateAppearance,validateTone,PlaybackLease,tones} from '../src/shared/mascot';
import {ConversationStore} from '../src/storage/conversations';
import {SettingsSchema} from '../src/shared/contracts';
const resources:{dir:string;store:ConversationStore}[]=[];afterEach(()=>{for(const r of resources.splice(0)){r.store.close();rmSync(r.dir,{recursive:true,force:true});}});
describe('local mascot contracts',()=>{
 it('validates enum, source, version, finite intensity and message ownership',()=>{
  for(const value of tones)expect(validateTone({schemaVersion:1,value,intensity:2,source:'validated_metadata'})).toMatchObject({value,intensity:1});
  for(const invalid of [null,{schemaVersion:2,value:'smug'},{schemaVersion:1,value:'furious',source:'local_rule'},{schemaVersion:1,value:'smug',source:'web'}])expect(validateTone(invalid).value).toBe('neutral');
  expect(validateTone({schemaVersion:1,value:'smug',source:'local_rule',intensity:NaN}).intensity).toBe(.35);
  expect(validateAppearance({chatId:'other',messageId:'message',tone:{schemaVersion:1,value:'smug',source:'local_rule'}},'chat','message').tone.value).toBe('neutral');
 });
 it('uses observed activity and ignores other chats and transcription states',()=>{
  const base={microphone:false,speaking:false,chatId:'a'};
  expect(observedActivity({...base,task:{state:'executing',chatId:'b'}})).toBe('idle');
  expect(observedActivity({...base,task:{state:'listening',chatId:'a'}})).toBe('idle');
  expect(observedActivity({...base,microphone:true})).toBe('listening');
  expect(observedActivity({...base,speaking:true,task:{state:'executing',chatId:'a'}})).toBe('speaking');
  expect(observedActivity({...base,task:{state:'executing',chatId:'a'}})).toBe('executing');
  expect(observedActivity({...base,task:{state:'executing',chatId:'a',paused:true}})).toBe('idle');
 });
 it('keeps fixed clothes even when the face combination is missing',()=>{
  expect(resolveWardrobe('smug','auto')).toBe('light');expect(resolveWardrobe('smug','cozy')).toBe('cozy');expect(availableFace('smug','cozy')).toBe('sad_empathic');
 });
 it('rejects ended, superseded, wrong-chat playback and keeps work independent',()=>{
  const gate=new PlaybackLease(),first=gate.start('a');expect(gate.accepts(first,'b')).toBe(false);gate.invalidate();expect(gate.accepts(first,'a')).toBe(false);const second=gate.start('a');expect(gate.accepts(first,'a')).toBe(false);expect(gate.accepts(second,'a')).toBe(true);
 });
 it('persists frozen neutral metadata without sending it in provider items or changing draft',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zen-mascot-')),store=new ConversationStore(dir);resources.push({dir,store});const chat=store.create(null),run=randomUUID();store.saveDraft(chat.id,{text:'keep',attachmentIds:[],scrollTop:40});store.begin(chat.id,run,'¡Qué bien!');const message=store.messages(chat.id).at(-1)!;
  expect(message.appearance?.tone.value).toBe('neutral');expect(message.appearance?.messageId).toBe(message.id);
  store.saveAppearance({...message.appearance!,tone:{schemaVersion:1,value:'smug',source:'local_rule',intensity:.8}});expect(store.messages(chat.id).at(-1)?.appearance?.tone.value).toBe('neutral');
  expect(()=>store.saveAppearance({...message.appearance!,chatId:randomUUID()})).toThrow();
  store.accept({id:run,requestId:run,state:'completed',message:'Resultado'});store.close();const reopened=new ConversationStore(dir);resources[0].store=reopened;expect(reopened.messages(chat.id).at(-1)?.appearance?.tone.value).toBe('neutral');expect(reopened.draft(chat.id).text).toBe('keep');
  reopened.db.prepare('UPDATE message_appearance SET data=?').run('{broken');expect(reopened.messages(chat.id).at(-1)?.appearance?.tone.value).toBe('neutral');
 });
 it('loads old settings with safe defaults and validates fixed wardrobes',()=>{expect(SettingsSchema.parse({})).toMatchObject({mascotWardrobe:'auto',mascotWalks:true});expect(SettingsSchema.safeParse({mascotWardrobe:'neon'}).success).toBe(false);});
});
