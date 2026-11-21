import React,{useLayoutEffect,useMemo,useRef,useState} from 'react';
import {defaultAppearance,AppearanceOptions,glassOpacity,type AppearanceState} from '../shared/companion-appearance';
import {CompanionIcon} from './CompanionActions';
import {PreferenceRow,PreferenceSave,PreferenceSwitch,type PreferenceFeedback} from './PreferencesControls';
import {ZenEmblem} from './ZenEmblem';
import {defaultNeon, neonPalettes, neonPaletteIds, neonSpeeds, neonSpeedIds, neonVisual, type NeonOptions} from '../shared/companion-neon';
import {NeonBorder} from './NeonBorder';
import {useNeonAnimation} from './useNeonAnimation';
const themeNames = {monochrome:'Monocromo', dark:'Oscuro', light:'Claro'} as const;
const accentNames={violet:'Violeta',amber:'Ámbar',mint:'Menta'} as const;

export function appearanceVars(value:AppearanceState){
 const image=value.background==='image'&&/^zen-theme:\/\/background\/[a-f0-9-]{36}$/.test(value.imageUrl??'')?`url("${value.imageUrl}")`:'none';
 if(value.theme==='monochrome')return{
  '--glass-opacity':value.opacity,'--glass-blur':value.blur+'px','--glass-rgb':'255 255 255',
  '--glass-text':'#18191a','--glass-secondary':'#383a3c','--glass-accent-rgb':'56 57 58',
  '--zen-wallpaper':image,
 } as React.CSSProperties;
 const light=value.theme==='light',colors={violet:'178 153 255',amber:'255 177 101',mint:'108 220 193'};
 return{'--glass-opacity':value.opacity,'--glass-blur':value.blur+'px','--glass-rgb':light?'244 246 253':'18 20 31','--glass-text':light?'#202334':'#f8f9ff','--glass-secondary':light?'#39445a':'#cbd2e4','--glass-accent-rgb':colors[value.accent],'--zen-wallpaper':image} as React.CSSProperties;
}
function sameOption(key: keyof AppearanceOptions, a: AppearanceOptions, b: AppearanceOptions) {
 return key==='neon'?JSON.stringify(a.neon??defaultNeon)===JSON.stringify(b.neon??defaultNeon):a[key]===b[key];
}

