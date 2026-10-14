import {Bookmark} from 'lucide-react';
import {categoryLabel,type Knowledge} from '../data/catalog';
import {knowledgeIllustrations} from '../data/knowledge-images';
export {knowledgeIllustrations} from '../data/knowledge-images';
import './antique-book.css';

export function AntiqueBook({item,saved=false}:{item:Knowledge;saved?:boolean}){
 const illustration=knowledgeIllustrations[item.id];
 return <div className={`antique-book knowledge-artwork tone-${item.type}`} aria-hidden="true">
  <div className="book-back"/>
  <div className="book-page-block"/>
  <div className="book-paper book-endpaper">
   <span className="book-paper-heading">{item.title}</span>
   <p className="book-paper-copy">{item.summary}</p>
   <span className="book-paper-imprint">岐黄知境 · 知识导读</span>
  </div>
  {[0,1].map(page=><div key={page} className={`book-paper book-turning-page book-turning-page-${page}`}>
   <span className="book-paper-heading">{item.title}</span>
   <p className="book-paper-copy">{item.summary}</p>
  </div>)}
  <div className="book-front">
   <div className="book-cover-outside">
    <span className="book-frame"/>
    <span className="book-title-slip"><span>{item.title}</span><small>岐黄藏书</small></span>
    <span className="book-cover-category">{categoryLabel(item.type)} · 珍藏导读</span>
    {illustration&&<picture className="card-illustration book-cover-art" data-image-id={item.id} data-image-src={illustration}><img src={illustration} loading="lazy" alt="" width={116} height={116} decoding="async"/></picture>}
    <span className="book-cover-seal">岐黄</span>
    <span className="book-cover-edition">一卷一境 · 开卷有知</span>
    {saved&&<Bookmark size={16} className="book-saved" fill="currentColor"/>}
   </div>
   <div className="book-cover-inside book-paper">
    <span className="book-inner-frame"/>
    <span className="book-inner-title">{item.title}</span>
    <span className="book-inner-note">循经典之脉 · 入岐黄之境</span>
    <span className="book-inner-seal">藏</span>
   </div>
  </div>
  <span className="book-binding">{[0,1,2,3].map(stitch=><i key={stitch}/>)}</span>
 </div>;
}
