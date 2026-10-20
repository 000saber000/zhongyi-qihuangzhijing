import {useState} from 'react';
import {Play,ArrowUpRight} from 'lucide-react';
import type {Knowledge} from '../data/catalog';
import videos from '../data/knowledge-videos.json';
import './knowledge-video.css';

type Video={title:string;bvid:string;source:string;page?:number};
const catalog:Record<string,Video>=videos;
export default function KnowledgeVideo({item}:{item:Knowledge}){
 const [playing,setPlaying]=useState<string|null>(null);
 const video=catalog[item.id];
 if(!video)return <section className="knowledge-video" aria-label={`${item.title}视频讲解`}><div className="knowledge-video-heading"><Play size={15}/><h3>视频讲解</h3></div><p className="knowledge-video-topic">{item.title}</p><a href={`https://search.bilibili.com/all?keyword=${encodeURIComponent(item.title+' 中医 教学')}`} target="_blank" rel="noopener noreferrer">查找该条目的视频讲解 <ArrowUpRight size={14}/></a><small className="knowledge-video-help">此新增条目尚未收录讲解视频。</small></section>;
 const active=playing===item.id;
 return <section className="knowledge-video" aria-label={`${item.title}视频讲解`}>
  <div className="knowledge-video-heading"><Play size={15}/><h3>视频讲解</h3><span>哔哩哔哩</span></div>
  <p className="knowledge-video-topic">{item.title} · {item.type==='穴'?'穴位定位学习':'知识导读'}</p>
  {active?<iframe key={item.id} title={`${item.title}视频讲解播放器`} src={`https://player.bilibili.com/player.html?bvid=${video.bvid}&page=${video.page??1}&autoplay=0`} allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<button className="knowledge-video-play" onClick={()=>setPlaying(item.id)} aria-label={`播放${item.title}视频讲解`}><span><Play size={23}/></span><b>播放视频讲解</b><small>点击加载播放器</small></button>}
  <p className="knowledge-video-title">{video.title}</p><small className="knowledge-video-source">{video.source}</small>
  <a href={`https://www.bilibili.com/video/${video.bvid}/?p=${video.page??1}`} target="_blank" rel="noopener noreferrer">在 B 站观看完整视频 <ArrowUpRight size={14}/></a>
  <small className="knowledge-video-help">若站内播放受限，可前往 B 站观看。视频用于知识学习。</small>
 </section>;
}
