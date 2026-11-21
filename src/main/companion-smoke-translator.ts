export const smokeTranslatorResponse: typeof fetch = async (input,init) => {
  const url = new URL(String(input));
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const source = JSON.parse(String(init?.body))[0]?.Text;
  const key = new Headers(init?.headers).get('Ocp-Apim-Subscription-Key');
  if (key!=='zen-translator-test-key') return new Response(null,{status:401});
  if (from==='es'&&to==='en'&&source==='¿Quién aprueba las solicitudes?') {
    return Response.json([{translations:[{to,text:'Who approves the requests?'}]}]);
  }
  if (from==='en'&&to==='es'&&source==='The manager approves the requests.') {
    return Response.json([{translations:[{to,text:'El gestor aprueba las solicitudes.'}]}]);
  }
  return new Response(null,{status:400});
};
