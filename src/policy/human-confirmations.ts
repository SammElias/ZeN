import {randomInt} from 'node:crypto';
import {confirmationCode,type HumanConfirmation} from '../shared/confirmation';
import {ZenError} from '../shared/errors';
export class HumanConfirmations {
  private entries=new Map<string,{view:HumanConfirmation;signature:string;execute:()=>Promise<unknown>}>();
  private used=new Set<string>();
  constructor(private changed:(rows:HumanConfirmation[])=>void,private now=()=>Date.now()){}
  list(){return [...this.entries.values()].filter(row=>row.view.expiresAt>this.now()).map(row=>({...row.view}));}
  offer(key:string,label:string,signature:string,execute:()=>Promise<unknown>,preview?:string){
    const previous=this.entries.get(key);if(previous?.signature===signature&&previous.view.expiresAt>this.now())return;
    if(this.used.size>=9000)throw new ZenError('Reinicia ZEN para generar nuevas confirmaciones.');
    let code:string;do{code=String(randomInt(1000,10000));}while(this.used.has(code));this.used.add(code);
    this.entries.set(key,{view:{key,label,code,expiresAt:this.now()+300000,...(preview?{preview}:{})},signature,execute});this.changed(this.list());
  }
  revoke(key:string){if(this.entries.delete(key))this.changed(this.list());}
  revokePrefix(prefix:string){for(const key of [...this.entries.keys()])if(key.startsWith(prefix))this.revoke(key);}
  clear(){this.entries.clear();this.changed([]);}
  async confirm(text:string){
    const code=confirmationCode(text);if(!code)throw new ZenError('Di o escribe «confirmo» y los cuatro dígitos de la propuesta visible.');
    const row=[...this.entries.values()].find(row=>row.view.code===code);
    if(!row||row.view.expiresAt<=this.now())throw new ZenError('La confirmación caducó, cambió o ya se usó. Revisa la propuesta actual.');
    this.revoke(row.view.key);return row.execute();
  }
}
