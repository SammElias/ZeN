import type OpenAI from 'openai';
import type {Response} from 'openai/resources/responses/responses';
import {basename,extname} from 'node:path';
import type {Artifacts} from './artifacts';
import {ZenError} from '../shared/errors';
const types:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.csv':'text/csv','.txt':'text/plain','.md':'text/markdown','.json':'application/json','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
export async function generatedFiles(client:Pick<OpenAI,'containers'>,response:Response,allowed:Set<string>,artifacts:Artifacts,signal:AbortSignal){
  const refs=new Map<string,{container_id:string;file_id:string;filename:string}>();
  for(const row of response.output)if(row.type==='message')for(const content of row.content)if(content.type==='output_text')for(const ref of content.annotations)if(ref.type==='container_file_citation'&&allowed.has(ref.container_id))refs.set(ref.file_id,ref);
  const results=[];let total=0;
  for(const ref of [...refs.values()].slice(0,4)){
    signal.throwIfAborted();const name=basename(ref.filename.replace(/\\/g,'/')).replace(/[\x00-\x1f<>:"|?*]/g,'_').slice(0,120),mime=types[extname(name).toLowerCase()];if(!mime)continue;
    const response=await client.containers.files.content.retrieve(ref.file_id,{container_id:ref.container_id},{signal});
    if(Number(response.headers.get('content-length'))>10000000){await response.body?.cancel();throw new ZenError('El archivo generado supera 10 MB.');}
    const reader=response.body?.getReader();if(!reader)throw new ZenError('No llegó el archivo generado.');
    const chunks:Buffer[]=[];let size=0;
    try{while(true){signal.throwIfAborted();const row=await reader.read();if(row.done)break;size+=row.value.byteLength;total+=row.value.byteLength;if(size>10000000||total>24000000)throw new ZenError('Resultados demasiado grandes para descargarlos.');chunks.push(Buffer.from(row.value));}}finally{await reader.cancel();}
    const bytes=Buffer.concat(chunks);if(!bytes.length)throw new ZenError('El archivo generado está vacío.');
    results.push(artifacts.add(name,bytes,mime));
  }return results;
}
