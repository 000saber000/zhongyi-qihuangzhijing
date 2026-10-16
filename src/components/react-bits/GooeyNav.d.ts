import type {CSSProperties,ReactNode} from 'react';
type GooeyNavItem={label:string;href?:string;icon?:ReactNode;value?:string};
type GooeyNavProps={
 items:GooeyNavItem[];initialActiveIndex?:number;activeIndex?:number;onChange?:(index:number,item:GooeyNavItem)=>void;
 theme?:'dark'|'light';color?:string;activeTextColor?:string;colors?:string[];size?:'sm'|'md'|'lg';frame?:boolean;
 animationTime?:number;particleCount?:number;timeVariance?:number;spread?:number;gooeyness?:number;wobble?:number;hoverEffect?:boolean;
 className?:string;style?:CSSProperties;
};
export default function GooeyNav(props:GooeyNavProps):ReactNode;
