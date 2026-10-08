import React from 'react';
import type {Settings} from '../shared/contracts';
export function PetPreferences({value,change,locked}:{value:Settings;change:(value:Settings)=>void;locked:boolean}){return <fieldset disabled={locked}><legend>Compañero de escritorio</legend>
  <label className="check"><input type="checkbox" checked={value.showPetWhenFolded} onChange={e=>change({...value,showPetWhenFolded:e.target.checked})}/>Mostrar mascota al plegar (desactivado conserva la cápsula)</label>
  <label>Tamaño de la mascota<input type="range" min={72} max={128} step={8} value={value.petSize} onChange={e=>change({...value,petSize:+e.target.value})}/><span>{value.petSize} píxeles lógicos</span></label>
  <label>Movimiento<select value={value.petMotion} onChange={e=>change({...value,petMotion:e.target.value as Settings['petMotion']})}><option value="system">Según accesibilidad de Windows</option><option value="reduced">Reducido</option><option value="normal">Normal</option><option value="expressive">Expresivo</option></select></label>
  <label className="check"><input type="checkbox" checked={value.petBubbles} onChange={e=>change({...value,petBubbles:e.target.checked})}/>Burbujas de estado</label>
  <label className="check"><input type="checkbox" checked={value.petGreeting} onChange={e=>change({...value,petGreeting:e.target.checked})}/>Saludo diario al abrir voluntariamente</label>
  <label className="check"><input type="checkbox" checked={value.petSilent} onChange={e=>change({...value,petSilent:e.target.checked})}/>Modo silencioso de la mascota (sin saludos ni avisos decorativos)</label>
  <label className="check"><input type="checkbox" checked={value.petAlwaysOnTop} onChange={e=>change({...value,petAlwaysOnTop:e.target.checked})}/>Siempre visible</label>
  <label className="check"><input type="checkbox" checked={value.petDimFullscreen} onChange={e=>change({...value,petDimFullscreen:e.target.checked})}/>Atenuar sobre aplicaciones a pantalla completa</label>
  <label>Accesorio<select value={value.petAccessory} onChange={e=>change({...value,petAccessory:e.target.value as Settings['petAccessory']})}><option value="none">Sin accesorio</option><option value="bow">Pajarita menta</option></select></label>
  <label className="check"><input type="checkbox" checked={value.resumeSuggestion} onChange={e=>change({...value,resumeSuggestion:e.target.checked})}/>Sugerir retomar la última tarea al abrir</label>
  <button type="button" onClick={()=>change({...value,petSize:96,petMotion:'system',petAccessory:'none',petBubbles:true,petGreeting:true,petDimFullscreen:true})}>Restablecer apariencia</button>
  <p className="support">Clic para abrir Chat. Arrastra para mover. Botón derecho o Mayús+F10 para acciones. La mascota nunca activa el micrófono por sí sola.</p>
</fieldset>;}
