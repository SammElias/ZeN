import React, {useState} from 'react';
import {PreferenceRow} from './PreferencesControls';

export function BackupSettings({disabled,onImported}:{disabled:boolean;onImported:()=>void}) {
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState<{text:string;error?:boolean}>();

  async function run(action:'export'|'import') {
    setBusy(true);
    setFeedback(undefined);
    try {
      const result=await window.companion.profileBackup(action);
      if(!result.ok){setFeedback({text:result.error,error:true});return;}
      if(result.value==='exported')setFeedback({text:'Copia guardada. Puedes importarla en otro equipo.'});
      if(result.value==='imported'){
        onImported();
        setFeedback({text:'Copia importada. La copia anterior está en la carpeta backups del perfil de ZEN.'});
      }
    }catch {
      setFeedback({text:'No se pudo completar el respaldo.',error:true});
    }finally{
      setBusy(false);
    }
  }

  return <section className="settings-backup" aria-labelledby="profile-backup-title">
    <h3 id="profile-backup-title">Copias de seguridad</h3>
    <PreferenceRow title="Exportar" description="Guarda tu biblioteca, los atajos, la apariencia y el fondo en un archivo portable.">
      <button type="button" data-backup="export" disabled={busy||disabled} onClick={()=>void run('export')}>Exportar copia</button>
    </PreferenceRow>
    <PreferenceRow title="Importar" description="Sustituye esos datos con una copia de ZEN. Tras confirmar, ZEN guarda una copia de recuperación.">
      <button type="button" data-backup="import" disabled={busy||disabled} onClick={()=>void run('import')}>Importar copia</button>
    </PreferenceRow>
    {disabled?<p>Desactiva Pausa o Presentación para gestionar copias.</p>
      :feedback&&<p role={feedback.error?'alert':'status'}>{feedback.text}</p>}
  </section>;
}
