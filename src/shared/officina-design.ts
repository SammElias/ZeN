import {z} from 'zod';

const previousDesigns = z.enum(['classic','aureo','greenhouse','prism','refuge','workshop']);
export type ModelledOfficeDesign = z.infer<typeof previousDesigns>;

export const officeNames = {
  graphite:'Grafito', monochrome:'Monocromo', redline:'Línea Roja', nexus:'Nexo',
} as const;
const available = z.enum(['graphite','monochrome','redline','nexus']);

// Accept prior versions of locally saved settings and portable backups.
export const OfficinaDesign = z.union([available,previousDesigns.transform(()=>'graphite' as const)]);
export type OfficinaDesign = z.infer<typeof OfficinaDesign>;
