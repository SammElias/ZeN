import { defineConfig } from 'vite';
import {cp,mkdir} from 'node:fs/promises';
export default defineConfig({base:'./',publicDir:false,plugins:[{name:'companion-resources',async closeBundle(){await mkdir('dist/renderer',{recursive:true});for(const name of ['icons','licenses'])await cp('public/'+name,'dist/renderer/'+name,{recursive:true,filter:path=>!path.endsWith('coucou-source.png')});}}],build:{outDir:'dist/renderer',rollupOptions:{input:{main:'index.html'}}}});
