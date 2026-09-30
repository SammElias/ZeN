import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Settings, SpendingSummary } from '../shared/contracts';
import { ZenError } from '../shared/errors';

// Official standard USD rates checked 2026-09-30. Estimates exclude taxes/fees.
// Unknown models or incomplete usage never become a fabricated zero-cost receipt.
export const PRICING_DATE = '2026-09-30';
const rates: Record<string, { input: number; cached: number; output: number; audioInput?: number; audioCached?: number; audioOutput?: number }> = {
  'gpt-6.1-sol': { input: 2.5, cached: .1, output: 10 }, // maximum of input/cache-write rates
  'gpt-realtime-2.1': { input: 4, cached: .4, output: 24, audioInput: 32, audioCached: .4, audioOutput: 64 },
  'gpt-realtime-2.1-mini': { input: .6, cached: .06, output: 2.4, audioInput: 10, audioCached: .3, audioOutput: 20 },
  'gpt-4o-mini-transcribe': { input: 1.25, cached: 0, output: 5, audioInput: 3 },
};
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
export function estimateUsd(model: string, usage: any): number | undefined {
  const rate = rates[model]; const input = count(usage?.input_tokens); const output = count(usage?.output_tokens);
  if (!rate || input === undefined || output === undefined) return;
  const details = usage.input_tokens_details ?? usage.input_token_details ?? {};
  const out = usage.output_tokens_details ?? usage.output_token_details ?? {};
  const cached = Math.min(input, count(details.cached_tokens) ?? 0);
  if (rate.audioInput !== undefined) {
    const audioInput = count(details.audio_tokens); const audioOutput = count(out.audio_tokens);
    // No modality breakdown: use the highest applicable rate as an upper estimate.
    if (audioInput === undefined || (audioOutput === undefined && model !== 'gpt-4o-mini-transcribe')) return (input * Math.max(rate.input, rate.audioInput) + output * Math.max(rate.output, rate.audioOutput ?? 0)) / 1e6;
    const ai = Math.min(input, audioInput); const ao = Math.min(output, audioOutput ?? 0);
    const ac = Math.min(ai, cached, count(details.cached_tokens_details?.audio_tokens) ?? 0);
    const tc = Math.min(input - ai, cached - ac);
    return ((ai - ac) * rate.audioInput + ac * (rate.audioCached ?? 0) + (input - ai - tc) * rate.input + tc * rate.cached + ao * (rate.audioOutput ?? rate.output) + (output - ao) * rate.output) / 1e6;
  }
  return ((input - cached) * rate.input + cached * rate.cached + output * rate.output) / 1e6;
}

