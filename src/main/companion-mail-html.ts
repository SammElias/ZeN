import sanitizeHtml from 'sanitize-html';
import {inlineMailStyles} from './companion-mail-styles';
import {randomBytes} from 'node:crypto';
import type {GmailRichBody} from '../shared/companion-gmail';
import {mailWebUrl,rasterMailImage} from './companion-mail-images';

export type MailHtmlView={rich:GmailRichBody;images:Map<string,{url?:string;data?:string}>;links:Map<string,string>};
const textLimit=1000000,htmlLimit=1500000,imageLimit=16;
export const mailMime=(part:any)=>String(part?.mimeType??'').split(';',1)[0].trim().toLowerCase();
export const mailAttachment=(part:any)=>/^(?:attachment)(?:;|$)/i.test(attr(part,'content-disposition').trim())||!!part?.filename&&!/^inline(?:;|$)/i.test(attr(part,'content-disposition').trim());
const attr=(part:any,name:string)=>String(part?.headers?.find((h:any)=>String(h?.name).toLowerCase()===name)?.value??'').slice(0,1000);
const color=/^(?:#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d\s.,%]+\))$/i;
const length=/^(?:0|auto|(?:\d{1,4}(?:\.\d{1,2})?)(?:px|pt|em|rem|%))$/;
const lengths=/^(?:0|auto|\d{1,4}(?:\.\d{1,2})?(?:px|pt|em|rem|%))(?:\s+(?:0|auto|\d{1,4}(?:\.\d{1,2})?(?:px|pt|em|rem|%))){0,3}$/;
const styles:Record<string,RegExp[]>={color:[color],'background-color':[color],'font-family':[/^[a-z\s,'"-]{1,150}$/i],'font-size':[length],'font-weight':[/^(?:normal|bold|bolder|[1-9]00)$/],'font-style':[/^(?:normal|italic|oblique)$/],'text-align':[/^(?:left|right|center|justify|start|end)$/],'text-decoration':[/^(?:none|underline|line-through)$/],'line-height':[/^(?:normal|\d(?:\.\d{1,2})?|\d{1,3}(?:px|pt|%))$/],width:[length],'max-width':[length],'min-width':[length],height:[length],'max-height':[length],margin:[lengths],padding:[lengths],'border-collapse':[/^(?:collapse|separate)$/],'border-spacing':[lengths],'border-radius':[lengths],'vertical-align':[/^(?:top|middle|bottom|baseline)$/],display:[/^(?:block|inline|inline-block|table|table-cell|table-row|none)$/]};
for(const side of ['top','right','bottom','left']){styles['margin-'+side]=[length];styles['padding-'+side]=[length];styles['border-'+side]=[/^(?:\d{1,2}px\s+(?:solid|dashed|dotted)\s+(?:#[\da-f]{3,8}|[a-z]{1,24}))$/i];}
styles.border=styles['border-top'];styles.background=[color];styles['white-space']=[/^(?:normal|pre-wrap)$/];
function decode(part:any){const data=part?.body?.data;if(typeof data!=='string'||data.length>1400000||!/^[-_A-Za-z0-9]*={0,2}$/.test(data))return;try{const charset=/charset\s*=\s*["']?([^\s;"']+)/i.exec(attr(part,'content-type'))?.[1]??'utf-8';return new TextDecoder(charset).decode(Buffer.from(data,'base64url'));}catch{return;}}
/** Parse MIME and sanitize in main. The renderer never receives raw email HTML. */
export function prepareMailHtml(payload:any,fallbackText?:string):MailHtmlView|undefined{
 let visited=0,truncated=false;const cid=new Map<string,string>();
 const walk=(part:any,depth=0):string=>{
  if(!part||depth>12||++visited>400){truncated=true;return '';}
  if(/^image\/(?:png|jpeg|gif|webp)$/.test(mailMime(part))){const key=attr(part,'content-id').trim().replace(/^<|>$/g,'');if(key&&cid.size<imageLimit&&typeof part.body?.data==='string'&&part.body.data.length<=1400000)try{cid.set(key,rasterMailImage(Buffer.from(part.body.data,'base64url'),part.mimeType));}catch{}return '';}
  if(mailAttachment(part))return '';
  if(mailMime(part)==='text/html'){const value=decode(part);if(value===undefined||value.length>textLimit){truncated=true;return '';}return value;}
  const children=Array.isArray(part.parts)?part.parts.slice(0,400):[];if(Array.isArray(part.parts)&&part.parts.length>400)truncated=true;
  const values=children.map((p:any)=>walk(p,depth+1)).filter(Boolean);
  if(mailMime(part)==='multipart/alternative')return values[0]??'';
  const joined=values.join('<br>');if(joined.length>textLimit){truncated=true;return values[0]??'';}return joined;
 };
 let raw=walk(payload);const source=raw?'html':'text';if(!raw&&fallbackText!==undefined){const escape=(v:string)=>v.replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]!));raw='<div style="white-space:pre-wrap">'+escape(fallbackText)+'</div>';}if(!raw)return;
 const images:MailHtmlView['images']=new Map(),links:MailHtmlView['links']=new Map();let unavailableImages=0;
 const html=sanitizeHtml(inlineMailStyles(raw,styles),{allowedTags:['a','p','div','span','table','tbody','thead','tfoot','tr','td','th','img','h1','h2','h3','h4','h5','h6','strong','b','i','em','u','s','blockquote','pre','code','br','hr','ol','ul','li','center','sub','sup','small','font'],allowedAttributes:{'*':['style','dir'],div:['data-zen-quote'],a:['href','title','data-zen-link'],img:['alt','width','height','data-zen-image'],table:['width','cellpadding','cellspacing','border','align','bgcolor','role'],td:['width','height','colspan','rowspan','align','valign','bgcolor'],th:['colspan','rowspan','align','valign'],font:['color','face','size']},allowedStyles:{'*':styles},allowedSchemes:['https','http'],allowProtocolRelative:false,nonTextTags:['script','style','textarea','option','noscript','template','iframe','object','embed','svg','math','form','select','button','title','head'],nestingLimit:40,
  transformTags:{
   body:(_tag,a)=>({tagName:'div',attribs:{...(a.style?{style:a.style}:{}),...(a.dir?{dir:a.dir}:{})}}),
   div:(_tag,a)=>{const props={...a};delete props['data-zen-quote'];if(a.id==='divRplyFwdMsg'||/(?:^|\s)OutlookMessageHeader(?:\s|$)/.test(a.class??''))props['data-zen-quote']='tail';else if(/(?:^|\s)(?:gmail_quote|yahoo_quoted|moz-cite-prefix)(?:\s|$)/.test(a.class??''))props['data-zen-quote']='block';return{tagName:'div',attribs:props};},
   a:(_tag,a)=>{const url=mailWebUrl(a.href??'');if(!url||links.size>=100)return{tagName:'span',attribs:{style:a.style??''}};const id='l'+links.size;links.set(id,url);return{tagName:'a',attribs:{href:'#'+id,title:url,'data-zen-link':id,...(a.style?{style:a.style}:{})}};},
   img:(_tag,a)=>{const props:Record<string,string>={alt:String(a.alt??'Imagen del correo').slice(0,200)};for(const key of ['width','height'])if(/^\d{1,4}$/.test(a[key]??''))props[key]=a[key];
    if(images.size>=imageLimit){unavailableImages++;return{tagName:'img',attribs:props};}
    const id='i'+images.size,src=a.src??'';let data:string|undefined,url:string|undefined;
    if(src.startsWith('cid:')){try{data=cid.get(decodeURIComponent(src.slice(4)));}catch{}}
    else if(/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(src)&&src.length<=1400000)try{const [kind,value]=src.split(',',2);if(/^[\da-z+/]*={0,2}$/i.test(value))data=rasterMailImage(Buffer.from(value,'base64'),kind.slice(5,-7));}catch{}
    else url=mailWebUrl(src,true);
    if(!data&&!url){unavailableImages++;return{tagName:'img',attribs:props};}
    images.set(id,{data,url});return{tagName:'img',attribs:{...props,'data-zen-image':id}};
   }
  }});
 if(html.length>htmlLimit){if(payload&&fallbackText!==undefined){const fallback=prepareMailHtml(undefined,fallbackText);if(fallback)fallback.rich.truncated=true;return fallback;}return;}
 return{rich:{view:randomBytes(16).toString('hex'),html,externalImages:[...images.values()].filter(v=>v.url).length,inlineImages:[...images.values()].filter(v=>v.data).length,unavailableImages,truncated,source},images,links};
}
