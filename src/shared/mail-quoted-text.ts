/** Presentation only: slices preserve the original bytes; analysis always keeps the full text. */
export function splitQuotedText(text:string){
 const lines=text.split('\n');let offset=0;
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  const boundary=/^>/.test(line)||/^(?:On .{3,240} wrote:|El .{3,240} escribi[oó]:)$/i.test(line)||/^-{2,}\s*(?:Original Message|Mensaje original|Forwarded message|Mensaje reenviado)\s*-{2,}$/i.test(line);
  if(boundary&&text.slice(0,offset).trim())return{body:text.slice(0,offset),quote:text.slice(offset)};
  offset+=lines[i].length+1;
 }
 return{body:text,quote:''};
}
