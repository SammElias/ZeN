import type {BrowserWindow} from 'electron';
import {mkdir} from 'node:fs/promises';
import {writeEvidence as writeFile} from './evidence-file';
/** Isolated local profile. Real Electron rendering/IPC, synthetic input; no model. */
export async function mascotSmoke(window:BrowserWindow){
 const call=(code:string)=>window.webContents.executeJavaScript(code),dir='docs/ui-preview/mascot-native';await mkdir(dir,{recursive:true});
 const settle=()=>new Promise(r=>setTimeout(r,160));
 const click=async(text:string)=>{await call(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing '+${JSON.stringify(text)});b.click();})()`);await settle();};
 const capture=async(name:string)=>writeFile(`${dir}/${name}.png`,(await window.webContents.capturePage()).toPNG());
 window.setBounds({...window.getBounds(),width:640,height:560});await settle();
 const config=await call('window.zen.settings()');
 await call("document.querySelector('.navigation-tab[aria-label=Inicio]').click()");await settle();
 const welcome=await call("(()=>{const hero=document.querySelector('.home-leaning').getBoundingClientRect(),view=document.querySelector('.home-page').getBoundingClientRect();return document.querySelectorAll('.mascot-host').length===1&&document.querySelector('.mascot-host').dataset.presentation==='welcome'&&hero.top>=view.top&&hero.bottom<=view.bottom&&document.querySelector('.home-leaning h1').textContent==='¿Qué hacemos hoy?';})()");await capture('welcome');
 await call("document.querySelector('.navigation-tab[aria-label=Chat]').click()");await settle();
 const checks:Record<string,unknown>={at:new Date().toISOString(),scope:'Windows Electron; native rendering and settings IPC; simulated DOM input, no API/audio service',welcome,singleAvatar:await call("document.querySelectorAll('.mascot-host').length===1&&document.querySelector('.mascot-host').dataset.presentation==='full'"),noRobot:await call("!document.querySelector('.robot-shell,.robot-visor')")};
 checks.desktopCursor=await call("(async()=>{const point=await window.zen.cursor();return point.ok&&Number.isFinite(point.value?.x)&&Number.isFinite(point.value?.y)&&!!document.querySelector('.mascot-head-gaze').style.transform&&!!document.querySelector('.mascot-body-gaze').style.transform;})()");
 await capture('chat');await click('Apariencia');
 for(const [label,tone,outfit]of [['Neutral','neutral','signature'],['Creído','smug','light'],['Seguro','confident','all_black'],['Triste','sad_empathic','cozy'],['Xulito','playful_cocky','layered']]){await click(label);checks['tone-'+tone]=await call(`document.querySelector('.mascot-host').dataset.tone==='${tone}'&&document.querySelector('.mascot-host').dataset.wardrobe==='${outfit}'`);await capture(tone);}
 await call("document.querySelector('[aria-label=\"Cerrar apariencia\"]').click()");await settle();
 await click('Dar un paseo');await new Promise(r=>setTimeout(r,180));checks.walking=await call("document.querySelector('.mascot-host').dataset.locomotion==='walking'&&getComputedStyle(document.querySelector('.mascot-thigh.left')).transform!==getComputedStyle(document.querySelector('.mascot-thigh.right')).transform");await capture('walk');await click('Detener movimiento');
 checks.stopped=await call("document.querySelector('.mascot-host').dataset.locomotion==='still'");
 // Local synthetic status, never a provider request or a persisted user task.
 const thinkingBounds=JSON.stringify(window.getBounds());
 window.webContents.send('zen:task',{id:'mascot-thinking-fixture',state:'thinking',message:'Estado sintético de prueba'});await settle();
 checks.thinking=await call("(()=>{const h=document.querySelector('.mascot-host'),a=h.getAnimations({subtree:true}).filter(a=>a.playState==='running');return h.dataset.activity==='thinking'&&a.filter(a=>a.animationName==='zen-think-dot').length===3&&a.some(a=>a.animationName==='zen-think-head');})()");await capture('thinking');
 checks.thinkingFits=await call("(()=>{const h=document.querySelector('.mascot-host').getBoundingClientRect(),slot=document.querySelector('.mascot-stage-anchor').getBoundingClientRect(),view=document.querySelector('.chat-page').getBoundingClientRect(),bubble=document.querySelector('.mascot-thought').getBoundingClientRect();return Math.abs(h.top-slot.top)<1&&Math.abs(h.left-slot.left)<1&&bubble.top>=view.top&&bubble.bottom<=view.bottom;})()");
 window.webContents.send('zen:task',{id:'mascot-thinking-fixture',state:'completed',message:'Prueba local finalizada'});await settle();
 checks.thinkingStops=await call("!document.querySelector('.mascot-thought')")&&thinkingBounds===JSON.stringify(window.getBounds());
 await call("(async()=>{const r=await window.zen.settings();await window.zen.saveSettings({...r.value.settings,mascotWardrobe:'all_black',mascotWalks:false,petMotion:'reduced'});})()");await settle();
 checks.settings=await call("(async()=>{const r=await window.zen.settings();return r.value.settings.mascotWardrobe==='all_black'&&!r.value.settings.mascotWalks&&document.querySelector('.mascot-rig').classList.contains('static');})()");await capture('reduced');
 await call(`window.zen.saveSettings(${JSON.stringify(config.value.settings)})`);await settle();
 checks.passed=Object.entries(checks).filter(([k])=>!['at','scope'].includes(k)).every(([,v])=>v===true);await writeFile('docs/evidence/mascot-native.json',JSON.stringify(checks,null,2));return checks.passed===true;
}
