import type {BrowserWindow} from 'electron';
import {glassOpacity,type AppearanceOptions} from '../shared/companion-appearance';
import {defaultNeon} from '../shared/companion-neon';
import {sectionPages} from '../shared/companion-navigation';

type Tools={
 cap:BrowserWindow;js:(cap:BrowserWindow,source:string)=>Promise<any>;
 wait:(check:()=>Promise<unknown>)=>Promise<void>;nav:(page:string)=>Promise<void>;
 shot:(cap:BrowserWindow,name:string)=>Promise<void>;selectPosition:(side:string)=>Promise<void>;
 compact:()=>Promise<void>;resize:(width:number,height:number)=>Promise<void>;
};
const color=(value:string)=>value.startsWith('#')
 ?value.slice(1).match(/../g)!.slice(0,3).map(value=>parseInt(value,16))
 :value.match(/[\d.]+/g)!.slice(0,3).map(Number);
const luminance=(rgb:number[])=>rgb.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4)
 .reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
function contrast(a:number[],b:number[]){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

export async function smokeAppearance({cap,js,wait,nav,shot,selectPosition,compact,resize}:Tools){
 const report:Record<string,any>={},run=(source:string)=>js(cap,source);
 const check=(name:string,value:boolean)=>{report[name]=value;if(!value)throw Error('Glass assertion failed: '+name);};
 const state=await run('window.companion.status().then(result=>result.value.appearance)');
 const {theme,accent,background,opacity,blur,neon}=state;
 const original:AppearanceOptions={theme,accent,background,opacity,blur,...(neon?{neon}:{})};
 const apply=async(update:Partial<AppearanceOptions>)=>{
  await nav('settings');
  const options={...original,...update};
  const result=await run(`window.companion.appearanceSave(${JSON.stringify(options)})`);
  if(!result.ok)throw Error(result.error);
  await wait(()=>run(`document.querySelector('main').dataset.theme===${JSON.stringify(options.theme)}&&getComputedStyle(document.querySelector('main')).getPropertyValue('--glass-blur')===${JSON.stringify(options.blur+'px')}`));
 };
 const style=()=>run(`(()=>{
  const surface=document.querySelector('.workspace-surface'),panel=document.querySelector('#capsule-content'),root=document.querySelector('main');
  const scene=getComputedStyle(surface,'::before'),glass=getComputedStyle(surface,'::after'),content=getComputedStyle(panel),tokens=getComputedStyle(root);
  return {scene:scene.backgroundImage,blur:glass.backdropFilter,tint:glass.backgroundColor,
   content:content.backgroundColor,contentBlur:content.backdropFilter,contentFilter:content.filter,
   capsuleBlur:getComputedStyle(document.querySelector('.compact-capsule'),'::before').backdropFilter,
   ink:content.color,secondary:tokens.getPropertyValue('--glass-secondary').trim(),
   surface:surface.getBoundingClientRect().toJSON(),panel:panel.getBoundingClientRect().toJSON(),count:document.querySelectorAll('.workspace-surface').length};
 })()`);
 const paint=()=>run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 const variation=async()=>{
  await paint();
  const rect=await run("document.querySelector('#capsule-content').getBoundingClientRect().toJSON()");
  const bitmap=(await cap.webContents.capturePage({x:Math.round(rect.x+rect.width/2-100),y:Math.round(rect.y+9),width:200,height:1})).toBitmap();
  const values=Array.from({length:bitmap.length/4},(_,index)=>bitmap[index*4]);
  return Math.max(...values)-Math.min(...values);
 };
 await selectPosition('top');await nav('settings');
 const picked=await run('window.companion.appearanceChoose()');
 check('glassManagedWallpaper',picked.ok&&!!picked.value.imageUrl);
 await run(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>reject(Error('No se pudo cargar el fondo de prueba.'));image.src=${JSON.stringify(picked.value.imageUrl)};})`);
 await apply({theme:'dark',background:'image',opacity:glassOpacity.minimum,blur:0});await nav('home');
 const sharp=await variation();
 await apply({theme:'dark',background:'image',opacity:glassOpacity.minimum,blur:24});await nav('home');
 const blurred=await variation();
 report.glassPixels={sharp,blurred};
 check('glassBlurActuallyChangesWallpaper',sharp>=15&&blurred<sharp*.6);
 const contrasts:Record<string,number>={};
 for(const theme of ['dark','light','monochrome'] as const){
  await apply({theme,background:'image',opacity:glassOpacity.minimum,blur:24});
  let signature='';
  for(const page of sectionPages){
   await nav(page);
   const value=await style(),next=JSON.stringify([value.scene,value.blur,value.tint]);
   signature||=next;
   check('sharedGlass-'+theme+'-'+page,next===signature&&value.count===1&&value.scene.includes('zen-theme://background/')&&
    value.blur.includes('blur(24px)')&&value.capsuleBlur.includes('blur(24px)')&&value.content==='rgba(0, 0, 0, 0)'&&value.contentBlur==='none'&&value.contentFilter==='none'&&
    ['x','y','width','height'].every(key=>value.surface[key]===value.panel[key]));
   if(page==='notes')check('hubSharedTheme-'+theme,await run(`(()=>{
    const hub=document.querySelector('.knowledge-hub'),root=document.querySelector('main');
    return hub&&getComputedStyle(hub).color===getComputedStyle(root).color&&getComputedStyle(hub).backgroundColor==='rgba(0, 0, 0, 0)';
   })()`));
   if(theme==='dark')await shot(cap,'glass-'+page);
   if(page==='home'&&theme==='dark')check('glassStaysFixedOnScroll',await run(`(()=>{
    const panel=document.querySelector('#capsule-content'),surface=document.querySelector('.workspace-surface');
    const before=JSON.stringify(surface.getBoundingClientRect().toJSON());
    panel.scrollTop=160;
    const unchanged=before===JSON.stringify(surface.getBoundingClientRect().toJSON());
    const scrolled=panel.scrollTop>0||panel.scrollHeight<=panel.clientHeight;
    panel.scrollTop=0;return unchanged&&scrolled;
   })()`));
  }
  const value=await style(),tint=color(value.tint),alpha=Number(value.tint.match(/[\d.]+/g)!.at(-1));
  const backgrounds=[0,255].map(level=>tint.map(channel=>channel*alpha+level*(1-alpha)));
  const minimum=Math.min(...backgrounds.flatMap(background=>[contrast(color(value.ink),background),contrast(color(value.secondary),background)]));
  contrasts[theme]=minimum;
  check('glassContrast-'+theme,minimum>=4.5);
 }
 report.glassContrastRatios=contrasts;
 for(const background of ['aurora','dusk'] as const){
  await apply({theme:'dark',background,blur:12});await nav('home');
  const value=await style();
  check('glassPreset-'+background,!value.scene.includes('zen-theme:')&&value.scene.includes('gradient')&&value.blur.includes('blur(12px)'));
 }
 // This emulation affects only the synthetic renderer under test.
 cap.webContents.debugger.attach('1.3');
 try{
  await cap.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
  await wait(()=>run("getComputedStyle(document.querySelector('main')).getPropertyValue('--glass-blur')==='0px'"));
  const value=await style();
  check('glassReducedTransparency',value.blur.includes('blur(0px)')&&value.tint.startsWith('rgb('));
  await cap.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  const savedSettings=await run('window.companion.status().then(result=>result.value.settings)');
  const setMotion=(motion:boolean)=>run(`window.companion.save(${JSON.stringify({...savedSettings,motion})})`);
  await nav('settings');await setMotion(true);
  const cyan={...defaultNeon,palette:'cyan' as const,intensity:100,speed:'fast' as const};
  await apply({theme:'dark',background:'dusk',neon:cyan});
  await nav('home');
  await wait(()=>run(`['.workspace-neon-border','.compact-capsule .neon-border'].every(selector=>{
   const border=document.querySelector(selector);
   return border?.dataset.palette==='cyan'&&border.dataset.running==='true';
  })`));
  const geometry=()=>run(`(()=>{
   const border=document.querySelector('.workspace-neon-border'),shell=document.querySelector('.workspace-surface');
   if(!border)return false;
   const a=border.getBoundingClientRect(),b=shell.getBoundingClientRect(),stroke=border.querySelector('.workspace-neon-trail rect');
   return {rect:a.toJSON(),length:stroke.getTotalLength(),offset:getComputedStyle(stroke).strokeDashoffset,
    aligned:['x','y','width','height'].every(key=>a[key]===b[key]),nonInteractive:getComputedStyle(border).pointerEvents==='none',
    palette:border.dataset.palette,running:border.dataset.running,phase:Number(border.style.getPropertyValue('--neon-phase')),
    island:document.querySelector('.compact-capsule .neon-border')?.dataset.running};
  })()`);
  const first=await geometry();
  await wait(async()=>{const next=await geometry();return next.phase!==first.phase&&next.offset!==first.offset;});
  check('neonAnimatedOnBoth',first.running==='true'&&first.island==='true'&&first.palette==='cyan');
  await run("window.neonFixtureBorder=document.querySelector('.workspace-neon-border')");
  await nav('codex');
  check('neonRetainedAcrossSections',await run("window.neonFixtureBorder===document.querySelector('.workspace-neon-border')"));
  await nav('home');
  await shot(cap,'neon-panel-arriba');
  for(const side of ['left','right','floating']){
   await selectPosition(side);
   await wait(async()=>{const next=await geometry();return next.aligned&&next.length>600;});
   const next=await geometry();
   check('neonPanelFollows-'+side,next.aligned&&next.nonInteractive&&next.palette==='cyan');
  }
  await resize(820,750);
  const wide=await geometry();
  await resize(650,610);
  const narrow=await geometry();
  check('neonPanelFollowsResize',wide.aligned&&narrow.aligned&&wide.length>narrow.length);
  const beforeCollapse=narrow.phase;
  await compact();
  check('neonOnlyIslandWhenCollapsed',await run("!document.querySelector('.workspace-neon-border')&&document.querySelector('.compact-capsule .neon-border')?.dataset.running==='true'"));
  await nav('home');
  const reopened=await geometry();
  check('neonKeepsPhaseWhenReopened',(reopened.phase-beforeCollapse+1)%1<.3&&reopened.phase!==0&&reopened.island==='true');
  await shot(cap,'neon-panel-flotante');
  await cap.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await wait(()=>run("document.querySelector('.workspace-neon-border')?.dataset.running==='false'&&document.querySelector('.compact-capsule .neon-border')?.dataset.running==='false'"));
  check('neonRespectsReducedMotion',await run("getComputedStyle(document.querySelector('.workspace-neon-trail')).display==='none'&&!!document.querySelector('.workspace-neon-border > g rect')"));
  await cap.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});
  await apply({neon:{...cyan,enabled:false}});
  await wait(()=>run("!document.querySelector('.workspace-neon-border,.compact-capsule .neon-border')"));
  check('neonToggleAppliesToBoth',true);
  await setMotion(savedSettings.motion);
 }finally{
  await cap.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});
  cap.webContents.debugger.detach();
 }
 await apply(original);await nav('home');
 return report;
}
