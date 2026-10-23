import React from 'react';
import type {Settings} from '../shared/contracts';
import {wardrobes,wardrobeLabels} from '../shared/mascot';
export function PetPreferences({value,change,locked}:{value:Settings;change:(value:Settings)=>void;locked:boolean}){return <fieldset disabled={locked}><legend>Personaje de la cápsula</legend>
  <label>Movimiento<select value={value.petMotion} onChange={e=>change({...value,petMotion:e.target.value as Settings['petMotion']})}><option value="system">Según accesibilidad de Windows</option><option value="reduced">Reducido</option><option value="normal">Normal</option><option value="expressive">Expresivo</option></select></label>
  <label className="check"><input type="checkbox" checked={value.petGreeting} onChange={e=>change({...value,petGreeting:e.target.checked})}/>Saludo diario al abrir voluntariamente</label>
  <label className="check"><input type="checkbox" checked={value.petSilent} onChange={e=>change({...value,petSilent:e.target.checked})}/>Modo silencioso de la mascota (sin saludos ni avisos decorativos)</label>
  <label>Vestuario<select value={value.mascotWardrobe} onChange={e=>change({...value,mascotWardrobe:e.target.value as Settings['mascotWardrobe']})}><option value="auto">Automático</option>{wardrobes.map(w=><option key={w} value={w}>Fijar conjunto · {wardrobeLabels[w]}</option>)}</select></label>
  <label className="check"><input type="checkbox" checked={value.resumeSuggestion} onChange={e=>change({...value,resumeSuggestion:e.target.checked})}/>Sugerir retomar la última tarea al abrir</label>
  <button type="button" onClick={()=>change({...value,petSize:96,petMotion:'system',petAccessory:'none',mascotWardrobe:'auto',mascotWalks:true,petBubbles:true,petGreeting:true,petDimFullscreen:true})}>Restablecer apariencia</button>
  <p className="support">El personaje permanece en la cápsula. Clic para abrir Inicio; botón derecho o Mayús+F10 para Apariencia. Los controles de Chat, captura y voz están siempre a mano.</p>
</fieldset>;}