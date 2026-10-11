import raw from './knowledge.json';
export type Knowledge = typeof raw[number];
export const knowledge:Knowledge[]=raw;
export const categories=[{type:'全部',label:'全部知识',glyph:'知'},{type:'理',label:'基础理论',glyph:'理'},{type:'经',label:'中医经典',glyph:'经'},{type:'药',label:'本草药物',glyph:'草'},{type:'方',label:'方剂学',glyph:'方'},{type:'经络',label:'经络学说',glyph:'络'},{type:'穴',label:'腧穴知识',glyph:'穴'},{type:'法',label:'诊法辨证',glyph:'法'},{type:'人',label:'历代医家',glyph:'人'},{type:'案',label:'医案研读',glyph:'案'}];
export const categoryLabel=(type:string)=>categories.find(c=>c.type===type)?.label || type;
export const highlights=['theory-yinyang','classic-huangdi','herb-guizhi','formula-guizhi'];
export const keyPoints:Record<string,string[]>={
 'theory-yinyang':['阴阳首先是一种关系：昼与夜、动与静等概念，要放在同一语境中理解。','对立与依存同时存在，阴与阳不能脱离彼此孤立认识。','学习消长和转化时，关注变化的条件，避免简单地给所有事物贴标签。'],
 'theory-five-elements':['木、火、土、金、水构成五行模型，不是现代化学意义上的五种元素。','相生关系为木生火、火生土、土生金、金生水、水生木。','相克关系与相生关系共同构成联系；模型应结合具体知识语境学习。'],
 'classic-huangdi':['《素问》与《灵枢》构成《黄帝内经》的主要传世部分。','阅读时先识别篇章讨论的问题，再辨析术语在该篇章中的含义。','将阴阳、藏象、经络等主题与相关条目连接起来，建立自己的阅读索引。'],
 'formula-guizhi':['桂枝汤见于《伤寒论》，是学习经方关系的重要入口。','组成药物通常包括桂枝、芍药、生姜、大枣、甘草；这里用于方剂组成学习。','结合条文语境理解营卫关系，再比较方剂与药物的联系，避免脱离语境记忆。'],
 'herb-guizhi':['桂枝与肉桂属于不同药材条目，学习时应区分药用部位和教材表述。','通过桂枝汤等相关方剂认识药物之间的配伍关系。','药性与功用属于传统本草知识，应结合来源版本阅读。']
};
export const courses=[
 {id:'foundation',title:'中医入门：建立知识框架',level:'入门',desc:'从阴阳五行到气血津液，循序走进中医的整体观。',glyph:'阴',color:'green',lessons:['阴阳不是二分法','五行：在关系中理解万物','藏象与人体功能网络','气血津液的联系','八纲辨证的基本框架'],ids:['theory-yinyang','theory-five-elements','theory-zangxiang','concept-qi-blood','method-bazheng']},
 {id:'classic',title:'经典研读：从条文到方证',level:'进阶',desc:'以《伤寒论》为线索，连接经典、方剂与本草。',glyph:'经',color:'gold',lessons:['认识伤寒论','张仲景与经方','桂枝汤的知识链','小柴胡汤与少阳','回到经典阅读'],ids:['classic-shanghan','person-zhangzhongjing','formula-guizhi','formula-xiaochaihu','classic-jingui']},
 {id:'meridian',title:'经络腧穴：建立空间认知',level:'入门',desc:'从经脉到代表腧穴，让零散知识有迹可循。',glyph:'络',color:'rose',lessons:['认识经络学说','足阳明胃经','认识足三里','十二经脉的学习线索','经典中的经脉'],ids:['theory-jingluo','meridian-stomach','point-zusanli','meridian-lung','classic-huangdi']}
];
export type Course=typeof courses[number];
