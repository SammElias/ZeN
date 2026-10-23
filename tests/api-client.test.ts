import {it,expect,vi,afterEach} from 'vitest';
const {fetch,fromPartition}=vi.hoisted(()=>{const fetch=vi.fn();return{fetch,fromPartition:vi.fn(()=>({fetch}))};});
vi.mock('electron',()=>({session:{fromPartition}}));
import {desktopApiClient} from '../src/main/api-client';
afterEach(()=>vi.clearAllMocks());
it('uses the isolated Electron session without cookies for SDK calls',async()=>{
 fetch.mockResolvedValue(new Response(JSON.stringify({object:'response.input_tokens',input_tokens:10}),{status:200,headers:{'Content-Type':'application/json'}}));
 const client=desktopApiClient('synthetic-key',90000),signal=new AbortController().signal;
 expect((await client.responses.inputTokens.count({model:'gpt-6.1-sol',input:'OK'},{signal})).input_tokens).toBe(10);
 expect(fromPartition).toHaveBeenCalledWith('zen-api');expect(fetch).toHaveBeenCalledTimes(1);
 expect(fetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses/input_tokens');
 expect(fetch.mock.calls[0][1]).toMatchObject({credentials:'omit',method:'POST'});
 expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it('does not retry a transport failure or change the requested model',async()=>{
 fetch.mockRejectedValue(new Error('net::ERR_CONNECTION_TIMED_OUT'));
 const client=desktopApiClient('synthetic-key',90000);
 await expect(client.responses.create({model:'gpt-6.1-sol',input:'OK'})).rejects.toThrow();
 expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe('gpt-6.1-sol');
});
