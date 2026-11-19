import { defineConfig } from 'vite';
import {cp,mkdir} from 'node:fs/promises';
import {basename} from 'node:path';

export default defineConfig({
  base:'./',
  publicDir:false,
  plugins:[{
    name:'companion-resources',
    async closeBundle(){
      await mkdir('dist/renderer',{recursive:true});
      for(const name of ['icons','licenses','hub-templates'])await cp('public/'+name,'dist/renderer/'+name,{
        recursive:true,
        filter:path=>!['coucou-source.png','orbital'].includes(basename(path)),
      });
    },
  }],
  build:{outDir:'dist/renderer',rollupOptions:{input:{main:'index.html'}}},
});
