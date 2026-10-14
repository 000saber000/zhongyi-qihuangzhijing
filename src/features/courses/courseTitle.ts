import type {Course} from '../../data/catalog';
export const courseBookTitle=(course:Course)=>course.title.split('：')[0];
