import {deflateRawSync} from 'node:zlib';
import {crc32} from '../src/tools/zip-checksum';
export function officeZip(parts:Record<string,string>){
  const files:Buffer[]=[],directory:Buffer[]=[];let position=0;
  for(const [name,text]of Object.entries(parts)){
    const filename=Buffer.from(name),bytes=Buffer.from(text),data=deflateRawSync(bytes);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc32(bytes),14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(filename.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc32(bytes),16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(position,42);
    files.push(local,filename,data);directory.push(central,filename);position+=local.length+filename.length+data.length;
  }
  const index=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(directory.length/2,8);end.writeUInt16LE(directory.length/2,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(position,16);return Buffer.concat([...files,index,end]);
}
export function textPdf(message='Synthetic PDF code 7319'){
  const stream=`BT /F1 12 Tf 40 700 Td (${message}) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let result='%PDF-1.4\n';const offsets=[0];objects.forEach((value,i)=>{offsets.push(Buffer.byteLength(result));result+=`${i+1} 0 obj\n${value}\nendobj\n`;});const start=Buffer.byteLength(result);
  result+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(result);
}
export const docxFixture=()=>officeZip({'word/document.xml':'<w:document xmlns:w="word"><w:body><w:p><w:r><w:t>Arquitectura código 7319 &amp; local</w:t></w:r></w:p><w:p><w:r><w:t>password=synthetic-secret</w:t></w:r></w:p></w:body></w:document>'});
export const xlsxFixture=()=>officeZip({'xl/workbook.xml':'<workbook><sheets><sheet name="Resumen"/></sheets></workbook>','xl/sharedStrings.xml':'<sst><si><t>Ingresos</t></si><si><r><t>Arquitectura </t></r><r><t>7319</t></r></si></sst>','xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><f>WEBSERVICE("https://example.invalid")</f><v>42</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>Texto local</t></is></c></row></sheetData></worksheet>'});
