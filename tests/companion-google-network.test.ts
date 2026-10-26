import {describe,it,expect,vi} from 'vitest';
import {googleNetworkFetch,googleNetworkFailure} from '../src/main/companion-google-network';
import {GMAIL_THREAD_METADATA_FIELDS,GMAIL_THREAD_FULL_FIELDS} from '../src/shared/companion-gmail';

describe('Google isolated Chromium transport',()=>{
 it('permits only an empty-body thread trash POST with the minimal response field',async()=>{
  const network={fetch:vi.fn(async()=>Response.json({id:'one'}))},request=googleNetworkFetch(network),base='https://gmail.googleapis.com/gmail/v1/users/me/';
  await request(base+'threads/one/trash?fields=id',{method:'POST'});
  for(const route of ['threads/one/trash','threads/one/trash?fields=messages','threads/one/trash?fields=id&fields=id','threads/one/trash?fields=id&other=1','threads/one/untrash?fields=id','messages/one/trash?fields=id','threads/one/modify?fields=id','messages/send'])await expect(request(base+route,{method:'POST'})).rejects.toThrow('no permitido');
  for(const method of ['GET','PATCH','DELETE'])await expect(request(base+'threads/one/trash?fields=id',{method})).rejects.toThrow('no permitido');
  await expect(request(base+'threads/one/trash?fields=id',{method:'POST',body:'{}'})).rejects.toThrow('no permitido');expect(network.fetch).toHaveBeenCalledTimes(1);
 });
 it('permits only the unread-count field for a Home summary',async()=>{
  const network={fetch:vi.fn(async()=>new Response('{}'))},request=googleNetworkFetch(network);
  await request('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX?fields=messagesUnread');
  for(const suffix of ['fields=messagesUnread&fields=messagesUnread','fields=messagesTotal','fields=messagesUnread&other=value','fields=messagesUnread,threadsUnread'])await expect(request('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX?'+suffix)).rejects.toThrow('no permitido');
  expect(network.fetch).toHaveBeenCalledTimes(1);
 });
 it('keeps OAuth POST data and cancellation while omitting browser credentials and cache',async()=>{
  const session={fetch:vi.fn(async()=>new Response('{}'))},signal=new AbortController().signal;
  const body=new URLSearchParams({code:'SYNTHETIC_CODE',code_verifier:'SYNTHETIC_VERIFIER'}).toString();
  await googleNetworkFetch(session)('https://oauth2.googleapis.com/token',{method:'POST',body,signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},credentials:'include',redirect:'follow',cache:'force-cache'});
  expect(session.fetch).toHaveBeenCalledExactlyOnceWith('https://oauth2.googleapis.com/token',expect.objectContaining({method:'POST',body,signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',bypassCustomProtocolHandlers:true}));
 });
 it('permits only fixed Google token and read-only mailbox routes',async()=>{
  const session={fetch:vi.fn(async()=>new Response('{}'))},request=googleNetworkFetch(session);
  for(const suffix of ['threads?labelIds=INBOX&maxResults=20&q=example','threads/a_1?'+new URLSearchParams({format:'full',fields:GMAIL_THREAD_FULL_FIELDS}),'threads/a_1?'+new URLSearchParams({format:'metadata',fields:GMAIL_THREAD_METADATA_FIELDS})+'&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date','labels/INBOX'])await request('https://gmail.googleapis.com/gmail/v1/users/me/'+suffix);
  for(const url of ['http://gmail.googleapis.com/gmail/v1/users/me/messages','https://gmail.googleapis.com.evil.test/gmail/v1/users/me/messages','file:///tmp/local','https://user:secret@oauth2.googleapis.com/token','https://oauth2.googleapis.com/token?code=secret','https://gmail.googleapis.com/gmail/v1/users/me/messages/a/send','https://gmail.googleapis.com/gmail/v1/users/me/messages#secret'])await expect(request(url,{method:'POST'})).rejects.toThrow('no permitido');
  await expect(request('https://gmail.googleapis.com/gmail/v1/users/me/messages',{method:'DELETE'})).rejects.toThrow('no permitido');
  expect(session.fetch).toHaveBeenCalledTimes(4);
 });
 it('rejects unbounded queries, extra parameters, message downloads and every mailbox effect',async()=>{
  const session={fetch:vi.fn(async()=>new Response('{}'))},request=googleNetworkFetch(session),base='https://gmail.googleapis.com/gmail/v1/users/me/';
  for(const suffix of ['threads','threads?labelIds=INBOX&maxResults=500','threads?labelIds=INBOX&maxResults=20&q='+('a'.repeat(241)),'threads?labelIds=INBOX&maxResults=20&pageToken='+('p'.repeat(2049)),'threads?labelIds=INBOX&maxResults=20&maxResults=20','threads?labelIds=INBOX&maxResults=20&includeSpamTrash=true','threads/one?format=raw','threads/one?format=full&fields=raw','threads/one?'+new URLSearchParams({format:'full',fields:GMAIL_THREAD_FULL_FIELDS})+'&metadataHeaders=Subject','messages/one?format=full','messages/one/attachments/two','threads/one/trash','labels/INBOX?fields=id'])await expect(request(base+suffix)).rejects.toThrow('no permitido');
  for(const method of ['POST','PATCH','DELETE'])await expect(request(base+'threads/one?'+new URLSearchParams({format:'full',fields:GMAIL_THREAD_FULL_FIELDS}),{method})).rejects.toThrow('no permitido');
  await expect(request(base+'threads?labelIds=INBOX&maxResults=20',{body:'unexpected'})).rejects.toThrow('no permitido');expect(session.fetch).not.toHaveBeenCalled();
 });
 it('does not retry a failed Chromium request',async()=>{
  const error=Error('net::ERR_CONNECTION_RESET'),session={fetch:vi.fn(async()=>{throw error;})};
  await expect(googleNetworkFetch(session)('https://oauth2.googleapis.com/token',{method:'POST'})).rejects.toBe(error);
  expect(session.fetch).toHaveBeenCalledTimes(1);
 });
 it('recognizes Node causes and Chromium codes without exposing arbitrary messages',()=>{
  const signal=new AbortController().signal;
  expect(googleNetworkFailure(new TypeError('fetch failed',{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}}),signal).kind).toBe('TIMEOUT');
  expect(googleNetworkFailure(Error('net::ERR_CERT_AUTHORITY_INVALID at https://secret.example/token'),signal)).toMatchObject({kind:'TLS',code:'ERR_CERT_AUTHORITY_INVALID'});
  expect(googleNetworkFailure(Error('net::ERR_NAME_NOT_RESOLVED'),signal).kind).toBe('DNS');
  const safe=JSON.stringify(googleNetworkFailure({code:'PRIVATE_TOKEN',message:'PRIVATE_BODY',cause:{code:'PRIVATE_CODE'}},signal));
  expect(safe).not.toContain('PRIVATE');expect(safe).toContain('NETWORK');
 });
 it('distinguishes explicit cancellation from timeout',()=>{
  const cancelled=new AbortController(),timeout=new AbortController();cancelled.abort();timeout.abort(new DOMException('Do not log','TimeoutError'));
  expect(googleNetworkFailure(Error('anything'),cancelled.signal).kind).toBe('CANCELLED');
  expect(googleNetworkFailure(Error('anything'),timeout.signal).kind).toBe('TIMEOUT');
 });
});
