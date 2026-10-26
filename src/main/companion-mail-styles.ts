import {parseDocument} from 'htmlparser2';
import postcss from 'postcss';
import render from 'dom-serializer';
import type {AnyNode,Element} from 'domhandler';

/** Inline a bounded subset of sender styles without a browser, imports or network. */
export function inlineMailStyles(html:string,allowed:Record<string,RegExp[]>):string{
 const document=parseDocument(html),elements:Element[]=[];let nodes=0;
 const scan=(node:AnyNode,depth=0)=>{if(depth>60||++nodes>30000)return;if(node.type==='tag'||node.type==='style'||node.type==='script')elements.push(node as Element);if('children'in node)for(const child of node.children)scan(child,depth+1);};scan(document);
 const sheets=elements.filter(e=>e.name==='style').map(e=>e.children.filter(n=>n.type==='text').map(n=>(n as {data:string}).data).join('')).join('\n').slice(0,50000);
 if(!sheets)return html;
 type Simple={tag?:string;id?:string;classes:string[];child?:boolean};
 const selector=(raw:string):Simple[]|undefined=>{if(raw.length>180||/[^\w\s.*#>\-]/.test(raw))return;const tokens=raw.trim().replace(/>/g,' > ').split(/\s+/);if(tokens.length>15||!tokens.length)return;const result:Simple[]=[];let child=false;
  for(const token of tokens){if(token==='>'){if(!result.length||child)return;child=true;continue;}if(!/^(?:[a-z][\w-]*|\*)?(?:[.#][a-z_][\w-]*)*$/i.test(token)||!token)return;const tag=/^([a-z][\w-]*|\*)/i.exec(token)?.[1],ids=[...token.matchAll(/#([\w-]+)/g)];if(ids.length>1)return;result.push({tag:tag?.toLowerCase(),id:ids[0]?.[1],classes:[...token.matchAll(/\.([\w-]+)/g)].map(m=>m[1]),child});child=false;}return child?undefined:result;
 };
 const isElement=(n:AnyNode|null|undefined):n is Element=>!!n&&['tag','style','script'].includes(n.type);
 const matchesOne=(node:Element,s:Simple)=>{const classes=new Set((node.attribs.class??'').split(/\s+/));return(!s.tag||s.tag==='*'||node.name===s.tag)&&(!s.id||node.attribs.id===s.id)&&s.classes.every(c=>classes.has(c));};
 const matches=(node:Element,chain:Simple[])=>{let current:AnyNode|null=node;for(let i=chain.length-1;i>=0;i--){if(!isElement(current)||!matchesOne(current,chain[i]))return false;if(i===0)return true;const direct=chain[i].child;current=current.parent;if(!direct)while(isElement(current)&&!matchesOne(current,chain[i-1]))current=current.parent;}return false;};
 const resolved=new Map<Element,Map<string,{value:string;weight:number;order:number}>>();let ruleCount=0,order=0,checks=0;
 try{const css=postcss.parse(sheets,{from:undefined});css.walkRules(rule=>{if(++ruleCount>100||rule.parent?.type!=='root')return;const declarations:{prop:string;value:string}[]=[];rule.each(node=>{if(node.type!=='decl'||declarations.length>=30)return;const prop=node.prop.toLowerCase(),value=node.value.trim();if(allowed[prop]?.some(pattern=>pattern.test(value)))declarations.push({prop,value});});if(!declarations.length)return;
  for(const raw of rule.selector.split(',').slice(0,10)){const chain=selector(raw);if(!chain)continue;const weight=chain.reduce((sum,s)=>sum+(s.id?100:0)+s.classes.length*10+(s.tag&&s.tag!=='*'?1:0),0),position=++order;for(const node of elements){if(++checks>200000)break;if(node.name==='style'||node.name==='script'||!matches(node,chain))continue;let values=resolved.get(node);if(!values)resolved.set(node,values=new Map());for(const d of declarations){const old=values.get(d.prop);if(!old||weight>old.weight||weight===old.weight&&position>=old.order)values.set(d.prop,{value:d.value,weight,order:position});}}}
 });}catch{return html;}
 for(const [node,values]of resolved){const base=[...values].map(([prop,v])=>prop+':'+v.value).join(';');node.attribs.style=base+';'+(node.attribs.style??'');}
 try{return render(document);}catch{return html;}
}
