import type {MutableRefObject} from 'react';
import type {Course} from '../../data/catalog';
export type CourseSelection={course:Course;origin:DOMRect;trigger:HTMLElement};
export type CourseVisualHandle={layer:HTMLDialogElement;tilt:(id:string|null,x:number,y:number)=>void;open:(selection:CourseSelection,slot:HTMLElement)=>{finished:Promise<void>;cancel:()=>void}};
export type CourseVisualRef=MutableRefObject<CourseVisualHandle|null>;
