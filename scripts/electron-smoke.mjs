import { spawn } from 'node:child_process';
import electron from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
const environment = { ...process.env }; delete environment.ELECTRON_RUN_AS_NODE; delete environment.OPENAI_API_KEY;
const objective = process.argv.includes('--objective');
const child = spawn(electron, ['.', objective ? '--zen-objective-smoke' : '--zen-smoke'], { env: environment, windowsHide: true });
let output = ''; let errors = '';
child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => errors += chunk);
const timer = setTimeout(() => { child.kill(); }, 30000);
const code = await new Promise(resolve => child.on('exit', resolve)); clearTimeout(timer);
const line = output.split(/\r?\n/).find(line => line.startsWith('{'));
if (!line || code !== 0) {
  if (objective) {
    const diagnostic = errors.split(/\r?\n/).find(row => row.startsWith('Objective assertions failed: '));
    let assertions; try { assertions = JSON.parse(diagnostic.slice('Objective assertions failed: '.length)); } catch {}
    await writeFile('docs/evidence/objective-current.json', JSON.stringify({ at: new Date().toISOString(), passed: false, exitCode: code, assertions, failure: assertions?.focusDiagnostic ? 'meeting-focus-precondition' : 'native-smoke-incomplete' }, null, 2));
  }
  console.error('Electron smoke failed:', code, errors.slice(0, 2000)); process.exit(1);
}
const result = JSON.parse(line);
await writeFile('docs/evidence/computer-electron.json',JSON.stringify({at:new Date().toISOString(),passed:result.computerIpcVerified===true,scope:'synthetic-model-and-surface-real-electron-ipc',model:'mock',windowsInput:'mock',apiCalled:false,computerIpcVerified:result.computerIpcVerified,generalInterfacePending:!result.shownOnTop,shownOnTop:result.shownOnTop},null,2));
if (!result.activityTimelineVerified || !result.computerIpcVerified || !result.edgeDockingVerified || !result.taskbarReturnVerified || !result.backgroundTaskbarVerified || !result.miniCapsuleVerified || !result.stableStreamingVerified || !result.voiceNoticePreserved || !result.pasteImageCspVerified || !result.singleAttachmentClipVerified || !result.folderIpcVerified || !result.imageIpcVerified || !result.projectIpcVerified || !result.unknownProjectBlocked || !result.bridge || !result.nodeAbsent || !result.rendered || !result.settings.ok || !result.protectedRoundTrip || !result.preferencesIsolated || !result.trayCreated || !result.startedCompact || !result.shownOnTop || !result.hiddenNotOnTop || !result.topAnchorStable || !result.collapsedHeightVerified || !result.latestOnlyExpanded || !result.latestTranscriptVerified || !result.latestInterruptionVerified || !result.unknownArtifactBlocked || !result.invalidLiveSessionBlocked || !result.mcpSecretProtectionVerified || !result.libraryRootsLocal || !result.localFileWithoutApiVerified || !result.widthsVerified || !result.invalidDragBlocked || !result.horizontalDragVerified || !result.dragPositionPersisted || !result.positionLocked) throw new Error('Electron assertions failed: ' + JSON.stringify(result));
if (objective && (!result.objective || Object.values(result.objective).some(value => value !== true))) throw Error('Objective checks failed');
await mkdir('test-results', { recursive: true }); await writeFile(objective ? 'docs/evidence/objective-electron.json' : 'test-results/electron.json', JSON.stringify(result, null, 2));
if (objective) await writeFile('docs/evidence/objective-current.json', JSON.stringify({ at: new Date().toISOString(), passed: true, result }, null, 2));
console.log(JSON.stringify(result, null, 2));
