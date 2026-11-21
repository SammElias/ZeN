import {_electron as electron} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';

if(process.platform!=='win32')throw Error('Windows required');
const evidence=resolve('release/vault-acceptance');await mkdir(evidence,{recursive:true});
execFileSync('dotnet',['publish','scripts/fixtures/vault-windows/VaultProbe.csproj','-c','Release','-o',join(evidence,'probe'),'--nologo','-p:DebugType=None'],{windowsHide:true,stdio:'pipe'});
const probe=spawn(join(evidence,'probe/VaultProbe.exe'),[],{windowsHide:true,stdio:['pipe','pipe','ignore']});
const pending=[];createInterface({input:probe.stdout}).on('line',line=>pending.shift()?.(JSON.parse(line)));
await new Promise(resolve=>pending.push(resolve));
const rpc=request=>new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('Clipboard probe timed out')),6000);
 pending.push(value=>{clearTimeout(timeout);if(value.error)reject(Error('Clipboard probe failed'));else resolve(value);});probe.stdin.write(JSON.stringify(request)+'\n');
});
const report={at:new Date().toISOString(),scope:'Automated Electron UI and real Windows clipboard, isolated synthetic profiles',physicalInputTested:false};
const check=(name,value)=>{report[name]=value;if(!value)throw Error(name);console.log(name+': OK');};
let app,page,profile;
const master='ZEN acceptance master ficticia 2026!',secret='ZEN-ficticia-oculta-2026!',other='Texto posterior ficticio de aceptación';
const launch=async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;
 app=await electron.launch({...(process.argv[2]?{executablePath:resolve(process.argv[2])}:{}),args:[...(!process.argv[2]?['.']:[]),'--zen-hover-smoke'],env});
 page=await app.firstWindow();await page.waitForSelector('.zen-island-trigger:enabled');
 profile=await app.evaluate(({app})=>app.getPath('userData'));
 await page.evaluate(()=>window.companion.navigate('settings'));
 await page.evaluate(async()=>{const result=await window.companion.status();if(result.ok)await window.companion.save({...result.value.settings,windowLocked:true,motion:false});});
 await page.evaluate(()=>window.companion.pinWindow(true));
 await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.show();window.focus();window.webContents.setBackgroundThrottling(false);});
};
const focus=()=>app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.show();window.focus();});
const open=async()=>{
 await focus();await page.evaluate(()=>window.companion.navigate('notes'));
 await page.locator('.hub-sidebar').getByRole('button',{name:'Contraseñas',exact:true}).click();
 await page.locator('.vault-unlock button[type=submit]').waitFor();
 await page.locator('.vault-unlock input:not(:disabled)').first().waitFor();
};
const unlock=async(value=master)=>{
 await focus();await page.getByLabel('Contraseña maestra',{exact:true}).fill(value);
 await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
 if(value===master)await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).waitFor();
};
const masked=()=>page.locator('.vault-secret').evaluateAll(nodes=>nodes.every(node=>node.textContent==='••••••••'));
try {
 await launch();await open();
 check('initialWarning',await page.getByText('La contraseña maestra será necesaria',{exact:false}).isVisible());
 await page.getByLabel('Contraseña maestra',{exact:true}).fill(master);
 await page.getByLabel('Confirmar contraseña maestra',{exact:true}).fill(master);
 await page.getByRole('button',{name:'Crear bóveda',exact:true}).click();
 await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
 await page.getByLabel('Nombre del proyecto',{exact:true}).fill('Proyecto de aceptación');
 await page.getByRole('button',{name:'Guardar proyecto',exact:true}).click();
 for(const user of ['uno@ficticio.invalid','dos@ficticio.invalid']){
  await page.getByRole('button',{name:'Añadir cuenta',exact:true}).click();
  await page.getByLabel('Servicio',{exact:true}).fill('Servicio duplicado');
  await page.getByLabel('Correo o usuario',{exact:true}).fill(user);
  await page.getByLabel('Nueva contraseña',{exact:true}).fill(secret);
  await page.getByRole('button',{name:'Guardar cuenta',exact:true}).click();
  await page.locator('.vault-form').waitFor({state:'detached'});
 }
 check('duplicateService',await page.locator('.vault-account').count()===2);check('fixedMask',await masked());
 const first=page.locator('.vault-account').first(),second=page.locator('.vault-account').nth(1);
 await first.getByRole('button',{name:/Mostrar contraseña/}).click();
 await page.waitForFunction(()=>document.querySelector('.vault-secret')?.textContent!=='••••••••');
 const revealedAt=Date.now();
 await second.getByRole('button',{name:/Mostrar contraseña/}).click();
 check('onlyOneRevealed',await page.locator('.vault-secret').evaluateAll(nodes=>nodes.filter(n=>n.textContent!=='••••••••').length)===1);
 await page.waitForFunction(()=>[...document.querySelectorAll('.vault-secret')].every(n=>n.textContent==='••••••••'),{},{timeout:11000});
 check('tenSecondLimit',Date.now()-revealedAt<=10700);
 await first.getByRole('button',{name:/Mostrar contraseña/}).click();await page.getByRole('button',{name:'Ocultar contraseña',exact:true}).waitFor();
 await rpc({type:'paste',expected:''});await page.waitForFunction(()=>[...document.querySelectorAll('.vault-secret')].every(n=>n.textContent==='••••••••'));
 check('concealOnRealBlur',await masked());
 await focus();await first.getByRole('button',{name:/Mostrar contraseña/}).click();
 await page.getByRole('button',{name:'Ocultar contraseña',exact:true}).click();check('secondEyeClickHides',await masked());
 await focus();await first.getByRole('button',{name:/Copiar contraseña/}).click();await page.getByText('Contraseña copiada',{exact:true}).waitFor();
 const copiedAt=Date.now();const flags=await rpc({type:'flags'});check('windowsExclusionFlags',flags.excluded&&flags.history&&flags.cloud);
 await page.evaluate(()=>window.companion.island(true));
 check('pasteAfterCollapse',(await rpc({type:'paste',expected:secret})).pasted);
 await new Promise(resolve=>setTimeout(resolve,800));
 report.windowsHistory=await rpc({type:'history',expected:secret});check('absentFromWindowsHistory',!report.windowsHistory.found);
 await rpc({type:'copyOther',expected:other});
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,31500-(Date.now()-copiedAt))));
 check('preservesLaterClipboard',(await rpc({type:'read',expected:other})).matches);
 await focus();await page.evaluate(()=>window.companion.navigate('notes'));
 await page.getByRole('button',{name:'Desbloquear',exact:true}).waitFor();check('lockedAfterCollapse',!await page.locator('.vault-account').count());
 const file=join(profile,'passwords.kdbx'),before=await readFile(file);await unlock('maestra errónea');
 await page.getByText('No se pudo abrir la bóveda.',{exact:false}).waitFor();
 check('wrongMasterPreservesFile',before.equals(await readFile(file)));check('wrongMasterHidesMetadata',!await page.locator('.vault-account').count());
 await unlock();await page.getByLabel('Buscar en Contraseñas').fill('dos@');check('localSearch',await page.locator('.vault-account').count()===1);
 await page.getByLabel('Buscar en Contraseñas').fill('');
 await first.getByRole('button',{name:/Mostrar contraseña/}).click();await page.getByRole('button',{name:'Ocultar contraseña',exact:true}).waitFor();
 await page.getByRole('button',{name:'Biblioteca de prompts',exact:true}).click();await open();
 check('lockedAfterHubNavigation',await page.getByRole('button',{name:'Desbloquear',exact:true}).isVisible());
 await unlock();
 // Edit metadata without receiving the original secret in the form.
 await first.locator('summary').click();await first.getByRole('button',{name:'Editar',exact:true}).click();
 check('editPreservesFixedMask',await page.locator('.vault-preserved').innerText().then(text=>text.includes('••••••••')&&!text.includes(secret)));
 await page.getByLabel('Servicio',{exact:true}).fill('Servicio editado');await page.getByRole('button',{name:'Guardar cuenta',exact:true}).click();
 await page.locator('.vault-form').waitFor({state:'detached'});check('editedAccount',await first.locator('.vault-identity').innerText().then(text=>text.includes('Servicio editado')));
 await app.evaluate(({powerMonitor})=>powerMonitor.emit('lock-screen'));
 await page.getByRole('button',{name:'Desbloquear',exact:true}).waitFor();check('lockScreenEvent',!await page.locator('.vault-account').count());
 await unlock();
 await first.getByRole('button',{name:/Copiar contraseña/}).click();await page.getByText('Contraseña copiada',{exact:true}).waitFor();
 const expiresAt=Date.now()+31500;
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,expiresAt-Date.now())));
 check('clearsOwnClipboard',(await rpc({type:'read',expected:''})).matches);
 await page.screenshot({path:join(evidence,'passwords.png')});
 const ciphertext=await readFile(file);await app.close();app=undefined;
 await launch();await copyFile(file,join(profile,'passwords.kdbx'));await open();
 check('restartLocked',await page.getByRole('button',{name:'Desbloquear',exact:true}).isVisible()&&!await page.locator('.vault-account').count());
 await unlock();check('restartRecoversTwoAccounts',await page.locator('.vault-account').count()===2);
 const projectMenu=page.locator('.vault-project>header details');await projectMenu.locator('summary').click();
 await projectMenu.getByRole('button',{name:'Eliminar proyecto',exact:true}).click();
 check('projectDeleteCountsAccounts',await page.getByRole('alertdialog').innerText().then(text=>text.includes('2 cuentas')));
 await page.getByRole('alertdialog').getByRole('button',{name:'Cancelar',exact:true}).click();
 check('cancelDeletePreservesAccounts',await page.locator('.vault-account').count()===2);
 check('diskContainsNoPlaintext',[master,secret,'Servicio duplicado','Proyecto de aceptación','ficticio.invalid'].every(value=>!ciphertext.includes(Buffer.from(value))));
 report.ciphertextSha256=createHash('sha256').update(ciphertext).digest('hex');report.passed=true;
}catch(error){
 if(page&&!page.isClosed()){
  report.failureView=await page.locator('.password-vault').innerText().catch(()=>'view hidden');
  await page.screenshot({path:join(evidence,'failure.png')}).catch(()=>{});
 }
 throw error;
}finally {
 if(app)await app.close();probe.stdin.write('{"type":"quit"}\n');
 await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report));
