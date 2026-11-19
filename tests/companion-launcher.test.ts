import {describe,it,expect} from 'vitest';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {CompanionLauncher} from '../src/main/companion-launcher';
describe('persistent integration navigation',()=>{
 it('restores order and the last integration in another instance without private data',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const path=join(root,'launcher.json'),s=new CompanionLauncher(path);s.reorder(['spotify','codex','home','notes','notices']);s.visit('spotify');const r=new CompanionLauncher(path).status();expect(r).toEqual({order:['spotify','codex','home','notes','notices','calendar'],last:'spotify'});expect(Object.keys(JSON.parse(readFileSync(path,'utf8'))).sort()).toEqual(['last','order']);}finally{rmSync(root,{recursive:true,force:true});}});
 it('migrates an existing custom four-icon order and returns a retired Gmail selection to Home',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const path=join(root,'launcher.json');writeFileSync(path,JSON.stringify({order:['gmail','codex','home','spotify'],last:'gmail'}));expect(new CompanionLauncher(path).status()).toEqual({order:['codex','home','spotify','notices','notes','calendar'],last:'home'});}finally{rmSync(root,{recursive:true,force:true});}});
 it('rejects missing, duplicate and external integration identifiers without replacing good preferences',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const s=new CompanionLauncher(join(root,'launcher.json'));s.visit('spotify');for(const order of [['home'],['home','home','spotify','notes','notices'],['home','spotify','codex','notes','https://evil.test']])expect(()=>s.reorder(order)).toThrow();expect(s.status().last).toBe('spotify');}finally{rmSync(root,{recursive:true,force:true});}});
 it('keeps settings out of resume and maps permission review to Codex',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const s=new CompanionLauncher(join(root,'launcher.json'));s.visit('spotify');s.visit('settings');expect(s.status().last).toBe('spotify');s.visit('permissions');expect(s.status().last).toBe('codex');}finally{rmSync(root,{recursive:true,force:true});}});
 it('marks the most recent visible section through auxiliary screens',()=>{
  const root=mkdtempSync(join(tmpdir(),'zen-nav-'));
  try {
   const path=join(root,'launcher.json');
   const launcher=new CompanionLauncher(path);
   launcher.visit('notes');
   expect(new CompanionLauncher(path).recentSection).toBe('notes');
   launcher.visit('settings');
   launcher.visit('notices');
   launcher.visit('options');
   expect(launcher.recentSection).toBe('settings');
   expect(launcher.status().last).toBe('notices');
   launcher.visit('permissions');
   expect(launcher.recentSection).toBe('codex');
  } finally {
   rmSync(root,{recursive:true,force:true});
  }
 });
 it('recovers safely from malformed preferences and reports failed writes without changing state',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const path=join(root,'launcher.json');writeFileSync(path,'{"last":"secret"}');expect(new CompanionLauncher(path).status().last).toBe('home');const s=new CompanionLauncher(join(root,'missing','state.json'));expect(()=>s.visit('spotify')).toThrow();expect(s.status().last).toBe('home');}finally{rmSync(root,{recursive:true,force:true});}});
});

it('keeps Calendar and retires Gmail without rewriting existing preferences',()=>{const root=mkdtempSync(join(tmpdir(),'zen-nav-'));try{const path=join(root,'launcher.json'),raw=JSON.stringify({order:['spotify','calendar','home','gmail','codex','notices'],last:'calendar'});writeFileSync(path,raw);expect(new CompanionLauncher(path).status()).toEqual({order:['spotify','calendar','home','codex','notices','notes'],last:'calendar'});expect(readFileSync(path,'utf8')).toBe(raw);}finally{rmSync(root,{recursive:true,force:true});}});
