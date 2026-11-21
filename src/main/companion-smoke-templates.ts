import {dialog,type BrowserWindow} from 'electron';
import {join} from 'node:path';
import {writeFileSync} from 'node:fs';
import {templateAreas} from '../shared/enterprise-template-catalog';
import {templateSeeds} from './knowledge-template-seeds';

export async function smokeTemplates({
  cap,js,wait,nav,shot,resize,selectPosition,profile,copiedText,
}:{
  cap:BrowserWindow;
  js:(cap:BrowserWindow,source:string)=>Promise<any>;
  wait:(check:()=>Promise<unknown>)=>Promise<void>;
  nav:(page:string)=>Promise<void>;
  shot:(cap:BrowserWindow,name:string)=>Promise<void>;
  resize:(width:number,height:number)=>Promise<void>;
  selectPosition:(side:string)=>Promise<void>;
  profile:string;
  copiedText:string[];
}) {
  const report:Record<string,boolean>={};
  const run=(script:string)=>js(cap,script);
  const expectState=(script:string)=>wait(()=>run(script));
  const button=(text:string, root='.templates-view')=>run(`(()=>{
   const found=[...document.querySelectorAll(${JSON.stringify(root+' button')})].find(button=>!button.closest('[hidden]')&&
    (button.textContent.trim()===${JSON.stringify(text)}||button.getAttribute('aria-label')===${JSON.stringify(text)}));
   if(!found||found.disabled)throw Error('Control no disponible');found.click();
  })()`);
  const change=(selector:string,value:string)=>run(`(()=>{
   const element=document.querySelector(${JSON.stringify(selector)});
   Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element),'value').set.call(element,${JSON.stringify(value)});
   element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));
  })()`);

  await selectPosition('floating');
  await nav('notes');
  await button('Templates','.hub-sidebar');
  await resize(1024,760);
  await expectState("document.querySelectorAll('.template-card').length===30");
  report.templatesAllReferences=await run(`(async()=>{
   const names=${JSON.stringify(templateSeeds.map(seed=>seed.name))};
   const cards=[...document.querySelectorAll('.template-card')];
   const images=await Promise.all(cards.map(async card=>{
    const thumbnail=card.querySelector('img');
    if(!thumbnail?.src.includes('/thumbnail?'))return false;
    const image=new Image();image.src=thumbnail.src;await image.decode().catch(()=>{});
    return image.naturalWidth>0&&image.naturalWidth<=480&&image.naturalHeight<=480;
   }));
   const {value}=await window.companion.templates({type:'list'});
   const records=await Promise.all(value.items.map(({id})=>window.companion.templates({type:'detail',id})));
   return cards.map(card=>card.querySelector('strong').textContent).join('|')===names.join('|')&&images.every(Boolean)&&
    new Set(records.map(record=>record.value.item.prompt)).size===30&&records.every(record=>record.value.item.hasImage&&record.value.item.features.length===5&&record.value.item.reactPrompt?.includes('Entrega para React + TypeScript'));
  })()`);
  report.templateAreas=await run(`Array.from(document.querySelectorAll('optgroup[label="Áreas de trabajo"] option'), option=>option.value).join('|')===${JSON.stringify(Object.values(templateAreas).join('|'))}`);
  await shot(cap,'templates-gallery');
  await change('[aria-label="Filtrar por categoría"]','Compras y finanzas');
  await expectState("document.querySelectorAll('.template-card').length===5");
  await button('Favorito · Solicitud de compra');
  await expectState("document.querySelector('[aria-label=\"Favorito · Solicitud de compra\"]').getAttribute('aria-pressed')==='true'");
  await button('Favoritos');
  await expectState("document.querySelectorAll('.template-card').length===1");
  report.templateFavoriteKeepsGallery=await run("!document.querySelector('.template-detail')");
  await button('Abrir Solicitud de compra');
  await expectState("document.querySelector('.template-information h2')?.textContent==='Solicitud de compra'");
  await expectState("document.querySelector('.template-figure img')?.naturalWidth>480");
  report.templateWideDetail=await run("getComputedStyle(document.querySelector('.template-detail-grid')).gridTemplateColumns.split(' ').length===2");
  await button('Ampliar referencia visual');
  await expectState("document.querySelector('.template-zoom[open] img')?.naturalWidth>480");
  await button('Cerrar imagen');
  await change('.template-variables input','Proyecto fixture');
  const copyStart=copiedText.length;
  await button('Copiar prompt');
  await expectState("document.querySelector('.templates-view [role=status]')?.textContent.includes('Copiado.')");
  await button('React + TypeScript');
  await expectState("document.querySelector('.template-prompt pre')?.textContent.includes('Entrega para React + TypeScript')");
  await button('Copiar prompt');
  await expectState("document.querySelector('.templates-view [role=status]')?.textContent.includes('Copiado.')");
  await button('Copiar personalizado');
  await expectState("document.querySelector('.templates-view [role=status]')?.textContent.includes('Copiado.')");
  report.templateCopiesBothPlatforms=copiedText.length===copyStart+3&&
    copiedText[copyStart].includes('Entrega para Power Apps Canvas')&&copiedText[copyStart+1].includes('Entrega para React + TypeScript');
  report.templatePersonalizationKeepsBase=copiedText[copyStart+1]?.includes('{{nombre_proyecto}}')&&
    copiedText[copyStart+2]?.includes('Proyecto fixture')&&copiedText[copyStart+2]?.includes('{{objetivo}}');
  await run("window.companion.island(true)");
  await expectState("!!document.querySelector('.notes-retained[hidden]')");
  await nav('notes');
  await expectState("document.querySelector('.template-variables input')?.value==='Proyecto fixture'&&document.querySelector('.template-prompt pre')?.textContent.includes('Entrega para React + TypeScript')");
  report.templateDetailSurvivesCollapse=true;
  await shot(cap,'templates-detail');
  await resize(420,610);
  report.templateNarrowDetail=await run(`(()=>{
    const view=document.querySelector('.templates-view'),grid=view.querySelector('.template-detail-grid');
    return getComputedStyle(grid).gridTemplateColumns.split(' ').length===1&&view.scrollWidth<=view.clientWidth+1;
  })()`);
  await shot(cap,'templates-narrow');
  await button('Volver a Templates');
  await expectState("document.activeElement?.getAttribute('aria-label')==='Abrir Solicitud de compra'");
  report.templateReturnPreservesFilters=await run("document.querySelector('[aria-label=\"Filtrar por categoría\"]').value==='Compras y finanzas'&&document.querySelectorAll('.template-card').length===1");
  await run("document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))");
  report.templateKeyboardSearch=await run("document.activeElement?.getAttribute('aria-label')==='Buscar templates'");
  await change('[aria-label="Buscar templates"]','sin coincidencias');
  await expectState("document.querySelector('.template-empty')?.textContent.includes('No hay templates')");
  await button('Limpiar filtros');
  await expectState("document.querySelectorAll('.template-card').length===30");
  const galleryScroll=await run("(()=>{const gallery=document.querySelector('.templates-view');gallery.scrollTop=320;return gallery.scrollTop;})()");
  await expectState("document.querySelector('.templates-view').scrollTop>100");
  await button('Abrir Mesa de servicio');
  await expectState("document.querySelector('.template-information h2')?.textContent==='Mesa de servicio'");
  await button('Volver a Templates');
  await expectState("document.activeElement?.getAttribute('aria-label')==='Abrir Mesa de servicio'");
  report.templateGalleryScrollRestored=await run(`Math.abs(document.querySelector('.templates-view').scrollTop-${galleryScroll})<=1`);
  await run("document.querySelector('.templates-view').scrollTop=0");
  await button('Nuevo template');
  await change('.template-editor input[required]','Template fixture');
  await change('.template-editor textarea[required]','Descripción fixture');
  await change('.template-prompt-input','Diseña {{nombre_proyecto}}');

  const openDialog=dialog.showOpenDialog;
  const badFile=join(profile,'template-bad.jpg');
  writeFileSync(badFile,'invalid jpg');
  const picture=join(__dirname,'renderer','hub-templates','portal-del-empleado.png');
  try {
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[badFile]});
    await button('Añadir imagen');
    await expectState("document.querySelector('.templates-view [role=alert]')?.textContent.includes('decodificar')");
    report.templateRejectsDamagedImage=true;
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[picture]});
    await button('Añadir imagen');
    await expectState("document.querySelector('.template-editor img')?.naturalWidth>0");
  } finally {dialog.showOpenDialog=openDialog;}

  await run("window.companion.island(true)");
  await expectState("!!document.querySelector('.notes-retained[hidden]')");
  await nav('notes');
  await expectState("document.querySelector('.template-editor input[required]')?.value==='Template fixture'");
  await expectState("document.querySelector('.template-editor img')?.naturalWidth>0");
  report.templateDraftSurvivesCollapse=true;
  await button('Guardar template');
  await expectState("document.querySelector('.template-information h2')?.textContent==='Template fixture'");
  await button('Editar');
  await change('.template-editor input[required]','Template revisado');
  await button('Guardar template');
  await expectState("document.querySelector('.template-information h2')?.textContent==='Template revisado'");
  await button('Duplicar');
  await expectState("document.querySelector('.template-information h2')?.textContent==='Template revisado (copia)'");
  await button('Eliminar');
  await expectState("!!document.querySelector('dialog[open][aria-label=\"Eliminar template\"]')");
  await button('Eliminar template');
  await expectState("document.querySelectorAll('.template-card').length===31");
  report.templateCrudAndCopyImage=await run(`(async()=>{
    const {value}=await window.companion.templates({type:'list'});
    return value.items.some(item=>item.name==='Template revisado'&&item.hasImage)&&
      !value.items.some(item=>item.name==='Template revisado (copia)');
  })()`);
  await nav('home');
  report.templatesDeniedOutsideHub=await run("window.companion.templates({type:'list'}).then(result=>!result.ok)");
  return report;
}
