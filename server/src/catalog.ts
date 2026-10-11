import {knowledge,courses} from '../../src/data/catalog';
export const knowledgeIds=new Set(knowledge.map(item=>item.id));
export const lessonIds=new Set(courses.flatMap(course=>course.lessons.map((_,index)=>course.id+'-'+index)));
