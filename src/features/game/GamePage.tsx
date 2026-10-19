import {useRef} from 'react';
import {ArrowLeft} from 'lucide-react';
import './game.css';

export default function GamePage({onBack}:{onBack:()=>void}){
 const frame=useRef<HTMLIFrameElement>(null);
 const embed=()=>{
  const document=frame.current?.contentDocument;
  if(!document||document.querySelector('style[data-embed]'))return;
  const style=document.createElement('style');
  style.dataset.embed='';
  style.textContent='#exterior-hud .brand-mini{display:none}.hud-left{margin-left:110px}@media(max-width:700px){.hud-left{margin-left:0;padding-left:108px}.hud-brand{display:none}}';
  document.head.append(style);
 };
 return <section className="game-page" aria-label="岐黄堂小游戏">
  <iframe ref={frame} src="/game/index.html?v=6.1" title="岐黄堂 · 急症候 / 行医录" allow="autoplay; fullscreen" onLoad={embed}/>
  <button type="button" className="game-back" onClick={onBack} aria-label="返回知识宇宙"><ArrowLeft size={15}/><span>知识宇宙</span></button>
 </section>;
}
