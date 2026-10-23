import OpenAI from 'openai';
import {session} from 'electron';

/** Use Chromium's Windows networking, with a private non-persistent API session.
 * No browser cookies, automatic retries, or fallback model requests. */
export function desktopApiClient(apiKey:string,timeout:number){
 const network=session.fromPartition('zen-api');
 return new OpenAI({apiKey,maxRetries:0,timeout,fetch:(input,init)=>network.fetch(input instanceof URL?input.toString():input,{...init,credentials:'omit'})});
}
