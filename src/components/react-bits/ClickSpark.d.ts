import type {CSSProperties,ForwardRefExoticComponent,ReactNode,RefAttributes} from 'react';

export type ClickSparkShape='line'|'streak'|'dot'|'star';
export type ClickSparkEasing='ease-out'|'ease-in-out'|'ease-in'|'linear'|'spring';
export type ClickSparkHandle={spark:(x?:number,y?:number)=>void};
export type ClickSparkEvent={clientX:number;clientY:number;detail:number;currentTarget:HTMLElement};

type ClickSparkProps={
 sparkColor?:string|string[];shape?:ClickSparkShape;sparkCount?:number;sparkSize?:number;sparkWidth?:number;sparkRadius?:number;duration?:number;
 easing?:ClickSparkEasing;randomness?:number;gravity?:number;spread?:number;direction?:number;glow?:number;ring?:boolean;
 layer?:'front'|'back';extraScale?:number;disabled?:boolean;className?:string;style?:CSSProperties;children?:ReactNode;
};

declare const ClickSpark:ForwardRefExoticComponent<ClickSparkProps&RefAttributes<ClickSparkHandle>>;
export default ClickSpark;
