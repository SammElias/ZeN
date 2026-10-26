import {z} from 'zod';
export const GmailClientId=z.string().trim().max(200).regex(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
export type GmailState={configured:boolean;connected:boolean;authorizing:boolean;clientCredentialsReady?:boolean;canTrash?:boolean;readerKey?:string;error?:string};
/** A short-lived, single-use review of one known conversation; never a mailbox-wide grant. */
export type GmailTrashReview={token:string;threadId:string;subject:string;messageCount:number;expiresAt:number};
/** Home may receive only an observed count, never conversation metadata or bodies. */
export type GmailSummary={configured:boolean;connected:boolean;unread?:number;checkedAt?:number};
/** List IDs identify conversations, never individual messages. */
export type GmailItem={id:string;subject:string;from:string;date:string;snippet:string;unread:boolean;messageCount:number};
export type GmailList={messages:GmailItem[];next?:string;unread?:number;limited?:boolean};
export type GmailRichBody={view:string;html:string;externalImages:number;inlineImages:number;unavailableImages:number;truncated:boolean;source?:'html'|'text'};
export type GmailImageResult={images:Record<string,string>;failed:number;remaining:number};
export type GmailThreadMessage=Omit<GmailItem,'messageCount'>&{to:string;text:string;truncated:boolean;rich?:GmailRichBody};
export type GmailMessage=GmailItem&{messages:GmailThreadMessage[];truncated:boolean;omittedMessages:number};
export const GMAIL_THREAD_METADATA_FIELDS='id,messages(id,threadId,labelIds,snippet,internalDate,payload(headers))';
export const GMAIL_THREAD_FULL_FIELDS='id,messages(id,threadId,labelIds,snippet,internalDate,payload)';
export const GmailQuery=z.object({query:z.string().trim().max(240).default(''),page:z.string().max(2048).optional()}).strict();
