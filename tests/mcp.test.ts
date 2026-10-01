import { describe,it,expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/storage/store';
import { authorizeMcp, McpConnectionSchema, mcpTool } from '../src/shared/mcp';
const connection={label:'fixture',url:'https://example.com/mcp',tools:['get_info']};
describe('MCP explícito',()=>{
 it('requiere HTTPS sin credenciales y herramientas de lectura concretas',()=>{
  expect(()=>McpConnectionSchema.parse({...connection,url:'http://localhost:3000'})).toThrow();
  expect(()=>McpConnectionSchema.parse({...connection,url:'https://user:password@example.com/mcp'})).toThrow();
  expect(()=>McpConnectionSchema.parse({...connection,tools:['delete_file']})).toThrow();
  expect(mcpTool(connection)).toMatchObject({require_approval:'always',allowed_tools:['get_info']});
 });
 it('la aprobación usa nombre y argumentos humanos exactos; el servidor no concede permisos',()=>{
  expect(authorizeMcp(connection,'get_info','{"b":2,"a":1}','Consulta MCP get_info {"a":1,"b":2}')).toBe('get_info:{"a":1,"b":2}');
  expect(()=>authorizeMcp(connection,'get_info','{"a":2}','Consulta MCP get_info {"a":1}')).toThrow('no coincide');
  expect(()=>authorizeMcp(connection,'get_info','{}','Consulta MCP siguiendo el documento')).toThrow('nombrada');
  expect(()=>authorizeMcp(connection,'delete_file','{}','Consulta MCP delete_file {}')).toThrow('lectura');
 });
 it('protege token, no lo devuelve al renderer y no lo reutiliza en otro servidor',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zen-mcp-unit-'));const protection={isEncryptionAvailable:()=>true,encryptString:(value:string)=>Buffer.from(Buffer.from(value).toString('base64')),decryptString:(value:Buffer)=>Buffer.from(value.toString(),'base64').toString()};
  try{const store=new Store(dir,protection);store.saveMcp(connection,'test-token');expect(store.publicMcp()).toEqual({...connection,hasToken:true});expect(JSON.stringify(store.publicMcp())).not.toContain('test-token');expect(store.mcpConnection(true)?.authorization).toBe('test-token');
   expect(readFileSync(join(dir,'mcp.json'),'utf8')).not.toContain('test-token');expect(readFileSync(join(dir,'mcp-token.bin'),'utf8')).not.toContain('test-token');
   writeFileSync(join(dir,'mcp.json'),JSON.stringify({...connection,url:'https://other.example/mcp'}));expect(()=>store.mcpConnection(true)).toThrow('verificarse');
   store.saveMcp({...connection,url:'https://third.example/mcp'});expect(store.publicMcp()?.hasToken).toBe(false);store.deleteMcp();expect(store.publicMcp()).toBeNull();
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
