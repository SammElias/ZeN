import {describe,it,expect} from 'vitest';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {displayStatus} from '../src/shared/companion-privacy';
import {CompanionSettingsSchema,type CompanionStatus} from '../src/shared/codex-companion';
import {CompanionLauncher} from '../src/main/companion-launcher';
describe('persistent integration navigation',()=>{
 it('restores order and the last integration in another instance without private data',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const path=join(root,'launcher.json'),s=new CompanionLauncher(path);s.reorder(['spotify','gmail','codex','home','notices']);s.visit('gmail');const r=new CompanionLauncher(path).status();expect(r).toEqual({order:['spotify','gmail','codex','home','notices'],last:'gmail'});expect(Object.keys(JSON.parse(readFileSync(path,'utf8'))).sort()).toEqual(['last','order']);}finally{rmSync(root,{recursive:true,force:true});}});
 it('migrates an existing custom four-icon order without losing its last integration',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const path=join(root,'launcher.json');writeFileSync(path,JSON.stringify({order:['gmail','codex','home','spotify'],last:'gmail'}));expect(new CompanionLauncher(path).status()).toEqual({order:['gmail','codex','home','spotify','notices'],last:'gmail'});}finally{rmSync(root,{recursive:true,force:true});}});
 it('rejects missing, duplicate and external integration identifiers without replacing good preferences',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const s=new CompanionLauncher(join(root,'launcher.json'));s.visit('spotify');for(const order of [['home'],['home','home','gmail','codex'],['home','spotify','gmail','https://evil.test']])expect(()=>s.reorder(order)).toThrow();expect(s.status().last).toBe('spotify');}finally{rmSync(root,{recursive:true,force:true});}});
 it('keeps settings out of resume and maps permission review to Codex',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const s=new CompanionLauncher(join(root,'launcher.json'));s.visit('gmail');s.visit('settings');expect(s.status().last).toBe('gmail');s.visit('permissions');expect(s.status().last).toBe('codex');}finally{rmSync(root,{recursive:true,force:true});}});
 it('recovers safely from malformed preferences and reports failed writes without changing state',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const path=join(root,'launcher.json');writeFileSync(path,'{"last":"secret"}');expect(new CompanionLauncher(path).status().last).toBe('home');const s=new CompanionLauncher(join(root,'missing','state.json'));expect(()=>s.visit('gmail')).toThrow();expect(s.status().last).toBe('home');}finally{rmSync(root,{recursive:true,force:true});}});
});

describe('mail indicator privacy',()=>{
 it('removes observed counts in presentation and pause without changing source data',()=>{for(const settings of [{presentation:true},{paused:true}]){const raw:CompanionStatus={settings:CompanionSettingsSchema.parse(settings),account:'unchecked',checking:false,integration:'missing',sessions:[],approvals:[],notices:[],workspace:{expanded:false,launcher:true,page:'gmail',gmail:{unread:7,checkedAt:1000}}};expect(displayStatus(raw,1).workspace?.gmail).toBeUndefined();expect(raw.workspace?.gmail?.unread).toBe(7);}});
});