export function AppearanceSettings({value,visible,motion,reset,onPreview}:{value:AppearanceState;visible:boolean;motion:boolean;reset:number;onPreview:(v:AppearanceState|undefined)=>void}) {
 const [changes,setChanges]=useState<Partial<AppearanceOptions>>({});
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState<PreferenceFeedback>();
 const previousReset=useRef(reset);
 const draft=useMemo(()=>({...value,...changes}),[value,changes]);
 const dirty=(Object.keys(changes) as (keyof AppearanceOptions)[]).some(key=>!sameOption(key,draft,value));
 const neon=draft.neon??defaultNeon;
 const neonAnimation=useNeonAnimation(neon,visible,motion);

 useLayoutEffect(()=>{
  if(previousReset.current===reset)return;
  previousReset.current=reset;
  stage({...defaultAppearance,neon:defaultNeon});
 },[reset]);
 useLayoutEffect(()=>{
  onPreview(visible&&dirty?draft:undefined);
  return ()=>onPreview(undefined);
 },[visible,dirty,draft,onPreview]);

 function stage(update:Partial<AppearanceOptions>) {
  setChanges(previous=>{
   const next={...previous,...update};
   const nextDraft={...value,...next};
   for(const key of Object.keys(next) as (keyof AppearanceOptions)[]){if(sameOption(key,nextDraft,value))delete next[key];}
   return next;
  });
  setFeedback(undefined);
 }

 function stageNeon(update:Partial<NeonOptions>) {
  stage({neon:{...neon,...update}});
 }

 async function choose() {
  setBusy(true);
  setFeedback(undefined);
  try{
   const result=await window.companion.appearanceChoose();
   if(!result.ok){setFeedback({text:result.error,error:true});return;}
   if(result.value.imageUrl!==value.imageUrl){
    setChanges(({background,...rest})=>rest);
    setFeedback({text:'Imagen de fondo aplicada.'});
   }
  }catch{setFeedback({text:'No se pudo cambiar la imagen.',error:true});}
  finally{setBusy(false);}
 }

 async function save() {
  setBusy(true);
  setFeedback(undefined);
  try{
   const {theme,accent,background,opacity,blur,neon}=draft;
   const result=await window.companion.appearanceSave(AppearanceOptions.parse({theme,accent,background,opacity,blur,neon}));
   if(!result.ok){setFeedback({text:result.error,error:true});return;}
   setChanges({});
   setFeedback({text:'Apariencia guardada.'});
  }catch{setFeedback({text:'No se pudo guardar la apariencia.',error:true});}
  finally{setBusy(false);}
 }

 const monochrome=draft.theme==='monochrome';
 const backgroundNames=monochrome?{aurora:'Niebla',dusk:'Grafito',image:'Imagen'}:{aurora:'Aurora',dusk:'Atardecer',image:'Imagen'};
 return <div className="appearance-settings">
  <div className="appearance-preview" data-preset={draft.background} role="img" aria-label="Vista previa de la cápsula con los ajustes actuales">
   <div className="appearance-preview-capsule" aria-hidden="true">
    <ZenEmblem/><span>ZEN</span><i/><CompanionIcon name="code"/><CompanionIcon name="sound"/><CompanionIcon name="notebook"/>
    <NeonBorder options={neon} shape={{radius:15}} visible={visible} animation={neonAnimation}/>
   </div>
  </div>
  <fieldset disabled={busy} className="preference-fieldset">
   <h3>Estilo</h3>
   <PreferenceRow title="Tema">
    <div className="appearance-theme preference-choices" role="group" aria-label="Tema">
     {(['monochrome','dark','light'] as const).map(theme=><button key={theme} type="button" data-preview-theme={theme} aria-pressed={draft.theme===theme} onClick={()=>stage({theme})}>
      <span className="theme-miniature" aria-hidden="true"><i/><i/><i/></span>{themeNames[theme]}
      {draft.theme===theme&&<CompanionIcon name="check"/>}
     </button>)}
    </div>
   </PreferenceRow>
   {!monochrome&&<PreferenceRow title="Acento">
    <div className="appearance-accents" role="group" aria-label="Color de acento">
     {(['violet','amber','mint'] as const).map(accent=><button key={accent} type="button" data-accent={accent} title={accentNames[accent]} aria-label={accentNames[accent]} aria-pressed={draft.accent===accent} onClick={()=>stage({accent})}>
      {draft.accent===accent&&<CompanionIcon name="check"/>}
     </button>)}
    </div>
   </PreferenceRow>}
   <h3>Fondo y cristal</h3>
   <PreferenceRow title="Fondo">
    <div className="appearance-background preference-choices" role="group" aria-label="Fondo">
     {(['aurora','dusk','image'] as const).map(background=><button key={background} type="button" data-preset={background} aria-pressed={draft.background===background}
      onClick={()=>background==='image'&&!draft.imageUrl?void choose():stage({background})}>
      <span className="background-miniature" aria-hidden="true">{background==='image'&&!draft.imageUrl&&<CompanionIcon name="plus"/>}</span>
      {backgroundNames[background]}{draft.background===background&&<CompanionIcon name="check"/>}
     </button>)}
    </div>
   </PreferenceRow>
   <PreferenceRow title="Imagen personalizada" description="Se aplica al elegirla. Usa un fondo predefinido para retirarla de la vista.">
    <div className="preference-actions appearance-file">
     <button type="button" onClick={()=>void choose()}>{draft.imageUrl?'Cambiar imagen':'Elegir imagen…'}</button>
     {draft.background==='image'&&<button type="button" onClick={()=>stage({background:'aurora'})}>Quitar de la vista</button>}
    </div>
   </PreferenceRow>
   <PreferenceRow title="Opacidad del cristal" controlId="preference-opacity" description="Elige cuánto se tiñe el fondo. Al 0 % desaparece el tinte del cristal.">
    <div className="preference-range"><input id="preference-opacity" aria-label="Opacidad del cristal" aria-valuetext={`${Math.round(draft.opacity*100)} %`} type="range" min={glassOpacity.minimum*100} max={glassOpacity.maximum*100} value={Math.round(draft.opacity*100)} onChange={e=>stage({opacity:e.currentTarget.valueAsNumber/100})}/><output htmlFor="preference-opacity">{Math.round(draft.opacity*100)} %</output></div>
   </PreferenceRow>
   <PreferenceRow title="Desenfoque" controlId="preference-blur" description="Suaviza el fondo interno bajo las superficies de cristal.">
    <div className="preference-range"><input id="preference-blur" aria-label="Desenfoque del cristal" aria-valuetext={`${draft.blur} px`} type="range" min={0} max={40} value={draft.blur} onChange={e=>stage({blur:e.currentTarget.valueAsNumber})}/><output htmlFor="preference-blur">{draft.blur} px</output></div>
   </PreferenceRow>
   <h3>Borde luminoso</h3>
   <PreferenceSwitch title="Activar borde luminoso" checked={neon.enabled} onChange={enabled=>stageNeon({enabled})}/>
   <PreferenceRow title="Color del borde">
    <div className="preference-choices neon-palette" role="group" aria-label="Color del borde">
     {neonPaletteIds.map(palette=><button key={palette} type="button" data-neon-palette={palette}
       disabled={!neon.enabled} aria-pressed={neon.palette===palette} onClick={()=>stageNeon({palette})}>
      <span className="neon-palette-swatch" aria-hidden="true" style={{'--neon-swatch':neonPalettes[palette].color} as React.CSSProperties}/>
      {neonPalettes[palette].label}{neon.palette===palette&&<CompanionIcon name="check"/>}
     </button>)}
    </div>
   </PreferenceRow>
   <PreferenceSwitch title="Animar el borde" checked={neon.animated} disabled={!neon.enabled} onChange={animated=>stageNeon({animated})}/>
   <PreferenceRow title="Intensidad del borde" controlId="neon-intensity">
    <div className="preference-range"><input id="neon-intensity" type="range" min={neonVisual.minimumIntensity} max={100} value={neon.intensity}
      aria-valuetext={`${neon.intensity} %`} disabled={!neon.enabled} onChange={e=>stageNeon({intensity:e.currentTarget.valueAsNumber})}/>
     <output htmlFor="neon-intensity">{neon.intensity} %</output></div>
   </PreferenceRow>
   <PreferenceRow title="Velocidad del borde" controlId="neon-speed">
    <select id="neon-speed" value={neon.speed} disabled={!neon.enabled||!neon.animated} onChange={e=>stageNeon({speed:e.currentTarget.value as NeonOptions['speed']})}>
     {neonSpeedIds.map(speed=><option key={speed} value={speed}>{neonSpeeds[speed].label}</option>)}
    </select>
   </PreferenceRow>
   <PreferenceRow title="Extensión de los extremos" controlId="neon-extension" description="Ajusta el remate en los bordes acoplados.">
    <div className="preference-range"><input id="neon-extension" type="range" min={0} max={neonVisual.maximumExtension} value={neon.extension}
      aria-valuetext={`${neon.extension} px`} disabled={!neon.enabled} onChange={e=>stageNeon({extension:e.currentTarget.valueAsNumber})}/>
     <output htmlFor="neon-extension">{neon.extension} px</output></div>
   </PreferenceRow>
  </fieldset>
  <div className="appearance-save"><PreferenceSave name="Guardar apariencia" dirty={dirty} busy={busy} feedback={feedback} onSave={()=>void save()}
   onDiscard={()=>{setChanges({});setFeedback(undefined);}}/></div>
 </div>;
}
