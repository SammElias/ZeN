import {randomUUID} from 'node:crypto';
import {existsSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {expect,it} from 'vitest';
import {KnowledgeHub} from '../src/main/knowledge-hub';
import {copyTemplatePrompt,validateTemplateImage} from '../src/main/knowledge-templates';
import {templateSeeds} from '../src/main/knowledge-template-seeds';
import {emptyTemplate, templateLimit, templatePrompt,templateVariables, type TemplateRecord} from '../src/shared/knowledge-templates';
import {newFields} from '../src/shared/knowledge-hub';
import {enterpriseTemplateArea,initialEnterpriseTemplateCount,templateAreas} from '../src/shared/enterprise-template-catalog';

const seedRecords=()=>templateSeeds.map(({file:_,...fields},i):TemplateRecord=>({...fields,createdAt:i,updatedAt:i,favorite:false}));

it('ships 30 enterprise designs across six areas with distinct Canvas and React prompts',()=>{
  expect(templateSeeds).toHaveLength(30);
  for(const key of ['id','file','prompt','reactPrompt'] as const)expect(new Set(templateSeeds.map(seed=>seed[key])).size).toBe(30);
  expect(new Set(templateSeeds.map(seed=>enterpriseTemplateArea(seed.id)))).toEqual(new Set(Object.values(templateAreas)));
  for(const seed of templateSeeds){
    expect(existsSync(join('public','hub-templates',seed.file))).toBe(true);
    expect(templateVariables(seed.prompt)).toEqual(['nombre_proyecto','objetivo','origen_datos']);
    expect(templateVariables(seed.reactPrompt)).toEqual(templateVariables(seed.prompt));
    expect(templatePrompt(seed,'canvas')).toContain('Power Fx');
    expect(templatePrompt(seed,'react')).toContain('Entrega para React + TypeScript');
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
    expect(seeded.items).toHaveLength(30);
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
    expect(updated.items).toHaveLength(30);
    expect(updated.items.map(item=>item.id)).not.toContain(seeded.items[1].id);
    expect(updated.items.find(item=>item.id===id)).toMatchObject({name:'Editorial personalizada',favorite:true});
    reopened.restore({...notes,templates:[]});
    expect(open().templates({type:'list'})).toMatchObject({items:[]});
  } finally {rmSync(root,{recursive:true,force:true});}
});

it.each(['editorial','personal'] as const)('migrates the original collection while handling the %s draft',draftScope=>{
  const root=mkdtempSync(join(tmpdir(),'zen-enterprise-templates-'));
  try {
    const path=join(root,'hub.sqlite');
    const hub=new KnowledgeHub(path,join(root,'missing-legacy.json'),seedRecords);
    const initial=hub.read().data;
    const {id:_,...source}=seedRecords()[0];
    const old={...source,id:'45b8c010-f3ba-479a-8d10-000000000001',name:'Ejemplo anterior',reactPrompt:undefined};
    const personal={...old,id:'ffffffff-1111-4111-8111-ffffffffffff',name:'Plantilla personal'};
    const {name,description,prompt,tags,author,sourceUrl,features,useCases}=old;
    const draft={id:draftScope==='personal'?personal.id:old.id,expected:0,fields:{name,description,prompt,tags,author,sourceUrl,features,useCases}};
    hub.restore({...initial,templates:[old,personal]},undefined,draft);
    const db=new DatabaseSync(path);
    try {db.exec("UPDATE hub_state SET value='1' WHERE key='templates-initialized'");}
    finally{db.close();}

    const migrated=hub.read(true);
    expect(migrated.data.templates?.map(item=>item.id)).toEqual([...seedRecords().map(item=>item.id),personal.id]);
    expect(migrated.templateDraft).toEqual(draftScope==='personal'?draft:undefined);
    expect(hub.read(true)).toEqual(migrated);
  } finally {rmSync(root,{recursive:true,force:true});}
});

it('adds only the expansion when upgrading from seven designs',()=>{
  const root=mkdtempSync(join(tmpdir(),'zen-expand-templates-'));
  try {
    const path=join(root,'hub.sqlite');
    const hub=new KnowledgeHub(path,join(root,'missing-legacy.json'),seedRecords);
    const samples=seedRecords().slice(0,initialEnterpriseTemplateCount);
    const first={...samples[0],name:'Mesa editada',favorite:true,updatedAt:25};
    const removed=samples[1];
    const personal={...samples[2],id:randomUUID(),name:'Plantilla personal'};
    const {id,createdAt:_,updatedAt,favorite:__,image:___,...fields}=first;
    const draft={id,expected:updatedAt,fields:{...fields,name:'Borrador activo'}};
    hub.restore({...hub.read().data,templates:[first,...samples.slice(2),personal]},undefined,draft);
    const db=new DatabaseSync(path);
    try {db.exec("UPDATE hub_state SET value='2' WHERE key='templates-initialized'");}
    finally{db.close();}

    const migrated=hub.read(true);
    const items=migrated.data.templates!;
    expect(items).toHaveLength(30);
    expect(items).toContainEqual(first);
    expect(items).toContainEqual(personal);
    expect(items.map(item=>item.id)).not.toContain(removed.id);
    expect(items).toEqual(expect.arrayContaining(seedRecords().slice(initialEnterpriseTemplateCount).map(item=>expect.objectContaining({id:item.id}))));
    expect(migrated.templateDraft).toEqual(draft);
    expect(hub.read(true)).toEqual(migrated);
  } finally {rmSync(root,{recursive:true,force:true});}
});

it('keeps a full personal collection accessible during the expansion',()=>{
  const root=mkdtempSync(join(tmpdir(),'zen-full-templates-'));
  try {
    const path=join(root,'hub.sqlite');
    const hub=new KnowledgeHub(path,join(root,'missing-legacy.json'),seedRecords);
    const sample=seedRecords()[initialEnterpriseTemplateCount];
    const personal=Array.from({length:templateLimit-1},()=>({...sample,id:randomUUID(),name:'Plantilla personal'}));
    hub.restore({...hub.read().data,templates:personal});
    const db=new DatabaseSync(path);
    try {db.exec("UPDATE hub_state SET value='2' WHERE key='templates-initialized'");}
    finally{db.close();}
    const ids=hub.read(true).data.templates!.map(item=>item.id);
    expect(ids).toHaveLength(templateLimit);
    expect(ids).toEqual(expect.arrayContaining([...personal.map(item=>item.id),sample.id]));
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
