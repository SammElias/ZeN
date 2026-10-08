export type ContextAttachment={id:string;size?:number;capturedAt?:number;fingerprint?:string;name:string;kind:'file'|'image'|'text'|'link'|'window';detail:string;preview?:string};
export type WindowDropEvent={state:'hover'|'leave'|'preparing'|'ready'|'error';name?:string;item?:ContextAttachment;error?:string};
