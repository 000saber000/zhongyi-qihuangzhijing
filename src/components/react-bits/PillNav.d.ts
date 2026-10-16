import type {CSSProperties,ElementType,MouseEvent,ReactNode} from 'react';
type PillNavItem={label:string;href?:string;icon?:ReactNode;ariaLabel?:string;title?:string};
type PillNavProps={
 items:PillNavItem[];logo?:string|ReactNode;logoAlt?:string;logoHref?:string;activeHref?:string;activeIndex?:number;defaultActiveIndex?:number;
 onItemClick?:(item:PillNavItem,index:number,event:MouseEvent<HTMLElement>)=>void;linkComponent?:ElementType;
 theme?:'dark'|'light';layout?:'split'|'joined';itemStyle?:'pill'|'plain';hoverEffect?:'fill'|'glide'|'none';indicator?:'dot'|'pill'|'none';surface?:'glass'|'solid'|'none';size?:'sm'|'md'|'lg';
 highlightColor?:string;highlightTextColor?:string;barColor?:string;textColor?:string;bounce?:number;stretch?:number;collapse?:'auto'|'always'|'never';onMenuToggle?:(open:boolean)=>void;intro?:boolean;ariaLabel?:string;className?:string;style?:CSSProperties;
};
export default function PillNav(props:PillNavProps):ReactNode;
