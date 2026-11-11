import { runCompanionSmoke } from './companion-smoke-runner.mjs';

const result = await runCompanionSmoke(process.argv[2]);
console.log(JSON.stringify(result));
