import {mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {captureOfficinaSource} from '../src/main/companion-officina-context';
import {resolveOfficinaReference} from '../src/main/companion-officina-reference';
import {officinaReference} from '../src/shared/officina-reference';

function local(value: string) {
  const reference = officinaReference(value);
  if (reference?.kind !== 'local') throw Error('Expected a local link');
  return reference;
}

it('recognizes Codex file links, task-relative paths, and web addresses', () => {
  for (const uri of ['C:/Mi%20proyecto/guía.md:12:3', '/C:/Mi%20proyecto/guía.md:12:3',
    'file:///C:/Mi%20proyecto/guía.md:12:3', 'file://localhost/C:/Mi%20proyecto/guía.md:12:3']) {
    expect(local(uri)).toEqual({kind: 'local', path: 'C:/Mi proyecto/guía.md', absolute: true, line: 12, column: 3});
  }
  expect(local('src/main.ts#L4-L9')).toMatchObject({path: 'src/main.ts', absolute: false, line: 4});
  expect(local('src\\guía 100%.md')).toMatchObject({path: 'src\\guía 100%.md', absolute: false});
  expect(officinaReference('https://example.invalid/guía')).toEqual({kind: 'web', url: 'https://example.invalid/gu%C3%ADa'});
});

it('rejects non-web protocols, network paths and unsafe Windows filename forms', () => {
  for (const uri of ['vscode://settings', 'command:workbench.action', 'javascript:12', 'data:text/html,hi',
    'https://user@example.invalid', 'https:///example.invalid', '//example.invalid/path',
    'file://server/share/file.md', 'file:///relative.md', 'C:relative.md', '\\\\server\\share',
    'C:/foo/NUL.txt', 'C:/foo/normal .', 'C:/foo/file.md:stream', 'C:/foo/%00']) {
    expect(officinaReference(uri), uri).toBeUndefined();
  }
});

it.skipIf(process.platform !== 'win32')('opens existing local targets, including explicit attachments, and blocks junction escapes', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'zen-officina-link-'));
  try {
    const root = join(parent, 'project'), outside = join(parent, 'project-other');
    await mkdir(root);
    await mkdir(outside);
    const file = join(root, 'guía 100%.md'), attachment = join(outside, 'adjunto.txt');
    await writeFile(file, 'documento');
    await writeFile(attachment, 'adjunto');
    await symlink(outside, join(root, 'junction'), 'junction');
    const scope = {folder: await captureOfficinaSource(root, 'folder'), cwd: outside, files: []};
    await expect(resolveOfficinaReference(local('gu%C3%ADa%20100%25.md'), scope)).resolves.toEqual({path: file, directory: false});
    await expect(resolveOfficinaReference(local('.'), scope)).resolves.toEqual({path: root, directory: true});
    await expect(resolveOfficinaReference(local('../project-other/adjunto.txt'), scope)).rejects.toThrow('fuera de la carpeta');
    await expect(resolveOfficinaReference(local('junction/adjunto.txt'), scope)).rejects.toThrow('resuelve fuera');
    await expect(resolveOfficinaReference(local('borrado.md'), scope)).rejects.toThrow('ya no está disponible');
    const attached = await captureOfficinaSource(attachment, 'file');
    await expect(resolveOfficinaReference(local(attachment), {...scope, files: [attached]}))
      .resolves.toEqual({path: attachment, directory: false});
  } finally {
    await rm(parent, {recursive: true, force: true});
  }
});
