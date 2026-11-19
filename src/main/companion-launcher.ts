import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {z} from 'zod';
import {LauncherOrder,LauncherPage,type WorkspacePage} from '../shared/companion-workspace';
import {isLauncherPageSelected,sectionPages,type SectionPage} from '../shared/companion-navigation';
const retiredPage = (page: unknown) => page === 'gmail';
const Preferences=z.object({order:LauncherOrder.default(()=>[...LauncherPage.options]),last:LauncherPage.default('home')}).strict();
/** Only navigation preferences persist. */
export class CompanionLauncher{
 private value=z.parse(Preferences,{});
 private section:SectionPage|undefined;
 constructor(private path:string) {
  try {
   const raw = JSON.parse(readFileSync(path, 'utf8'));
   if (Array.isArray(raw.order)) {
    if (raw.order.some(retiredPage)) {
     raw.order = raw.order.filter((page: unknown) => !retiredPage(page));
     if (!raw.order.includes('notices')) raw.order.push('notices');
    }
    if (!raw.order.includes('notes')) raw.order.push('notes');
    if (!raw.order.includes('calendar')) raw.order.push('calendar');
   }
   if (retiredPage(raw.last)) raw.last = 'home';
   this.value = Preferences.parse(raw);
  } catch { /* Missing or invalid preferences use the defaults. */ }
  this.section=sectionPages.find(section=>isLauncherPageSelected(this.value.last,section));
 }
 get recentSection(){return this.section;}
 status(){return structuredClone(this.value);}
 private save(next:z.infer<typeof Preferences>){writeFileSync(this.path+'.tmp',JSON.stringify(next));renameSync(this.path+'.tmp',this.path);this.value=next;}
 reorder(raw:unknown){const order=LauncherOrder.parse(raw);if(order.join()!==this.value.order.join())this.save({...this.value,order});return this.status();}
 visit(page:WorkspacePage){
  const last=LauncherPage.safeParse(page==='permissions'?'codex':page);
  if(last.success&&last.data!==this.value.last)this.save({...this.value,last:last.data});
  const section=sectionPages.find(section=>isLauncherPageSelected(page,section));
  if(section)this.section=section;
 }
}
