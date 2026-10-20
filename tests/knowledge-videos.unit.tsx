import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import KnowledgeVideo,{videoPlayerUrl} from '../src/components/KnowledgeVideo';
import videos from '../src/data/knowledge-videos.json';
import knowledge from '../src/data/knowledge.json';
import definitions from '../src/features/meridians/acupoints.json';
const catalog:Record<string,{title:string;bvid:string;page?:number}>=videos;
test('every seed knowledge item and model acupoint has a valid video and chapter',()=>{
 for(const id of new Set([...knowledge.map(k=>k.id),...definitions.map(d=>d.knowledgeId)]))assert.ok(catalog[id],id);
 assert.equal(Object.keys(catalog).length,141);
 for(const [id,v] of Object.entries(catalog)){assert.match(v.bvid,/^BV[1-9A-HJ-NP-Za-km-z]{10}$/u,id);assert.ok(Number.isInteger(v.page??1)&&(v.page??1)>0,id);}
});
test('each detail renders its corresponding video without loading frames before a click',()=>{
 for(const item of knowledge){const html=renderToStaticMarkup(<KnowledgeVideo item={item}/>),v=catalog[item.id];assert.ok(html.includes(`${item.title}视频讲解`));assert.ok(html.includes(`/video/${v.bvid}/?p=${v.page??1}`));assert.ok(!html.includes('<iframe'));}
});
test('course selections account for gaps in diagnostic lecture numbers',()=>{
 assert.equal(catalog['method-zangfu-gandan'].page,28);assert.equal(catalog['method-zangfu-fei'].page,35);assert.equal(catalog['method-weiying'].page,42);assert.equal(catalog['herb-guizhi'].page,19);assert.equal(catalog['herb-baishao'].page,73);
});
test('unknown published items have an explicit search fallback',()=>{
 const item={...knowledge[0],id:'future-item',title:'新条目 & 内容'},html=renderToStaticMarkup(<KnowledgeVideo item={item}/>);assert.ok(html.includes('此新增条目尚未收录讲解视频'));assert.ok(html.includes(encodeURIComponent(item.title+' 中医 教学')));assert.ok(!html.includes('player.bilibili.com'));
});

test('embedded player uses the current official p parameter for the selected lecture',()=>{
 const url=new URL(videoPlayerUrl(videos['herb-baishao']));assert.equal(url.searchParams.get('p'),'73');assert.equal(url.searchParams.has('page'),false);assert.equal(url.searchParams.get('autoplay'),'0');
});
