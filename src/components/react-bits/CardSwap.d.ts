import type {ForwardRefExoticComponent,HTMLAttributes,PropsWithChildren,RefAttributes,ReactNode} from 'react';
export type CardSwapHandle={next:()=>void;prev:()=>void};
type CardSwapProps=PropsWithChildren<{
 items?:{title?:string;image?:string;icon?:ReactNode;alt?:string}[];
 width?:number;height?:number;cardDistance?:number;verticalDistance?:number;depth?:number;skewAmount?:number;visibleCards?:number;
 delay?:number;autoplay?:boolean;pauseOnHover?:boolean;draggable?:boolean;speed?:number;bounce?:number;parallax?:number;hoverSpread?:number;dim?:number;cardRadius?:number;intro?:boolean;
 theme?:'dark'|'light';onCardClick?:(index:number)=>void;onChange?:(index:number)=>void;className?:string;'aria-label'?:string;
}>;
export const Card:ForwardRefExoticComponent<HTMLAttributes<HTMLDivElement>&RefAttributes<HTMLDivElement>>;
declare const CardSwap:ForwardRefExoticComponent<CardSwapProps&RefAttributes<CardSwapHandle>>;
export default CardSwap;
