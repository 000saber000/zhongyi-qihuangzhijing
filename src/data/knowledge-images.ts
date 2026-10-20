import yinYang from '../assets/jade/yin-yang.webp';
import guizhiTang from '../assets/jade/guizhi-tang.webp';
import caseLearning from '../assets/jade/case-learning.webp';
import bencao from '../assets/jade/classic-bencao.webp';
import huangdi from '../assets/jade/classic-huangdi.webp';
import jingui from '../assets/jade/classic-jingui.webp';
import nanjing from '../assets/jade/classic-nanjing.webp';
import qianjin from '../assets/jade/classic-qianjin.webp';
import shanghan from '../assets/jade/classic-shanghan.webp';
import shennong from '../assets/jade/classic-shennong.webp';
import wenbing from '../assets/jade/classic-wenbing.webp';
import botanical from '../assets/jade/botanical-specimens.webp';
import physicians from '../assets/jade/physician-portraits.webp';
import theory from '../assets/jade/cards-theory.webp';
import herbs from '../assets/jade/cards-herbs.webp';
import formulas from '../assets/jade/cards-formulas.webp';
import meridians from '../assets/jade/cards-meridians.webp';
import extraMeridians from '../assets/jade/cards-meridians-extra.webp';
import acupoints from '../assets/jade/cards-acupoints.webp';
import diagnosis from '../assets/jade/cards-diagnosis.webp';
import expandedAcupoints from '../assets/jade/cards-acupoints-expanded.webp';

export const knowledgeIllustrations:Record<string,string>={
 'classic-wenbing':wenbing,
 'theory-yinyang':yinYang,'formula-guizhi':guizhiTang,
 'case-learning':caseLearning,'classic-bencao':bencao,
 'classic-huangdi':huangdi,'classic-jingui':jingui,
 'classic-nanjing':nanjing,'classic-qianjin':qianjin,
 'classic-shanghan':shanghan,'classic-shennong':shennong
};

export type KnowledgeImageAsset={src:string;columns:number;rows:number;index:number;width:number;height:number};
export const knowledgeImages:Record<string,KnowledgeImageAsset>=Object.fromEntries(Object.entries(knowledgeIllustrations).map(([id,src])=>[id,{src,columns:1,rows:1,index:0,width:512,height:512}]));
function addAtlas(src:string,columns:number,rows:number,width:number,height:number,ids:string[]){
 ids.forEach((id,index)=>{knowledgeImages[id]={src,columns,rows,index,width,height};});
}
addAtlas(botanical,3,2,1200,800,['herb-guizhi','herb-baishao','herb-chaihu','herb-gancao','herb-huangqi','herb-danggui']);
addAtlas(physicians,3,2,1200,800,['person-zhangzhongjing','person-sunsimiao','person-lishizhen','person-huatuo','person-yetianshi']);
addAtlas(theory,3,3,1254,1254,['theory-five-elements','theory-zangxiang','concept-yingwei','concept-qi-blood','theory-jingluo','concept-qi','concept-blood','concept-jinye']);
addAtlas(herbs,4,4,1254,1254,['herb-shengjiang','herb-dazao','herb-renshen','herb-huanglian','herb-chuanxiong','herb-fuling','herb-baizhu','herb-banxia','herb-chenpi','herb-bohe','herb-juhua','herb-gouqizi','herb-maidong','herb-wuweizi']);
addAtlas(formulas,3,2,1500,1000,['formula-xiaochaihu','formula-mahuang','formula-sijunzi','formula-liuwei','formula-yinqiao']);
addAtlas(meridians,4,4,1254,1254,['meridian-stomach','meridian-lung','meridian-largeintestine','meridian-spleen','meridian-heart','meridian-smallintestine','meridian-bladder','meridian-kidney','meridian-pericardium','meridian-sanjiao','meridian-gallbladder','meridian-liver','meridian-du','meridian-ren']);
addAtlas(extraMeridians,2,1,1024,512,['meridian-chong','meridian-dai']);
addAtlas(acupoints,4,5,1122,1402,['point-zusanli','point-baihui','point-yintang','point-fengchi','point-jianjing','point-quchi','point-hegu','point-neiguan','point-waiguan','point-shenmen','point-shanzhong','point-zhongwan','point-guanyuan','point-qihai','point-yanglingquan','point-yinlingquan','point-sanyinjiao','point-taichong','point-yongquan','point-taixi']);
addAtlas(diagnosis,3,2,1500,1000,['method-bazheng','method-four-diagnostics','method-six-channel','method-weiying','method-sanjiao']);

// Hand-painted landmark illustrations, in the same order as the point catalog.
addAtlas(expandedAcupoints,5,8,1400,2240,["point-zhongfu","point-chize","point-lieque","point-taiyuan","point-shousanli","point-jianyu","point-yingxiang","point-tianshu","point-dubi","point-fenglong","point-neiting","point-taibai","point-xuehai","point-shaohai","point-tongli","point-houxi","point-jianzhen","point-tianzong","point-tianzhu","point-feishu","point-pishu","point-shenshu","point-weizhong","point-chengshan","point-kunlun","point-fuliu","point-quze","point-daling","point-laogong","point-yangchi","point-jianliao","point-huantiao","point-xuanzhong","point-zulinqi","point-ququan","point-qimen","point-shenque","point-tiantu","point-mingmen","point-dazhui"]);
