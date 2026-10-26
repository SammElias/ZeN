import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {z} from 'zod';
import {LauncherOrder,LauncherPage,type WorkspacePage} from '../shared/companion-workspace';
const Preferences=z.object({order:LauncherOrder.default(['home','codex','gmail','spotify','notices']),last:LauncherPage.default('home')}).strict();
/** Only navigation preferences persist. Media sessions and mailbox data stay in RAM. */
export class CompanionLauncher{
 private value=z.parse(Preferences,{});
 constructor(private path:string){try{const raw=JSON.parse(readFileSync(path,'utf8'));if(Array.isArray(raw.order)&&raw.order.length===4&&new Set(raw.order).size===4&&raw.order.every((v:unknown)=>['home','spotify','gmail','codex'].includes(String(v))))raw.order.push('notices');this.value=Preferences.parse(raw);}catch{}}
 status(){return structuredClone(this.value);}
 private save(next:z.infer<typeof Preferences>){writeFileSync(this.path+'.tmp',JSON.stringify(next));renameSync(this.path+'.tmp',this.path);this.value=next;}
 reorder(raw:unknown){const order=LauncherOrder.parse(raw);if(order.join()!==this.value.order.join())this.save({...this.value,order});return this.status();}
 visit(page:WorkspacePage){const last=page==='permissions'?'codex':page;if(last==='settings'||last===this.value.last)return;if(LauncherPage.safeParse(last).success)this.save({...this.value,last:last as z.infer<typeof LauncherPage>});}
}
