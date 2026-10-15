import type {Chapter,Knowledge} from './catalog';

export const CHAPTER_LIMIT=500;
export const CHAPTER_BODY_LIMIT=50000;
export const BOOK_BODY_LIMIT=2000000;
export const chaptersFrom=(item:Pick<Knowledge,'chapters'|'body'>):Chapter[]=>item.chapters??(item.body?.trim()?[{title:'正文',body:item.body}]:[]);
