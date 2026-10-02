import { parentPort, workerData } from 'node:worker_threads';
import { inflateRawSync } from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';
import {crc32} from './zip-checksum';

const LIMIT=64000;
// PDF.js treats Electron's process.type as a browser renderer. This fixed Node
// worker has no DOM or Electron API; remove that hint before loading its Node build.
if(process.versions.electron&&!Reflect.deleteProperty(process,'type'))throw Error('Node worker context unavailable');
// Disable network entry points; parsing embedded text never resolves external resources.
globalThis.fetch=async()=>{throw new Error('Network disabled');};
function zipParts(bytes:Buffer,extension:string){
  if(bytes.readUInt32LE(0)!==0x04034b50)throw Error('ZIP');
  let end=-1;for(let n=bytes.length-22;n>=Math.max(0,bytes.length-65557);n--)if(bytes.readUInt32LE(n)===0x06054b50){end=n;break;}
  if(end<0||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6))throw Error('ZIP');
  const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
  if(count>2000||start+size>end)throw Error('ZIP limit');
  const parts=new Map<string,string>();let offset=start,total=0;
  for(let n=0;n<count;n++){
    if(offset+46>start+size||bytes.readUInt32LE(offset)!==0x02014b50)throw Error('ZIP directory');
    const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),compressed=bytes.readUInt32LE(offset+20),expanded=bytes.readUInt32LE(offset+24),nameLength=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32),local=bytes.readUInt32LE(offset+42);
    if(offset+46+nameLength+extra+comment>start+size)throw Error('ZIP directory');
    const name=bytes.subarray(offset+46,offset+46+nameLength).toString('utf8');offset+=46+nameLength+extra+comment;
    const wanted=extension==='.docx'?/^word\/(?:document|header\d+|footer\d+)\.xml$/.test(name):/^xl\/(?:sharedStrings|workbook|worksheets\/sheet\d+)\.xml$/.test(name);
    if(!wanted)continue;
    total+=expanded;if(parts.has(name)||flags&1||expanded>6_000_000||total>24_000_000||parts.size>=100||local+30>start||bytes.readUInt32LE(local)!==0x04034b50)throw Error('ZIP limit');
    const dataStart=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
    if(dataStart+compressed>start||bytes.readUInt16LE(local+8)!==method)throw Error('ZIP data');
    const data=bytes.subarray(dataStart,dataStart+compressed);
    const plain=method===0?data:method===8?inflateRawSync(data,{maxOutputLength:Math.min(expanded+1,6_000_001)}):undefined;
    if(!plain||plain.length!==expanded||crc32(plain)!==bytes.readUInt32LE(offset-46-nameLength-extra-comment+16))throw Error('ZIP length/checksum');
    const xml=plain.toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('XML entities');
    parts.set(name,xml);
  }
  return parts;
}
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',parseTagValue:false,trimValues:false,processEntities:true,removeNSPrefix:true});
const array=(value:any):any[]=>value===undefined?[]:Array.isArray(value)?value:[value];
const text=(value:any):string=>typeof value==='string'?value:typeof value==='number'?String(value):value&&typeof value==="object"?text(value['#text']):'';
async function read(){
  const bytes=Buffer.from(workerData.bytes),extension=workerData.extension;
  if(bytes.length>10_000_000)throw Error('size');
  let result='',partial=false;
  const append=(line:string)=>{if(result.length+line.length>LIMIT)partial=true;result=(result+line).slice(0,LIMIT);};
  if(extension==='.pdf'){
    const modulePath='./pdf.mjs';const pdf=await import(modulePath);pdf.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.mjs',import.meta.url).href;
    const task=pdf.getDocument({data:new Uint8Array(bytes),standardFontDataUrl:new URL('./standard_fonts/',import.meta.url).href,isEvalSupported:false,disableFontFace:true,useSystemFonts:false,useWorkerFetch:false,maxImageSize:0,stopAtErrors:true});
    const doc=await task.promise;
    try{partial=doc.numPages>40;for(let n=1;n<=Math.min(doc.numPages,40)&&result.length<LIMIT;n++){const page=await doc.getPage(n),content=await page.getTextContent();append(`\n[Página ${n}]\n`+content.items.map((item:any)=>typeof item.str==='string'?item.str+(item.hasEOL?'\n':' '):'').join(''));page.cleanup();}if(result.length===LIMIT)partial=true;}finally{await task.destroy();}
  }else{
    const parts=zipParts(bytes,extension);
    if(extension==='.docx'){
      if(!parts.has('word/document.xml'))throw Error('DOCX');
      // Extract only Word text and paragraph boundaries, never instructions or relationships.
      const visit=(node:any)=>{if(!node||typeof node!=='object')return;for(const [name,value]of Object.entries(node)){if(name==='t')for(const item of array(value))append(text(item));else if(name==='tab')append('\t');else if(name==='br')append('\n');else if(!name.startsWith('@'))for(const item of array(value)){visit(item);if(name==='p')append('\n');}}};
      for(const [name,xml]of [...parts].sort(([a],[b])=>a==='word/document.xml'?-1:b==='word/document.xml'?1:a.localeCompare(b))){append(`\n[${name}]\n`);visit(parser.parse(xml));}
    }else if(extension==='.xlsx'){
      if(!parts.has('xl/workbook.xml'))throw Error('XLSX');
      const rich=(value:any)=>array(value?.r).map(run=>text(run.t)).join('')||text(value?.t);
      const strings=array(parts.has('xl/sharedStrings.xml')?parser.parse(parts.get('xl/sharedStrings.xml')!).sst?.si:undefined).map(rich);
      const sheets=array(parser.parse(parts.get('xl/workbook.xml')!).workbook?.sheets?.sheet);
      const entries=[...parts].filter(([name])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
      if(!entries.length)throw Error('XLSX');
      for(const [index,[name,xml]]of entries.entries()){
        append(`\n[Hoja ${index+1}: ${name}]\n`); // File part is authoritative; relationship targets are never followed.
        const rows=array(parser.parse(xml).worksheet?.sheetData?.row);if(rows.length>3000)partial=true;
        for(const row of rows.slice(0,3000)){const cells=array(row.c);if(cells.length>100)partial=true;append(cells.slice(0,100).map(cell=>{const value=cell['@t']==='s'?strings[Number(text(cell.v))]??'':cell['@t']==='inlineStr'?rich(cell.is):text(cell.v);return `${cell['@r']??''}: ${value}${cell.f!==undefined?' [valor guardado; fórmula sin ejecutar]':''}`;}).join(' | ')+'\n');if(result.length>=LIMIT)break;}
        if(result.length>=LIMIT)break;
      }
    }else throw Error('extension');
  }
  if(!result.replace(/\[(?:Página \d+|word\/[^\]]+|Hoja[^\]]+)\]/g,'').trim())return {error:'empty'};
  return{text:result,partial};
}
read().then(value=>parentPort!.postMessage(value),()=>parentPort!.postMessage({error:'invalid'}));
