import type {Chapter} from '../../src/data/catalog';
import {BOOK_BODY_LIMIT,CHAPTER_BODY_LIMIT,CHAPTER_LIMIT} from '../../src/data/chapters';
import {HttpError,invalid} from './errors';

export function chapterContent(value:unknown):Chapter[]{
 if(!Array.isArray(value)||value.length>CHAPTER_LIMIT)throw invalid();
 let total=0;
 const chapters=value.map(chapter=>{
  if(!chapter||typeof chapter!=='object'||Array.isArray(chapter)||typeof chapter.title!=='string'||!chapter.title.trim()||chapter.title.length>120||typeof chapter.body!=='string'||chapter.body.length>CHAPTER_BODY_LIMIT)throw new HttpError(400,'BAD_CHAPTER','每章需填写标题（最多 120 字符），正文最多 50000 字符。');
  total+=chapter.body.length;return {title:chapter.title.trim(),body:chapter.body.trim()};
 });
 if(total>BOOK_BODY_LIMIT)throw new HttpError(400,'BOOK_TOO_LONG','全书正文最多 2000000 字符。');
 return chapters;
}
