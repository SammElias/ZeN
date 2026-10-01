import { randomUUID } from 'node:crypto';
import type { Artifact } from '../shared/contracts';
import { ZenError } from '../shared/errors';
export class Artifacts {
  private items = new Map<string, {meta:Artifact;data:Buffer;mime:string;at:number}>();
  add(title: string, data: Buffer, mime: 'image/png'|'image/jpeg'|'image/webp'|'text/plain'): Artifact {
    if(data.length>10000000) throw new ZenError('El resultado generado supera 10 MB.');
    const meta:Artifact={id:randomUUID(),title:title.slice(0,160),kind:mime.startsWith('image/')?'image':'text'};
    this.items.set(meta.id,{meta,data,mime,at:Date.now()});
    while(this.items.size>8 || [...this.items.values()].reduce((size,row)=>size+row.data.length,0)>32000000) this.items.delete(this.items.keys().next().value!);
    return meta;
  }
  get(id: string) {
    const item=this.items.get(id);if(!item || Date.now()-item.at>1800000) {this.items.delete(id);throw new ZenError('El resultado ya no está disponible. Las vistas generadas son temporales (30 minutos).');}
    return item;
  }
}
