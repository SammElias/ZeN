import React,{useLayoutEffect,useRef,useState} from 'react';
import {defaultAppearance,AppearanceOptions,glassOpacity,type AppearanceState} from '../shared/companion-appearance';
const themeNames = {monochrome:'Monocromo', dark:'Oscuro', light:'Claro'} as const;

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
export function AppearanceSettings({value,onPreview}:{value?:AppearanceState;onPreview:(v:AppearanceState|undefined)=>void}){
 const [draft,setDraft]=useState<AppearanceState>(value??defaultAppearance),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const active=useRef(false);
 useLayoutEffect(()=>{
  active.current=true;
  return ()=>{active.current=false;onPreview(undefined);};
 },[onPreview]);
 const change=(update:Partial<AppearanceState>)=>{const next={...draft,...update};setDraft(next);setSaved(false);setError('');onPreview(next);};
 const choose=async()=>{
  setBusy(true);
  setError('');
  try{
   const result=await window.companion.appearanceChoose();
   if(!active.current)return;
   if(!result.ok)setError(result.error);
   else if(result.value.imageUrl!==draft.imageUrl){
    change({background:'image',imageUrl:result.value.imageUrl,imageName:result.value.imageName});
   }
  }finally{if(active.current)setBusy(false);}
 };
 const save=async()=>{
  setBusy(true);
  setError('');
  try{
   const {theme,accent,background,opacity,blur}=draft;
   const result=await window.companion.appearanceSave(AppearanceOptions.parse({theme,accent,background,opacity,blur}));
   if(!active.current)return;
   if(result.ok){setDraft(result.value);onPreview(result.value);setSaved(true);}
   else setError(result.error);
  }finally{if(active.current)setBusy(false);}
 };
 const monochrome=draft.theme==='monochrome';
 const backgroundNames=monochrome?{aurora:'Niebla',dusk:'Grafito'}:{aurora:'Aurora',dusk:'Atardecer'};
 return <section className="appearance-settings companion-card" aria-label="Apariencia"><div className="appearance-heading"><h2>Apariencia</h2><div className="appearance-theme" role="group" aria-label="Tema">{(['monochrome','dark','light'] as const).map(theme=><button key={theme} aria-pressed={draft.theme===theme} onClick={()=>change({theme})}>{themeNames[theme]}</button>)}</div></div>
  <div className="appearance-preview" data-preset={draft.background}><div/><div/><div/><span>ZEN</span></div>
  {!monochrome&&<div className="appearance-row"><span>Acento</span><div className="appearance-accents" role="group" aria-label="Color de acento">{(['violet','amber','mint'] as const).map(accent=><button key={accent} data-accent={accent} title={{violet:'Violeta',amber:'Ámbar',mint:'Menta'}[accent]} aria-label={{violet:'Violeta',amber:'Ámbar',mint:'Menta'}[accent]} aria-pressed={draft.accent===accent} onClick={()=>change({accent})}/>)}</div></div>}
  <label className="appearance-slider"><span>Opacidad del cristal <output>{Math.round(draft.opacity*100)} %</output></span><input aria-label="Opacidad del cristal" type="range" min={glassOpacity.minimum*100} max={glassOpacity.maximum*100} value={Math.round(draft.opacity*100)} onChange={e=>change({opacity:Number(e.target.value)/100})}/></label>
  <label className="appearance-slider"><span>Desenfoque <output>{draft.blur} px</output></span><input aria-label="Desenfoque del cristal" type="range" min="0" max="40" value={draft.blur} onChange={e=>change({blur:Number(e.target.value)})}/></label>
  <div className="appearance-row appearance-background"><span>Fondo</span><div role="group" aria-label="Fondo">{(['aurora','dusk'] as const).map(background=><button key={background} data-preset={background} aria-pressed={draft.background===background} onClick={()=>change({background})}>{backgroundNames[background]}</button>)}<button disabled={busy} aria-pressed={draft.background==='image'} onClick={()=>draft.imageUrl?change({background:'image'}):void choose()}>Imagen</button></div></div>
  <div className="appearance-file"><button disabled={busy} onClick={()=>void choose()}>{draft.imageUrl?'Cambiar imagen':'Elegir imagen…'}</button>{draft.imageName&&<span title={draft.imageName}>{draft.imageName}</span>}</div>
  <div className="appearance-save"><button className="primary" disabled={busy} onClick={()=>void save()}>{busy?'Guardando…':saved?'Guardado':'Guardar apariencia'}</button><button disabled={busy} onClick={()=>change({...defaultAppearance})}>Restablecer</button></div>{error&&<p role="alert">{error}</p>}
 </section>;
}