const Entry = z.object({ id: z.string(), at: z.string().datetime(), channel: z.enum(['agent', 'voice']), model: z.string(), reserveUsd: z.number().nonnegative(), costUsd: z.number().nonnegative(), state: z.enum(['active', 'settled', 'uncertain']), inputTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative(), cachedTokens: z.number().nonnegative(), receipts: z.array(z.string()) });
type Entry = z.infer<typeof Entry>;
export interface SpendingGuard {
  reserve(channel: 'agent' | 'voice', model: string, amountUsd: number): string;
  record(id: string, receipt: string, model: string, usage: unknown): boolean;
  tool(id: string, receipt: string): void;
  finish(id: string, confirmed: boolean): void;
  check(id: string): void;
}
export class Spending implements SpendingGuard {
  private entries: Entry[];
  private path: string;
  constructor(directory: string, private settings: () => Settings, private now: () => Date = () => new Date()) {
    mkdirSync(directory, { recursive: true }); this.path = join(directory, 'spending.json');
    try { this.entries = existsSync(this.path) ? z.array(Entry).parse(JSON.parse(readFileSync(this.path, 'utf8'))) : []; }
    catch { throw new ZenError('El contador de gasto está dañado. No se iniciarán llamadas de pago.'); }
    // A crash must not release unknown usage or silently refill the budget.
    this.entries.forEach(row => { if (row.state === 'active') row.state = 'uncertain'; });
    this.save();
  }
  private day(date: Date) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-'); }
  private save() { writeFileSync(this.path + '.tmp', JSON.stringify(this.entries, null, 2), { mode: 0o600 }); renameSync(this.path + '.tmp', this.path); }
  private amount(row: Entry) { return row.state === 'settled' ? row.costUsd : Math.max(row.reserveUsd, row.costUsd); }
  summary(): SpendingSummary {
    const day = this.day(this.now()); const monthly = this.entries.filter(row => this.day(new Date(row.at)).slice(0, 7) === day.slice(0, 7));
    const today = monthly.filter(row => this.day(new Date(row.at)) === day); const fx = this.settings().eurPerUsd;
    return { month: day.slice(0, 7), estimatedMonthEur: monthly.reduce((sum, row) => sum + row.costUsd, 0) * fx, committedMonthEur: monthly.reduce((sum, row) => sum + this.amount(row), 0) * fx, estimatedDayEur: today.reduce((sum, row) => sum + row.costUsd, 0) * fx, pendingEur: monthly.reduce((sum, row) => sum + this.amount(row) - row.costUsd, 0) * fx, inputTokens: monthly.reduce((sum, row) => sum + row.inputTokens, 0), outputTokens: monthly.reduce((sum, row) => sum + row.outputTokens, 0), cachedTokens: monthly.reduce((sum, row) => sum + row.cachedTokens, 0), uncertainCalls: monthly.filter(row => row.state === 'uncertain').length, pricingDate: PRICING_DATE };
  }
  reserve(channel: 'agent' | 'voice', model: string, amountUsd: number) {
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new ZenError('Reserva de gasto no válida.');
    if (!rates[model]) throw new ZenError('No hay tarifa verificada para ese modelo. Revisa el modelo de voz antes de gastar.');
    const settings = this.settings();
    if (this.summary().committedMonthEur + amountUsd * settings.eurPerUsd > settings.monthlyBudgetEur) throw new ZenError('Límite mensual de ZeN alcanzado o reservado. Las operaciones locales siguen disponibles.');
    const row: Entry = { id: randomUUID(), at: this.now().toISOString(), channel, model, reserveUsd: amountUsd, costUsd: 0, state: 'active', inputTokens: 0, outputTokens: 0, cachedTokens: 0, receipts: [] };
    this.entries.push(row); this.save(); return row.id;
  }
  private entry(id: string) { const row = this.entries.find(row => row.id === id); if (!row) throw new ZenError('Reserva de gasto no válida.'); return row; }
  record(id: string, receipt: string, model: string, usage: any) {
    const row = this.entry(id); if (row.receipts.includes(receipt)) return true;
    const cost = estimateUsd(model, usage); if (cost === undefined) return false;
    row.receipts.push(receipt); row.costUsd += cost;
    row.inputTokens += usage.input_tokens; row.outputTokens += usage.output_tokens;
    row.cachedTokens += Math.min(usage.input_tokens, count((usage.input_tokens_details ?? usage.input_token_details)?.cached_tokens) ?? 0);
    this.save(); return true;
  }
  tool(id: string, receipt: string) { const row = this.entry(id); if (row.receipts.includes(receipt)) return; row.receipts.push(receipt); row.costUsd += .01; this.save(); }
  finish(id: string, confirmed: boolean) { const row = this.entry(id); row.state = confirmed ? 'settled' : 'uncertain'; this.save(); }
  check(id: string) {
    const row = this.entry(id);
    if (row.costUsd > row.reserveUsd || this.summary().committedMonthEur > this.settings().monthlyBudgetEur) throw new ZenError('Presupuesto local alcanzado. Se detienen nuevas llamadas; puede quedar consumo pendiente de confirmar.');
  }
}
