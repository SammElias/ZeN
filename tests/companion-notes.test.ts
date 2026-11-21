import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, expect, it} from 'vitest';
import {CompanionNotes} from '../src/main/companion-notes';
import {KnowledgeHub} from '../src/main/knowledge-hub';
import {newFields} from '../src/shared/knowledge-hub';
import {emptyQuickNotes, QuickNotes} from '../src/shared/quick-notes';
import {boardCoordinateLimit, emptyWhiteboard, WhiteboardDocument} from '../src/shared/whiteboard';

const directories: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'zen-notes-'));
  directories.push(directory);
  const file = join(directory, 'notes.json');
  return {file, store: new CompanionNotes(file)};
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, {recursive: true, force: true});
});

it('reopens grouped notes with their original code and preserves the file after invalid edits', () => {
  const {file, store} = fixture();
  const folderId = store.change({type: 'createFolder', name: 'Power Platform'}).id!;
  const note = {type: 'saveNote' as const, folderId, title: 'Power Fx', description: 'Filtros de Dataverse', code: 'If(Activo,\n    "Sí",\n    "No"\n)'};
  const {id} = store.change(note);
  const reopened = new CompanionNotes(file);
  expect(reopened.read().notes).toEqual([expect.objectContaining({id, folderId, code: note.code})]);
  const saved = readFileSync(file, 'utf8');
  expect(() => reopened.change({...note, id, description: '  '})).toThrow();
  expect(() => reopened.change({type: 'removeFolder', id: folderId})).toThrow('Vacía la carpeta');
  expect(() => reopened.change({type: 'createFolder', name: 'power platform'})).toThrow('Ya existe');
  expect(readFileSync(file, 'utf8')).toBe(saved);
});

it('does not overwrite an unreadable notebook when saving a new folder', () => {
  const {file, store} = fixture();
  writeFileSync(file, '{incomplete');
  expect(() => store.change({type: 'createFolder', name: 'Nuevo'})).toThrow('No se pudieron leer');
  expect(readFileSync(file, 'utf8')).toBe('{incomplete');
});

it('migrates legacy notes once and persists drafts, typed entries, references and copy history', () => {
  const {file,store}=fixture();
  const folderId=store.change({type:'createFolder',name:'AI ENGINER'}).id!;
  const {id:note}=store.change({type:'saveNote',folderId,title:'Plugins',description:'## Etapas',code:'echo hi'});
  const legacy=readFileSync(file,'utf8');
  const path=join(file,'../knowledge.sqlite');
  const hub=new KnowledgeHub(path,file);
  const copy=(text:string)=>copied.push(text);
  const copied:string[]=[];
  expect(hub.read().data.entries[0]).toMatchObject({id:note,folderId,title:'Plugins',code:'echo hi'});
  const draft={fields:{...newFields('note',folderId),title:'Borrador'}};
  hub.draft(draft);
  expect(new KnowledgeHub(path,file).read().draft).toEqual(draft);
  const {id:snippet}=hub.change({type:'save',fields:{...newFields('snippet'),title:'Arranque',language:'Bash',code:'echo "{{PROJECT_NAME}}"'}},copy);
  const {id:project}=hub.change({type:'save',fields:{...newFields('project'),title:'Proyecto',related:[note!,snippet!]}},copy);
  hub.change({type:'copy',id:snippet!,values:{PROJECT_NAME:'ZEN'}},copy);
  expect(copied).toEqual(['echo "ZEN"']);
  const reopened=new KnowledgeHub(path,file);
  const {data}=reopened.read();
  expect(data.entries.find(entry=>entry.id===snippet)?.copiedAt).toEqual(expect.any(Number));
  expect(data.entries.find(entry=>entry.id===project)?.related).toEqual([note,snippet]);
  expect(reopened.read().draft).toBeUndefined();
  expect(readFileSync(file,'utf8')).toBe(legacy);
});

it('restores a validated snapshot atomically and rejects broken relationships', () => {
  const {file}=fixture();
  const hub=new KnowledgeHub(join(file,'../knowledge.sqlite'),file);
  const {data}=hub.change({type:'save',fields:{...newFields('resource'),title:'Referencia',url:'https://example.com'}},()=>{});
  expect(()=>hub.restore({...data,entries:[{...data.entries[0],related:['31261bf5-1845-4bb9-8bbb-97ad072b67a0']}]})).toThrow('relacionado');
  expect(hub.read().data).toEqual(data);
  hub.change({type:'remove',id:data.entries[0].id},()=>{});
  expect(hub.read().data.entries).toHaveLength(0);
  hub.restore(JSON.parse(JSON.stringify(data)));
  expect(hub.read().data).toEqual(data);
});

it('reopens the continuous sheet with exact whitespace and position, independently of the library', () => {
  const {file} = fixture();
  const open = () => new KnowledgeHub(join(file,'../knowledge.sqlite'),file);
  const hub = open();
  const library = hub.change({type:'save',fields:{...newFields('note'),title:'Nota de biblioteca',description:'Otra nota'}},()=>{}).data;
  expect(hub.quickNotes()).toEqual(emptyQuickNotes);

  const saved: QuickNotes = {
    text:'  Primera línea  \n\nSegunda\t línea 🙂\n',
    selectionStart:3, selectionEnd:10, selectionDirection:'backward', scrollTop:32.25,
  };
  hub.quickNotes(saved);
  expect(open().quickNotes()).toEqual(saved);
  expect(open().read().data.entries).toEqual(library.entries);
  expect(open().recentNotes()).toHaveLength(1);
  const backup = open().read(true).data;
  expect(JSON.stringify(backup)).not.toContain('Primera línea');
  open().restore(backup);
  expect(open().quickNotes()).toEqual(saved);

  hub.quickNotes({...emptyQuickNotes});
  expect(open().quickNotes()).toEqual(emptyQuickNotes);
});

it('persists whiteboard gestures and brush settings separately from the library and quick notes', () => {
  const {file} = fixture();
  const open = () => new KnowledgeHub(join(file,'../knowledge.sqlite'),file);
  const hub = open();
  expect(hub.whiteboard()).toEqual(emptyWhiteboard());
  const notes = {...emptyQuickNotes,text:'Apunte local'};
  hub.quickNotes(notes);
  const drawing: WhiteboardDocument = {
    version:1, width:12, color:'blue', strokes:[
      {tool:'brush',width:2,color:'ink',points:[[0,319],[960,319],[970,319]]},
      {tool:'eraser',points:[[480,300],[480,340]],clip:{left:0,top:-400,right:960,bottom:1040}},
    ],
  };
  expect(WhiteboardDocument.parse(drawing)).toEqual(drawing);
  expect(WhiteboardDocument.safeParse({...drawing,width:7}).success).toBe(false);
  expect(WhiteboardDocument.safeParse({...drawing,strokes:[{tool:'eraser',points:[[0,boardCoordinateLimit+1]]}]}).success).toBe(false);
  hub.whiteboard(drawing);
  const reopened = open();
  expect(reopened.whiteboard()).toEqual(drawing);
  const backup = reopened.read(true).data;
  expect(backup).not.toHaveProperty('whiteboard');
  reopened.restore(backup);
  expect(open().whiteboard()).toEqual(drawing);
  reopened.whiteboard({...drawing,strokes:[]});
  expect(open().whiteboard()).toEqual({...drawing,strokes:[]});
  expect(open().quickNotes()).toEqual(notes);
});
