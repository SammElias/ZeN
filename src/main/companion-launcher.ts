import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {z} from 'zod';
import {LauncherOrder,LauncherPage,type WorkspacePage} from '../shared/companion-workspace';
const retiredPage = (page: unknown) => page === 'gmail' || page === 'calendar';
const Preferences=z.object({order:LauncherOrder.default(()=>[...LauncherPage.options]),last:LauncherPage.default('home')}).strict();
/** Only navigation preferences persist. */
export class CompanionLauncher{
 private value=z.parse(Preferences,{});
 constructor(private path:string) {
  try {
   const raw = JSON.parse(readFileSync(path, 'utf8'));
   if (Array.isArray(raw.order)) {
    if (raw.order.some(retiredPage)) {
     raw.order = raw.order.filter((page: unknown) => !retiredPage(page));
     if (!raw.order.includes('notices')) raw.order.push('notices');
    }
    if (!raw.order.includes('notes')) raw.order.push('notes');
   }
   if (retiredPage(raw.last)) raw.last = 'home';
   this.value = Preferences.parse(raw);
  } catch { /* Missing or invalid preferences use the defaults. */ }
 }
 status(){return structuredClone(this.value);}
 private save(next:z.infer<typeof Preferences>){writeFileSync(this.path+'.tmp',JSON.stringify(next));renameSync(this.path+'.tmp',this.path);this.value=next;}
 reorder(raw:unknown){const order=LauncherOrder.parse(raw);if(order.join()!==this.value.order.join())this.save({...this.value,order});return this.status();}
 visit(page:WorkspacePage){const last=page==='permissions'?'codex':page;if(last==='settings'||last===this.value.last)return;if(LauncherPage.safeParse(last).success)this.save({...this.value,last:last as z.infer<typeof LauncherPage>});}
}
