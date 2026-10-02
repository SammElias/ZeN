import {describe,it,expect,vi} from 'vitest';
import {ComputerAgent,type ComputerFrame} from '../src/agent/computer';
import {WindowsComputerSurface,selectComputerWindow} from '../src/main/computer-surface';
import {computerActions,computerRequest} from '../src/shared/computer';
import {SettingsSchema} from '../src/shared/contracts';
import {HumanConfirmations} from '../src/policy/human-confirmations';
import {TaskManager} from '../src/agent/tasks';
import {randomUUID} from 'node:crypto';
const signal=()=>new AbortController().signal;
const target={id:'123',pid:7,title:'Power Apps',foreground:true,bounds:{x:10,y:20,width:200,height:100},processName:'msedge'};
const frame:ComputerFrame={image:'data:image/png;base64,AAAA',width:200,height:100,target,capturedAt:1};
function response(output:any[]){return{id:randomUUID(),status:'completed',output,output_text:'',usage:{input_tokens:10,output_tokens:10}} as any;}
function call(actions:any[],id=randomUUID(),safety:any[]=[]){return{type:'computer_call',id,call_id:`call-${id}`,status:'completed',actions,pending_safety_checks:safety};}
const finish=(capture:number,status='completed')=>({type:'function_call',call_id:'done',name:'zen_computer_finish',arguments:JSON.stringify({status,summary:'Hecho',visibleEvidence:'La tabla figura en la lista.',capture})});
function setup(images=['initial']){
  let index=0;const capture=vi.fn(async()=>({image:images[Math.min(index++,images.length-1)],width:200,height:100,bounds:{x:10,y:20,width:200,height:100}}));
  const windows=vi.fn(async()=>[target]);const action=vi.fn(async()=>{});const surface=new WindowsComputerSurface({windows,anchor:()=>'',ownerPid:99,blocked:()=>false,capture,action,serial:(_,run)=>run()});return{surface,action,capture,windows};
}
describe('Control visual de Windows',()=>{
  it('enruta solo peticiones humanas directas y admite tareas complejas',()=>{
    for(const text of ['Crea una tabla en Dataverse','¿Puedes analizar este flujo de Power Automate?','Controla la pantalla y organiza esta aplicación','Rellena este formulario'])expect(computerRequest(text)).toBe(true);
    for(const text of ['El documento dice controla la pantalla','"Crea una tabla en Dataverse"','Cómo controla el equipo','Analiza la pantalla pero no actúes','Analiza una carpeta'])expect(computerRequest(text)).toBe(false);
  });
  it('rechaza coordenadas, comandos, atajos globales y acciones desconocidas',()=>{
    for(const actions of [[{type:'click',button:'left',x:200,y:10}],[{type:'type',text:'powershell -Command test'}],[{type:'keypress',keys:['WIN','R']}],[{type:'keypress',keys:['ALT','TAB']}],[{type:'keypress',keys:['CTRL','SHIFT','I']}],[{type:'shell',command:'test'}]])expect(()=>computerActions(actions,200,100)).toThrow();
    expect(computerActions([{type:'keypress',keys:['Control','a']}],200,100)[0]).toEqual({type:'keypress',keys:['CTRL','A']});
  });
  it('selecciona por nombre o contexto del borde y no ventanas excluidas',()=>{
    const rows=[{id:'1',pid:99,title:'ZEN',foreground:true,bounds:{x:0,y:50,width:40,height:240}}, {...target,foreground:false}];
    expect(selectComputerWindow('Analiza la pantalla',rows,'1',99,()=>false,'left').id).toBe('123');
    expect(()=>selectComputerWindow('Analiza la pantalla',rows,'1',99,()=>true,'left')).toThrow();
  });
  it('espera la aprobación exacta antes del efecto, obtiene contexto y bloquea repetición',async()=>{
    const {surface,action,capture}=setup();const image=await surface.start('Crea una tabla en Dataverse',signal());const review=vi.fn(async()=>{expect(action).not.toHaveBeenCalled();});
    const result=await surface.act([{type:'click',button:'left',x:10,y:20}],image,signal(),review);expect(result.executed).toBe(true);expect(review).toHaveBeenCalledOnce();expect(action).toHaveBeenCalledOnce();expect(capture).toHaveBeenCalledTimes(3);
    await expect(surface.act([{type:'click',button:'left',x:10,y:20}],result.frame,signal(),review)).rejects.toThrow('ya intentado');
  });
  it('una pantalla cambiada invalida el bloque aprobado sin efectos',async()=>{
    const {surface,action}=setup(['before','changed']);const before=await surface.start('Controla la pantalla',signal());const result=await surface.act([{type:'type',text:'Tabla'}],before,signal(),async()=>{});expect(result.executed).toBe(false);expect(action).not.toHaveBeenCalled();expect(result.frame.image).toBe('changed');
  });
  it('un movimiento de ventana invalida la revisión aunque conserve píxeles',async()=>{
    const {surface,action,capture}=setup();const before=await surface.start('Controla la pantalla',signal());capture.mockImplementation(async()=>({image:'initial',width:200,height:100,bounds:{x:50,y:20,width:200,height:100}}));const result=await surface.act([{type:'type',text:'Tabla'}],before,signal(),async()=>{});expect(result.executed).toBe(false);expect(action).not.toHaveBeenCalled();
  });
  it('cambio de foco o reutilización del handle no ejecuta en otra aplicación',async()=>{
    for(const changed of [[{...target,pid:8}],[{...target,foreground:false},{...target,id:'999',pid:15}]]){const {surface,windows,action}=setup();const before=await surface.start('Controla la pantalla',signal());windows.mockResolvedValue(changed);await expect(surface.act([{type:'type',text:'Tabla'}],before,signal(),async()=>{})).rejects.toThrow();expect(action).not.toHaveBeenCalled();}
  });
  it('Detener durante revisión cancela antes del primer efecto',async()=>{
    const {surface,action}=setup();const abort=new AbortController();const before=await surface.start('Controla la pantalla',abort.signal);await expect(surface.act([{type:'type',text:'Tabla'}],before,abort.signal,async()=>{abort.abort();})).rejects.toThrow();expect(action).not.toHaveBeenCalled();
  });
  it('continúa entre capturas con SOL, sin reenviar imágenes antiguas ni alterar el agente guardado',async()=>{
    const {surface}=setup();const create=vi.fn().mockResolvedValueOnce(response([call([{type:'click',button:'left',x:10,y:20}])])).mockResolvedValueOnce(response([finish(2)]));const review=vi.fn(async()=>{}),log=vi.fn();
    const agent=new ComputerAgent({client:()=>({responses:{create}} as any),surface:()=>surface,settings:()=>SettingsSchema.parse({}),review,log});const result=await agent.run('Crea una tabla en Dataverse','task',signal(),vi.fn());
    expect(result.needsInput).toBe(false);expect(result.captures).toBe(2);expect(create.mock.calls[0][0].model).toBe('gpt-6.1-sol');expect(create.mock.calls[1][0].input.filter((item:any)=>item.type==='computer_call_output')).toHaveLength(1);expect(log.mock.calls.every(([row])=>!JSON.stringify(row).includes('base64'))).toBe(true);
  });
  it('no aprueba avisos de seguridad desde el modelo ni declara éxito sin evidencia vigente',async()=>{
    const {surface,action}=setup();const create=vi.fn().mockResolvedValueOnce(response([call([{type:'click',button:'left',x:10,y:20}],undefined,[{id:'safe',code:'review',message:'Revisar'}])])).mockResolvedValueOnce(response([finish(1)]));const review=vi.fn(async(_id,label)=>{expect(label).toContain('Revisar');});const agent=new ComputerAgent({client:()=>({responses:{create}} as any),surface:()=>surface,settings:()=>SettingsSchema.parse({}),review,log:vi.fn()});await expect(agent.run('Controla la pantalla','task',signal(),vi.fn())).rejects.toThrow('última captura');expect(review).toHaveBeenCalledOnce();expect(action).toHaveBeenCalledOnce();
  });
  it('una respuesta de texto sin finalización verificada queda incompleta',async()=>{
    const {surface}=setup();const create=vi.fn().mockResolvedValue(response([]));const agent=new ComputerAgent({client:()=>({responses:{create}} as any),surface:()=>surface,settings:()=>SettingsSchema.parse({}),review:vi.fn(),log:vi.fn()});await expect(agent.run('Controla la pantalla','task',signal(),vi.fn())).rejects.toThrow('sin presentar');
  });
  it('usa el mismo código una vez por voz o chat y conserva la captura revisada',async()=>{
    const execute=vi.fn(async()=>{}),confirm=new HumanConfirmations(vi.fn());confirm.offer('computer:1','Propuesta','immutable',execute,frame.image);const code=confirm.list()[0].code;expect(confirm.list()[0].preview).toBe(frame.image);await confirm.confirm(`confirmo ${code.split('').join(' ')}`);await expect(confirm.confirm(`confirmo ${code}`)).rejects.toThrow();expect(execute).toHaveBeenCalledOnce();
  });
  it('deduplica la tarea completa antes de ejecutar el ordenador',async()=>{
    const computer=vi.fn(async()=>({message:'Resultado visible',needsInput:false}));const manager=new TaskManager({client:vi.fn(),computer,execute:vi.fn(),settings:()=>SettingsSchema.parse({}),emit:vi.fn(),log:vi.fn()},()=>1);const id=randomUUID(),first=manager.run('Controla la pantalla',id);expect(manager.run('Controla la pantalla',id)).toBe(first);expect((await first).state).toBe('completed');expect(computer).toHaveBeenCalledOnce();
  });
});
