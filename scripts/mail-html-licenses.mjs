import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,parse} from 'node:path';
const require=createRequire(import.meta.url),seen=new Set(),sections=[];
async function visit(name,from=require){
 let directory=dirname(from.resolve(name));
 for(;;){try{const pkg=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));if(pkg.name===name){if(seen.has(directory))return;seen.add(directory);const names=(await readdir(directory)).filter(f=>/^licen[cs]e(?:$|\.)/i.test(f));let license='';for(const file of names)license+=await readFile(join(directory,file),'utf8');sections.push(name+' '+pkg.version+'\n'+(pkg.homepage??pkg.repository?.url??'')+'\n'+(license||'License: '+pkg.license));const local=createRequire(join(directory,'package.json'));for(const child of Object.keys(pkg.dependencies??{}))await visit(child,local);return;}}catch(e){if(e?.code!=='ENOENT')throw e;}const parent=dirname(directory);if(parent===directory||directory===parse(directory).root)throw Error('Dependency license not found: '+name);directory=parent;}
}
for(const name of ['sanitize-html','ipaddr.js','image-size','htmlparser2','postcss','domhandler','dom-serializer'])await visit(name);
await mkdir('public/licenses',{recursive:true});await writeFile('public/licenses/mail-html-dependencies.txt',sections.sort().join('\n\n--------------------\n\n').replace(/[ \t]+$/gm,'').trimEnd()+'\n');
