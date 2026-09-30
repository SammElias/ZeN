import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Approvals } from '../src/policy/approvals';
describe('Aprobaciones concretas', () => {
  it('no escribe al preparar; ejecuta una sola vez el contenido revisado', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zen-approval-'));
    try {
      const gate = new Approvals(); const grant = await gate.grant(directory);
      const request = { grantId: grant.grantId, kind: 'create-file' as const, name: 'prueba.txt', content: 'Contenido revisado' };
      const approval = gate.prepare(request); approval.content = 'Alterado en el frontend'; request.content = 'Alterado después';
      await expect(readFile(join(directory, 'prueba.txt'))).rejects.toThrow();
      await gate.approve(approval.id, new AbortController().signal);
      expect(await readFile(join(directory, 'prueba.txt'), 'utf8')).toBe('Contenido revisado');
      await expect(gate.approve(approval.id, new AbortController().signal)).rejects.toThrow('pendiente');
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it('bloquea traversal, sobrescritura, cancelación y reinicio', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zen-approval-'));
    try {
      const gate = new Approvals(); const { grantId } = await gate.grant(directory);
      expect(() => gate.prepare({ grantId, kind: 'create-file', name: '..\\escape.txt', content: '' })).toThrow();
      expect(() => gate.prepare({ grantId, kind: 'create-file', name: 'ejecutable.ps1', content: '' })).toThrow();
      await writeFile(join(directory, 'existente.txt'), 'Anterior');
      const overwrite = gate.prepare({ grantId, kind: 'create-file', name: 'existente.txt', content: 'Nuevo' });
      await expect(gate.approve(overwrite.id, new AbortController().signal)).rejects.toThrow(); expect(await readFile(join(directory, 'existente.txt'), 'utf8')).toBe('Anterior');
      const cancelled = gate.prepare({ grantId, kind: 'create-folder', name: 'carpeta', content: '' }); gate.cancel(cancelled.id); await expect(gate.approve(cancelled.id, new AbortController().signal)).rejects.toThrow();
      const pending = gate.prepare({ grantId, kind: 'create-folder', name: 'otra', content: '' }); gate.clear(); await expect(gate.approve(pending.id, new AbortController().signal)).rejects.toThrow();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
