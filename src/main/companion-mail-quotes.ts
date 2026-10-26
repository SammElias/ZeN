import {parseDocument} from 'htmlparser2';
import render from 'dom-serializer';
import {Element,Text,type AnyNode,type ChildNode,type ParentNode} from 'domhandler';

/** Runs after sanitizing. Adds only local native details controls, retaining every original node. */
export function foldMailQuotes(html:string){
 if(html.length>1500000)return html;const document=parseDocument(html);let count=0,valid=true;
 const check=(node:AnyNode,depth:number)=>{if(depth>60||++count>30000){valid=false;return;}if('children'in node)for(const child of node.children){if(!valid)break;check(child,depth+1);}};check(document,0);if(!valid)return html;
 const children=(parent:ParentNode,list:ChildNode[])=>{parent.children=list;list.forEach((node,i)=>{node.parent=parent;node.prev=list[i-1]??null;node.next=list[i+1]??null;});};
 let seenText=false,folded=0;
 const visit=(parent:ParentNode)=>{
  for(let i=0;i<parent.children.length;i++){
   const node=parent.children[i];if(node.type==='text'){if(node.data.trim())seenText=true;continue;}
   if(node.type==='tag'&&seenText&&folded<100&&(node.name==='blockquote'||node.attribs['data-zen-quote'])){
    const quoted=node.attribs['data-zen-quote']==='tail'?parent.children.slice(i):[node],details=new Element('details',{class:'zen-mail-quote'}),summary=new Element('summary',{}),body=new Element('div',{class:'zen-mail-quote-body'});
    children(summary,[new Text('Ver texto citado')]);children(body,quoted);children(details,[summary,body]);children(parent,[...parent.children.slice(0,i),details,...parent.children.slice(i+quoted.length)]);folded++;continue;
   }
   if('children'in node)visit(node);
  }
 };
 visit(document);return folded?render(document):html;
}
