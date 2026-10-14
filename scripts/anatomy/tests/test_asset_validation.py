import importlib.util,json,struct,tempfile,unittest
from pathlib import Path
module_path=Path(__file__).parents[1]/'verify-assets.py'
spec=importlib.util.spec_from_file_location('verify_assets',module_path)
verify=importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)

def glb(path,indices=6,image=None):
 data={'asset':{'version':'2.0'},'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1}]}], 'accessors':[{'count':4,'min':[-.3,0,-.1],'max':[.3,1.8,.15]},{'count':indices}]}
 if image:data['images']=[{'uri':image}]
 raw=json.dumps(data).encode();raw+=b' '*(-len(raw)%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(raw))+struct.pack('<II',len(raw),0x4e4f534a)+raw)

class AssetValidation(unittest.TestCase):
 def test_reads_triangle_budget_height_and_real_digest(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'model.glb';glb(p)
   result=verify.inspect_glb(p)
   self.assertEqual(result['triangles'],2)
   self.assertAlmostEqual(result['height'],1.8)
   self.assertEqual(len(result['sha256']),64)
 def test_rejects_external_texture_and_excessive_geometry(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'model.glb';glb(p,image='https://example.com/skin.jpg')
   with self.assertRaisesRegex(ValueError,'external'):verify.inspect_glb(p)
   glb(p,indices=150003)
   with self.assertRaisesRegex(ValueError,'triangle'):verify.inspect_glb(p)
 def test_rejects_broken_container(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'model.glb';p.write_bytes(b'not a glb')
   with self.assertRaises(ValueError):verify.inspect_glb(p)
if __name__=='__main__':unittest.main()
