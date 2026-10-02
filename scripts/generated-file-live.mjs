import {build} from 'esbuild';
await build({entryPoints:['scripts/generated-file-live.ts'],bundle:true,platform:'node',format:'cjs',outfile:'test-results/generated-file-live.cjs'});
await import('../test-results/generated-file-live.cjs');
