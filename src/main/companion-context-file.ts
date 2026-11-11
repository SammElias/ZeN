import {createHash} from 'node:crypto';
import {open,lstat,realpath} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {projectFile} from './companion-project-path';
/** Bounded read of exactly one user-picked regular file, with identity/version checks. */
export async function contextFile(path:string){
 try{
  const selected=resolve(path),resolved=await realpath(selected),stat=await lstat(selected);
  if(stat.isSymbolicLink()||resolved.toLowerCase()!==selected.toLowerCase()||!stat.isFile()||stat.size>32*1024*1024)throw Error();
  const file=await open(resolved,'r');
  try{const before=await file.stat();if(!before.isFile()||before.size!==stat.size||before.dev!==stat.dev||before.ino!==stat.ino)throw Error();
   const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let total=0;
   for(;;){const {bytesRead}=await file.read(buffer,0,buffer.length,null);if(!bytesRead)break;total+=bytesRead;if(total>32*1024*1024)throw Error();hash.update(buffer.subarray(0,bytesRead));}
   const after=await file.stat(),current=await lstat(selected);
   if(total!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs||current.isSymbolicLink()||current.ino!==before.ino||current.dev!==before.dev||current.mtimeMs!==before.mtimeMs)throw Error();
   return{path:resolved,name:basename(resolved),signature:hash.digest('hex')};
  }finally{await file.close();}
 }catch{throw Error('No se puede verificar el archivo. Elige un archivo local de hasta 32 MB que no esté cambiando.');}
}

export async function contextSourceLine(root: string, path: string, line: number) {
 const name = path.replace(/\\/g, '/');
 if (name.split('/').some(segment => !segment || segment === '.' || segment === '..') || /[:\x00-\x1f]/.test(name)) {
  throw Error('La referencia debe señalar un archivo dentro del proyecto.');
 }
 const base = await realpath(root);
 const tracked = await new Promise<string>((accept, reject) => execFile(
  'git', ['--no-optional-locks', '--literal-pathspecs', 'ls-files', '--cached', '-z', '--', name],
  {cwd: base, windowsHide: true, timeout: 2500, maxBuffer: 8192, encoding: 'utf8'},
  (error, output) => error ? reject(error) : accept(output),
 ));
 if (!tracked.split('\0').includes(name)) throw Error('La referencia no está en los archivos versionados de este proyecto.');
 const {file} = await projectFile(base, name);
 const expected = await lstat(file);
 const limit = 512 * 1024;
 if (!expected.isFile() || expected.size > limit) throw Error('La referencia supera el tamaño de lectura de ZEN.');
 const reader = await open(file, 'r');
 try {
  const before = await reader.stat();
  if (!before.isFile() || before.dev !== expected.dev || before.ino !== expected.ino || before.size !== expected.size) throw Error('El archivo cambió.');
  const bytes = Buffer.alloc(before.size + 1);
  const {bytesRead} = await reader.read(bytes, 0, bytes.length, 0);
  const after = await reader.stat();
  if (bytesRead !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw Error('El archivo cambió.');
  const content = new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, bytesRead));
  if (content.includes('\0')) throw Error('El archivo no es texto UTF-8.');
  const value = content.split(/\r?\n/)[line - 1];
  if (value === undefined || value.length > 4000) throw Error('La línea indicada no está disponible.');
  return value;
 } finally {
  await reader.close();
 }
}
