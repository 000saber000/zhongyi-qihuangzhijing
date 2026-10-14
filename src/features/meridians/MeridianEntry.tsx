import {Component,lazy,Suspense,type ReactNode} from 'react';
const MeridianPage=lazy(()=>import('./MeridianPage'));
class PageBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="empty"><h2>经络云图暂未能打开</h2><p>可以重新打开页面，或先到知识库阅读穴位知识。</p><button className="primary" onClick={()=>location.reload()}>重新打开经络云图</button><button className="outline" onClick={()=>{location.hash='library';}}>打开知识库</button></div>:this.props.children;}
}
export default function MeridianEntry(props:Parameters<typeof MeridianPage>[0]){return <PageBoundary><Suspense fallback={<div className="universe-loading">正在展开经络云图…</div>}><MeridianPage {...props}/></Suspense></PageBoundary>;}
