import {knowledgeImages} from '../data/knowledge-images';

export function KnowledgeImage({id,className='',secondary=false}:{id:string;className?:string;secondary?:boolean}){
 const image=knowledgeImages[id];if(!image)return null;
 const marker={'data-image-id':id,'data-image-src':image.src,'data-image-cell':`${image.columns},${image.rows},${image.index}`};
 if(image.columns===1&&image.rows===1)return <picture {...marker} className={`knowledge-image ${secondary?'':'card-illustration'} ${className}`}><img src={image.src} alt="" width={image.width} height={image.height} decoding="async" loading="lazy"/></picture>;
 const width=image.width/image.columns,height=image.height/image.rows,x=image.index%image.columns*width,y=Math.floor(image.index/image.columns)*height;
 return <svg {...marker} className={`knowledge-image ${className}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
  <svg width={width} height={height} viewBox={`${x} ${y} ${width} ${height}`} overflow="hidden"><image href={image.src} width={image.width} height={image.height}/></svg>
 </svg>;
}
