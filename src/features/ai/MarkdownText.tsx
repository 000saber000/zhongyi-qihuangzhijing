import type {ReactNode} from 'react';

const safeHref=(value:string)=>/^https?:\/\//i.test(value)?value:null;

function inline(text:string):ReactNode[]{
 const nodes:ReactNode[]=[];
 const re=/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[[^\]]+\]\([^)\s]+\))/g;
 let last=0,key=0,match:RegExpExecArray|null;
 while((match=re.exec(text))){
  if(match.index>last)nodes.push(text.slice(last,match.index));
  const token=match[0];
  if(token.startsWith('**'))nodes.push(<strong key={key++}>{token.slice(2,-2)}</strong>);
  else if(token.startsWith('`'))nodes.push(<code key={key++}>{token.slice(1,-1)}</code>);
  else if(token.startsWith('*'))nodes.push(<em key={key++}>{token.slice(1,-1)}</em>);
  else{
   const link=/^\[([^\]]+)\]\(([^)]+)\)$/.exec(token),href=link?safeHref(link[2]):null;
   if(link&&href)nodes.push(<a key={key++} href={href} target="_blank" rel="noreferrer">{link[1]}</a>);
   else nodes.push(token);
  }
  last=match.index+token.length;
 }
 if(last<text.length)nodes.push(text.slice(last));
 return nodes;
}

export default function MarkdownText({text}:{text:string}){
 const blocks:ReactNode[]=[];
 let paragraph:string[]=[],list:{ordered:boolean;items:string[]}|null=null,code:string[]|null=null;
 const flush=()=>{
  if(paragraph.length){blocks.push(<p key={blocks.length}>{inline(paragraph.join('\n'))}</p>);paragraph=[];}
  if(list){const Tag=list.ordered?'ol':'ul';blocks.push(<Tag key={blocks.length} className="ai-md-list">{list.items.map((item,index)=><li key={index}>{inline(item)}</li>)}</Tag>);list=null;}
 };
 for(const line of text.replace(/\r\n?/g,'\n').split('\n')){
  if(code){if(/^\s*```/.test(line)){blocks.push(<pre key={blocks.length} className="ai-md-code"><code>{code.join('\n')}</code></pre>);code=null;}else code.push(line);continue;}
  if(/^\s*```/.test(line)){flush();code=[];continue;}
  if(!line.trim()){flush();continue;}
  const heading=/^(#{1,4})\s+(.*)$/.exec(line);
  if(heading){
   flush();
   const Tag=`h${Math.min(heading[1].length+2,6)}` as 'h3'|'h4'|'h5'|'h6';
   blocks.push(<Tag key={blocks.length} className="ai-md-heading">{inline(heading[2])}</Tag>);
   continue;
  }
  if(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)){flush();blocks.push(<hr key={blocks.length} className="ai-md-rule"/>);continue;}
  const ordered=/^\s*\d+[.)]\s+(.*)$/.exec(line),bullet=/^\s*[-*+]\s+(.*)$/.exec(line);
  if(ordered||bullet){
   if(paragraph.length)flush();
   const next=Boolean(ordered);
   if(list&&list.ordered!==next)flush();
   if(!list)list={ordered:next,items:[]};
   list.items.push((ordered??bullet)![1]);
   continue;
  }
  const quote=/^>\s?(.*)$/.exec(line);
  if(quote){flush();blocks.push(<blockquote key={blocks.length} className="ai-md-quote">{inline(quote[1])}</blockquote>);continue;}
  if(list)flush();
  paragraph.push(line);
 }
 flush();
 if(code&&code.length)blocks.push(<pre key={blocks.length} className="ai-md-code"><code>{code.join('\n')}</code></pre>);
 return <>{blocks}</>;
}
