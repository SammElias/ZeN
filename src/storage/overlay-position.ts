import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { DisplayPlacementSchema, OverlayPositionSchema, type OverlayPosition } from '../shared/overlay-position';

const displayLimit = 30;
const DisplayPlacementsSchema = z.array(DisplayPlacementSchema).max(displayLimit);

function readPositionFile<Schema extends z.ZodType>(path: string, schema: Schema): z.output<Schema> | undefined {
  try {
    return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return undefined;
  }
}

function writePositionFile(path: string, value: unknown) {
  const temporary = path + '.tmp';
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, path);
}

export function readOverlayPosition(profile: string) {
  return readPositionFile(join(profile, 'overlay-position.json'), OverlayPositionSchema);
}

export function writeOverlayPosition(profile: string, position: z.input<typeof OverlayPositionSchema>) {
  writePositionFile(join(profile, 'overlay-position.json'), OverlayPositionSchema.parse(position));
}

export class CompanionPlacements {
  private readonly path: string;
  private readonly displays: Map<number, OverlayPosition>;

  constructor(private readonly profile: string) {
    this.path = join(profile, 'companion-placement.json');
    const stored = readPositionFile(this.path, DisplayPlacementsSchema) ?? [];
    this.displays = new Map(stored.map(position => [position.displayId, position]));
  }

  initial(primaryDisplayId: number): OverlayPosition {
    const previous = readOverlayPosition(this.profile) ?? {
      displayId: primaryDisplayId,
      edge: 'top',
      horizontalRatio: .5,
      verticalRatio: .5,
    };
    return this.forDisplay(previous, previous.displayId);
  }

  forDisplay(current: OverlayPosition, displayId: number): OverlayPosition {
    return { ...(this.displays.get(displayId) ?? current), displayId };
  }

  save(position: OverlayPosition) {
    const placement = DisplayPlacementSchema.parse(position);
    this.displays.set(placement.displayId, placement);
    // A read-only profile must still allow the capsule to move.
    try {
      writeOverlayPosition(this.profile, placement);
      writePositionFile(this.path, [...this.displays.values()].slice(-displayLimit));
    } catch {
      return;
    }
  }
}
