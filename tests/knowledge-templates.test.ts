import {existsSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {KnowledgeHub} from '../src/main/knowledge-hub';
import {copyTemplatePrompt,validateTemplateImage} from '../src/main/knowledge-templates';
import {templateSeeds} from '../src/main/knowledge-template-seeds';
import {emptyTemplate, templateVariableLabels,templateVariables, type TemplateRecord} from '../src/shared/knowledge-templates';
import {newFields} from '../src/shared/knowledge-hub';

const seedRecords=()=>templateSeeds.map(({file:_,...fields},i):TemplateRecord=>({...fields,createdAt:i,updatedAt:i,favorite:false}));

it('assigns the eight editorial records unique files, prompts and named variables',()=>{
  expect(templateSeeds).toHaveLength(8);
  for(const key of ['id','file','prompt'] as const)expect(new Set(templateSeeds.map(seed=>seed[key])).size).toBe(8);
  for(const seed of templateSeeds){
    expect(existsSync(join('public','hub-templates',seed.file))).toBe(true);
    expect(templateVariables(seed.prompt)).toEqual(Object.keys(templateVariableLabels));
    expect(seed.features).toHaveLength(5);
    expect(seed.useCases.length).toBeGreaterThan(0);
  }
});

it('keeps edits, favorites and deleted seed IDs across reloads and legacy restores',()=>{
  const root=mkdtempSync(join(tmpdir(),'zen-templates-'));
  try {
    const open=()=>new KnowledgeHub(join(root,'hub.sqlite'),join(root,'missing-legacy.json'),seedRecords);
    const store=open();
    store.change({type:'save',fields:{...newFields('note'),title:'Existente',description:'Se conserva'}},()=>{});
    const notes=store.read().data;
    const seeded=store.templates({type:'list'});
    expect(seeded.type).toBe('list');
    if(seeded.type!=='list')throw Error();
    expect(seeded.items).toHaveLength(8);
    expect(seeded.items[0]).not.toHaveProperty('prompt');
    const first=seeded.items[0];
    const {file:_,id, ...fields}=templateSeeds[0];
    store.templates({type:'favorite',id});
    const draft={id,expected:first.updatedAt,fields:{...fields,name:'Editorial personalizada'}};
    store.templates({type:'draft',draft});
    expect(open().templates({type:'list'})).toMatchObject({draft:{fields:{name:'Editorial personalizada'}}});
    const saved=store.templates({type:'save',draft});
    expect(saved).toMatchObject({item:{favorite:true,name:'Editorial personalizada'}});
    expect(()=>store.templates({type:'save',draft})).toThrow('cambió');
    const duplicate=store.templates({type:'duplicate',id});
    expect(duplicate).toMatchObject({item:{name:'Editorial personalizada (copia)',favorite:false}});
    store.templates({type:'delete',id:seeded.items[1].id,expected:seeded.items[1].updatedAt});
    const reopened=open();
    reopened.restore(notes);
    expect(reopened.read().data.entries[0].title).toBe('Existente');
    const updated=reopened.templates({type:'list'});
    expect(updated.type).toBe('list');
    if(updated.type!=='list')throw Error();
    expect(updated.items).toHaveLength(8);
    expect(updated.items.map(item=>item.id)).not.toContain(seeded.items[1].id);
    expect(updated.items.find(item=>item.id===id)).toMatchObject({name:'Editorial personalizada',favorite:true});
    reopened.restore({...notes,templates:[]});
    expect(open().templates({type:'list'})).toMatchObject({items:[]});
  } finally {rmSync(root,{recursive:true,force:true});}
});

it('keeps unknown or empty placeholders and reports failed clipboard writes',()=>{
  const base='Hola {{nombre_proyecto}}, propósito {{objetivo}}';
  const copied:string[]=[];
  copyTemplatePrompt(base,{nombre_proyecto:' Demo ',objetivo:' '},text=>copied.push(text));
  expect(copied).toEqual(['Hola Demo, propósito {{objetivo}}']);
  expect(base).toContain('{{nombre_proyecto}}');
  expect(()=>copyTemplatePrompt(base,{unexpected:'x'},()=>{})).toThrow('no coinciden');
  expect(()=>copyTemplatePrompt(base,{},()=>{throw Error('locked');})).toThrow('No se pudo copiar');
});

it('rejects damaged reference data before changing a library',()=>{
  expect(()=>validateTemplateImage({name:'damaged.jpg',mime:'image/jpeg',original:'YWJjZA==',thumbnail:'YWJjZA=='})).toThrow('dañada');
  expect(emptyTemplate()).toMatchObject({name:'',prompt:''});
});
