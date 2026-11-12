import React, {useState} from 'react';

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

  return <section className="companion-card settings-backup" aria-labelledby="profile-backup-title">
    <h2 id="profile-backup-title">Datos y configuración</h2>
    <p>Transfiere tu biblioteca, tus atajos, la apariencia y el fondo a otro equipo.</p>
    <div className="actions">
      <button type="button" disabled={busy||disabled} onClick={()=>void run('export')}>Exportar copia</button>
      <button type="button" disabled={busy||disabled} onClick={()=>void run('import')}>Importar copia</button>
    </div>
    {disabled?<p>Desactiva Pausa o Presentación para gestionar copias.</p>
      :feedback&&<p role={feedback.error?'alert':'status'}>{feedback.text}</p>}
  </section>;
}
