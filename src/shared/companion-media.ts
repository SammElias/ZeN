import {z} from 'zod';
// Labels come only from the media session's app identity, never a window or web page.
export const MediaSource=z.string().min(1).max(120).regex(/^[^\x00-\x1f\x7f]+$/);
export const MediaSession=z.object({id:z.string().uuid(),name:MediaSource,browser:z.boolean()}).strict();
export type MediaSession=z.infer<typeof MediaSession>;
export const MediaTrack=z.object({session:z.string().uuid(),source:MediaSource,browser:z.boolean(),title:z.string().max(500),artist:z.string().max(500),album:z.string().max(500),artwork:z.string().max(500000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).nullable(),playing:z.boolean(),shuffle:z.boolean().nullable(),repeat:z.enum(['none','list','track']).nullable(),positionMs:z.number().finite().min(0).max(1e12),durationMs:z.number().finite().min(0).max(1e12),controls:z.object({play:z.boolean(),pause:z.boolean(),previous:z.boolean(),next:z.boolean(),shuffle:z.boolean(),repeat:z.boolean()}).strict()}).strict();
export type MediaTrack=z.infer<typeof MediaTrack>;
// Automatic observation carries no session token or controls, so it cannot grant playback authority.
export const MediaNowPlaying=z.object({source:MediaSource,browser:z.boolean(),title:z.string().max(500),artist:z.string().max(500),album:z.string().max(500),artwork:z.string().max(500000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).nullable(),playing:z.literal(true)}).strict();
export type MediaNowPlaying=z.infer<typeof MediaNowPlaying>;
export const MediaCommand=z.object({id:z.string().uuid(),session:z.string().uuid(),action:z.enum(['play','pause','previous','next','shuffle','repeat']),value:z.enum(['on','off','all','one']).optional()}).strict().refine(v=>v.action==='shuffle'?v.value==='on'||v.value==='off':v.action==='repeat'?['off','all','one'].includes(v.value??''):v.value===undefined);
export type MediaCommand=z.infer<typeof MediaCommand>;
