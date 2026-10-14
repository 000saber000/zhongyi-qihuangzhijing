"""Check exported GLB budgets, self-contained resources and immutable digests."""
import hashlib,json,struct,sys
from pathlib import Path

def inspect_glb(path):
 path=Path(path);raw=path.read_bytes()
 if len(raw)<20:raise ValueError('broken GLB header')
 magic,version,total=struct.unpack_from('<III',raw)
 if magic!=0x46546c67 or version!=2 or total!=len(raw):raise ValueError('broken GLB container')
 chunk_size,chunk_type=struct.unpack_from('<II',raw,12)
 if chunk_type!=0x4e4f534a or 20+chunk_size>len(raw):raise ValueError('broken GLB JSON chunk')
 try:data=json.loads(raw[20:20+chunk_size])
 except (ValueError,UnicodeDecodeError) as error:raise ValueError('broken GLB JSON') from error
 if data.get('asset',{}).get('version')!='2.0':raise ValueError('unsupported GLB asset version')
 if any('uri' in x for x in data.get('images',[])+data.get('buffers',[])):raise ValueError('external resource in GLB')
 triangles=0;bounds=[]
 for mesh in data.get('meshes',[]):
  for primitive in mesh.get('primitives',[]):
   if primitive.get('mode',4)!=4:raise ValueError('unsupported triangle primitive')
   position=data['accessors'][primitive['attributes']['POSITION']]
   if 'indices' in primitive:count=data['accessors'][primitive['indices']]['count']
   else:count=position['count']
   triangles+=count//3
   if 'min' in position and 'max' in position:bounds.append((position['min'],position['max']))
 if triangles<1 or triangles>50000:raise ValueError('triangle budget exceeded or empty geometry')
 if len(raw)>4000000:raise ValueError('file exceeds 4 MB budget')
 if not bounds:raise ValueError('missing geometry bounds')
 minimum=[min(b[0][i] for b in bounds) for i in range(3)];maximum=[max(b[1][i] for b in bounds) for i in range(3)]
 return {'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'triangles':triangles,'height':maximum[1]-minimum[1],'min':minimum,'max':maximum}

def verify_folder(folder):
 folder=Path(folder);results={}
 for variant in ['male','female']:
  p=folder/f'adult-{variant}-v1.glb';results[variant]=inspect_glb(p)
  if not 1.4<results[variant]['height']<2.1:raise ValueError(f'{variant}: incorrect metre/Y-up convention')
  if abs(results[variant]['min'][1])>.02:raise ValueError(f'{variant}: feet are not at origin')
  for view in ['front','side','back']:
   if not (folder/f'{variant}-{view}.png').is_file():raise ValueError(f'missing {variant} {view} preview')
 if results['male']['sha256']==results['female']['sha256']:raise ValueError('male and female models are identical')
 manifest=json.loads((folder/'models.manifest.json').read_text())
 for variant in ['male','female']:
  if manifest[variant]['sha256']!=results[variant]['sha256']:raise ValueError('stale model manifest digest')
 return results
if __name__=='__main__':
 try:print(json.dumps(verify_folder(sys.argv[1]),ensure_ascii=False,indent=2))
 except (ValueError,OSError,KeyError,IndexError) as error:print(str(error),file=sys.stderr);sys.exit(1)
