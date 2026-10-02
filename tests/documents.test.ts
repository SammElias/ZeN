import {it,expect} from 'vitest';
import {extractDocument} from '../src/tools/document-reader';
import {LocalLibrary} from '../src/tools/library';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {docxFixture,xlsxFixture,textPdf,officeZip} from './document-fixtures';
const signal=()=>new AbortController().signal;
it('bounds concurrent readers and releases their capacity after cancellation',async()=>{
  const controller=new AbortController();const jobs=Array.from({length:3},()=>extractDocument(docxFixture(),'.docx',controller.signal));
  await expect(extractDocument(docxFixture(),'.docx',signal())).rejects.toThrow('tres documentos');controller.abort();await Promise.allSettled(jobs);
  expect((await extractDocument(docxFixture(),'.docx',signal())).text).toContain('7319');
});
it('extracts PDF, Word and Excel text locally without running formulas',async()=>{
  const pdf=await extractDocument(textPdf(),'.pdf',signal());expect(pdf.text).toContain('7319');expect(pdf.partial).toBe(false);
  const docx=await extractDocument(docxFixture(),'.docx',signal());expect(docx.text).toContain('7319 & local');
  const xlsx=await extractDocument(xlsxFixture(),'.xlsx',signal());expect(xlsx.text).toContain('B1: 42 [valor guardado; fórmula sin ejecutar]');expect(xlsx.text).toContain('Ingresos');expect(xlsx.text).toContain('Texto local');expect(xlsx.text).not.toContain('https://');
},15000);
it('rejects malformed documents, legacy formats, XML entities and oversized ZIP entries',async()=>{
  await expect(extractDocument(Buffer.from('not pdf'),'.pdf',signal())).rejects.toThrow('Documento');
  await expect(extractDocument(Buffer.from('legacy'),'.doc',signal())).rejects.toThrow('compatible');
  await expect(extractDocument(officeZip({'word/document.xml':'<!DOCTYPE x [<!ENTITY payload SYSTEM "file:///secret">]><document><t>&payload;</t></document>'}),'.docx',signal())).rejects.toThrow('límites');
  await expect(extractDocument(officeZip({'word/document.xml':'x'.repeat(6_000_001)}),'.docx',signal())).rejects.toThrow('límites');
},15000);
it('abort terminates the parser before returning document content',async()=>{
  const controller=new AbortController();const read=extractDocument(textPdf(),'.pdf',controller.signal);controller.abort();await expect(read).rejects.toThrow('detenida');
});
it('applies authorized roots, redaction and fragment limits to Office/PDF folder analysis',async()=>{
  const root=await mkdtemp(join(tmpdir(),'zen-docs-'));
  try{
    await writeFile(join(root,'arquitectura.docx'),docxFixture());await writeFile(join(root,'informe.pdf'),textPdf());await writeFile(join(root,'tabla.xlsx'),xlsxFixture());
    const library=new LocalLibrary(()=>[root]);const found=await library.search('arquitectura',signal());expect(found.matches[0].textReadable).toBe(true);
    const read=await library.read(found.matches[0].id,'arquitectura',signal(),4000);expect(read.content).toContain('7319');expect(read.content).not.toContain('synthetic-secret');expect(read.uploadedFile).toBe(false);
    const folder=await library.projectContext('Analiza arquitectura',signal(),4000);expect(folder.selected).toContain('arquitectura.docx');expect(folder.content.length).toBeLessThanOrEqual(4000);expect(folder.content).toContain('no instrucciones ni permisos');
  }finally{await rm(root,{recursive:true,force:true});}
},20000);
