"""Curated first expansion batch; rerunnable without overwriting existing editorial entries.
Locations are educational paraphrases of standard acupoint descriptions. Mesh positions
are projected separately by annotate-models.py, not derived from these text descriptions.
"""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
# id | title | code | meridian | location | learning context
rows='''
zhongfu|中府|LU1|lung|前胸壁外上方，第一肋间隙处，前正中线旁开六骨度分寸。|肺经的胸部腧穴。辨认胸廓与上肢交界，是理解肺经体表分布的起点。
chize|尺泽|LU5|lung|肘前区，肘横纹上，肱二头肌腱桡侧的凹陷处。|肺经合穴。可与肘横纹尺侧的少海、中央附近的曲泽作位置比较。
lieque|列缺|LU7|lung|前臂桡侧，腕掌侧远端横纹上一点五骨度分寸，肱桡肌腱与拇长展肌腱之间。|肺经络穴，也是八脉交会穴之一。学习时区分前臂桡侧与正中掌侧的位置。
taiyuan|太渊|LU9|lung|腕前外侧，桡骨茎突与舟骨之间，拇长展肌腱尺侧的凹陷处。|肺经原穴、输穴。与神门、大陵并看，可以理解腕部不同经脉的分区。
shousanli|手三里|LI10|largeintestine|前臂后外侧，阳溪与曲池连线上，肘横纹下二骨度分寸。|大肠经前臂部腧穴。名称中的“手”有助于与胃经的足三里区别。
jianyu|肩髃|LI15|largeintestine|肩峰端前缘与肱骨大结节之间，三角肌上部中央，肩外展时肩峰前下方凹陷处。|大肠经肩部腧穴。可与肩髎比较，认识肩峰前后两个不同的凹陷。
yingxiang|迎香|LI20|largeintestine|面部，鼻翼外缘中点旁，鼻唇沟中。|大肠经面部腧穴。学习时联系大肠经从手走头的体表循行。
tianshu|天枢|ST25|stomach|腹部，脐中央旁开二骨度分寸，左右各一穴。|胃经腹部腧穴。与正中的神阙对照，建立腹部横向骨度分寸的概念。
dubi|犊鼻|ST35|stomach|膝前区，髌韧带外侧的凹陷处，屈膝时更易辨认。|胃经膝部腧穴。模型保持伸膝姿势，实际定位需要结合屈膝体表标志。
fenglong|丰隆|ST40|stomach|小腿前外侧，外踝尖上八骨度分寸，胫骨前肌外缘。|胃经络穴。可与足三里比较，认识同一经脉在小腿上的纵向分布。
neiting|内庭|ST44|stomach|足背，第二、第三趾间，趾蹼缘后方赤白肉际处。|胃经荥穴。观察足趾间隙时，应以人体自身趾序辨认第二、第三趾。
taibai|太白|SP3|spleen|足内侧，第一跖趾关节近端，赤白肉际处的凹陷中。|脾经原穴、输穴。它位于足内缘，与足背第一、第二跖骨间的太冲位置不同。
xuehai|血海|SP10|spleen|股前区，髌底内侧端上二骨度分寸，股内侧肌隆起处。|脾经大腿部腧穴。可结合股内侧肌的形态理解，不把它误放到膝关节内侧。
shaohai|少海|HT3|heart|肘前内侧，肘横纹内侧端与肱骨内上髁连线的中点处。|心经合穴。比较少海与尺泽，有助于辨认心经和肺经在肘部的内外分布。
tongli|通里|HT5|heart|前臂前内侧，腕掌侧远端横纹上一骨度分寸，尺侧腕屈肌腱桡侧缘。|心经络穴。与腕横纹处的神门相邻，可沿前臂尺侧观察二者的关系。
houxi|后溪|SI3|smallintestine|手内侧，第五掌指关节尺侧近端，赤白肉际处的凹陷中。|小肠经输穴，也是八脉交会穴之一。它靠近小指侧，区别于拇指侧的合谷。
jianzhen|肩贞|SI9|smallintestine|肩后区，肩关节后下方，腋后纹头直上一骨度分寸。|小肠经肩后部腧穴。观察时需转到人体背面，辨认腋后纹与肩关节的关系。
tianzong|天宗|SI11|smallintestine|肩胛区，肩胛冈中点与肩胛骨下角连线的上三分之一与下三分之二交点凹陷处。|小肠经肩胛部腧穴。先辨认肩胛冈和下角，再理解它位于冈下窝的区域。
tianzhu|天柱|BL10|bladder|颈后区，第二颈椎棘突上缘同高，斜方肌外缘的凹陷中。|膀胱经颈后部腧穴。它与更靠近枕骨外侧的风池位置不同。
feishu|肺俞|BL13|bladder|背部，第三胸椎棘突下缘同高，后正中线旁开一点五骨度分寸。|膀胱经背俞穴之一。名称关联传统藏象知识，位置学习以胸椎序数和旁开距离为线索。
pishu|脾俞|BL20|bladder|背部，第十一胸椎棘突下缘同高，后正中线旁开一点五骨度分寸。|膀胱经背俞穴之一。可与肺俞、肾俞对照，建立背部由上到下的位置关系。
shenshu|肾俞|BL23|bladder|腰部，第二腰椎棘突下缘同高，后正中线旁开一点五骨度分寸。|膀胱经背俞穴之一。它与同高后正中线上的命门相互参照。
weizhong|委中|BL40|bladder|膝后区，腘横纹中点。|膀胱经合穴。转到背面可观察膝后区；模型不展示深部神经血管定位。
chengshan|承山|BL57|bladder|小腿后区，腓肠肌两肌腹与肌腱交角处。|膀胱经小腿后部腧穴。学习时关注腓肠肌由肌腹向肌腱过渡的形态。
kunlun|昆仑|BL60|bladder|踝后外侧，外踝尖与跟腱之间的凹陷处。|膀胱经经穴。可与内踝后方的太溪对照，避免把内外踝的位置混淆。
fuliu|复溜|KI7|kidney|小腿后内侧，内踝尖上二骨度分寸，跟腱前缘。|肾经经穴。可沿太溪向上比较，注意其定位线索涉及跟腱前缘。
quze|曲泽|PC3|pericardium|肘前区，肘横纹上，肱二头肌腱尺侧缘的凹陷处。|心包经合穴。与肌腱桡侧的尺泽对照，可理解肘前腧穴的相对关系。
daling|大陵|PC7|pericardium|腕前区，腕掌侧远端横纹上，掌长肌腱与桡侧腕屈肌腱之间。|心包经原穴、输穴。与内关沿前臂掌侧中部相连，是比较腕与前臂定位的线索。
laogong|劳宫|PC8|pericardium|手掌心，第二、第三掌骨之间，偏于第三掌骨桡侧。|心包经荥穴。学习时把掌骨关系作为定位线索，避免仅凭手掌外形估计。
yangchi|阳池|TE4|sanjiao|腕后区，腕背侧远端横纹上，指伸肌腱尺侧缘的凹陷处。|三焦经原穴。位于腕背侧，可与腕掌侧的大陵作前后对照。
jianliao|肩髎|TE14|sanjiao|肩部，肩峰角与肱骨大结节之间，肩外展时肩峰后下方凹陷处。|三焦经肩部腧穴。可与肩髃比较，辨认肩峰后下方与前下方的差别。
huantiao|环跳|GB30|gallbladder|臀部，股骨大转子最凸点与骶管裂孔连线的外三分之一与内三分之二交点处。|胆经臀部腧穴。学习时需要从侧后方观察骨性标志之间的空间关系。
xuanzhong|悬钟|GB39|gallbladder|小腿外侧，外踝尖上三骨度分寸，腓骨前缘。|胆经小腿部腧穴，又称绝骨。与小腿内侧的三阴交可作内外位置对照。
zulinqi|足临泣|GB41|gallbladder|足背，第四、第五跖骨底结合部前方，小趾伸肌腱外侧的凹陷处。|胆经输穴，也是八脉交会穴之一。名称中的“足”用于与头临泣区分。
ququan|曲泉|LR8|liver|膝内侧，腘横纹内侧端，半腱肌与半膜肌肌腱内侧前缘的凹陷处。|肝经合穴。它位于膝内侧偏后区域，区别于小腿内侧的阴陵泉。
qimen|期门|LR14|liver|胸部，第六肋间隙，前正中线旁开四骨度分寸。|肝经胸部腧穴。应以肋间隙和正中线为线索，不能单凭乳房外形定位。
shenque|神阙|CV8|ren|腹部，脐中央，前正中线上。|任脉腹部腧穴。脐中央是腹部骨度分寸的重要参照，可联系中脘、气海和关元学习。
tiantu|天突|CV22|ren|颈前区，胸骨上窝中央，前正中线上。|任脉颈前部腧穴。通过胸骨上窝这一体表标志认识颈与胸的交界。
mingmen|命门|GV4|du|腰部，第二腰椎棘突下凹陷中，后正中线上。|督脉腰部腧穴。可与两侧的肾俞比较，认识背部正中线与旁开腧穴的关系。
dazhui|大椎|GV14|du|颈后区，第七颈椎棘突下凹陷中，后正中线上。|督脉颈背交界处腧穴。椎体序数需结合体表标志辨认，三维模型仅作区域示意。
'''
points_path=root/'src/features/meridians/acupoints.json'
knowledge_path=root/'src/data/knowledge.json'
points=json.loads(points_path.read_text());knowledge=json.loads(knowledge_path.read_text())
point_ids={p['knowledgeId'] for p in points};knowledge_ids={p['id'] for p in knowledge};additions=[]
meridian_titles={k['id']:k['title'] for k in knowledge}
for row in rows.strip().splitlines():
 ident,title,code,meridian,location,context=row.split('|');ident='point-'+ident;mid='meridian-'+meridian
 prefix=''.join(c for c in code if c.isalpha())
 source=f'https://www.kmcric.com/database/acupoint/{prefix}/{code}'
 if ident not in point_ids:
  points.append(dict(knowledgeId=ident,referenceCode=code,meridianId=mid,sides=['midline'] if prefix in ['CV','GV'] else ['left','right'],locationText=location,detailLevel='detail',review=dict(source=source,section=f'{code} 标准位置学习摘要；三维模型为体表区域示意，非临床定位',checkedAt='2026-10-15')))
 entry=dict(id=ident,type='穴',title=title,subtitle=f'{code} · {meridian_titles[mid]}腧穴',summary=context,source=f'WHO 西太平洋地区标准腧穴定位（2008）；KMCRIC {code} 位置条目',tags=['穴位',meridian_titles[mid],code],relations=[mid,'theory-jingluo','classic-huangdi'],confidence='标准定位/学习摘要',body=f'{title}（{code}）属于{meridian_titles[mid]}。\n\n定位线索：{location}\n\n{context}\n\n骨度分寸是按身体比例划分的定位单位。三维位置用于空间学习，具体定位应结合体表标志与标准资料。\n\n位置参考：{source}',keyPoints=[location,context])
 additions.append(entry)
 if ident not in knowledge_ids:knowledge.append(entry)
points_path.write_text(json.dumps(points,ensure_ascii=False,indent=2)+'\n');knowledge_path.write_text(json.dumps(knowledge,ensure_ascii=False,indent=2)+'\n')
# Existing installations need a versioned data migration; never republish or replace
# an editor's draft/unpublished/existing entry. Fresh installations are also idempotent.
payload=json.dumps(additions,ensure_ascii=False,separators=(',',':'))
(root/'server/migrations/006-acupoint-expansion.sql').write_text("-- First expansion batch: preserve every existing editorial record.\nINSERT INTO knowledge_entries(id,draft,published)\nSELECT entry->>'id', entry, entry\nFROM jsonb_array_elements($acupoints$"+payload+"$acupoints$::jsonb) AS entry\nON CONFLICT (id) DO NOTHING;\n")
print('POINTS',len(points),'ADDED_BATCH',len(additions))
