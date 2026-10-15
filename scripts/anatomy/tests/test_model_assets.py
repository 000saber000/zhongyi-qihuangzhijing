import hashlib, json, struct, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]

class ModelAssets(unittest.TestCase):
 def test_full_detail_models_embed_the_supplied_texture_and_use_distinct_coordinates(self):
  manifest=json.loads((ROOT/'src/assets/anatomy/models.manifest.json').read_text())
  for variant,height in [('male',1.78),('female',1.70)]:
   model=manifest[variant]
   self.assertEqual(model['id'],f'adult-{variant}-v4')
   raw=(ROOT/'src/assets/anatomy'/model['sourceFile']).read_bytes()
   size=struct.unpack_from('<I',raw,12)[0];data=json.loads(raw[20:20+size])
   triangles=sum(data['accessors'][p['indices']]['count']//3 for m in data['meshes'] for p in m['primitives'])
   self.assertGreater(triangles,280000)
   self.assertLessEqual(triangles,320000)
   self.assertLessEqual(len(raw),14000000)
   self.assertEqual(hashlib.sha256(raw).hexdigest(),model['sha256'])
   self.assertAlmostEqual(model['height'],height)
   self.assertTrue(all('uri' not in image for image in data.get('images',[])))
   self.assertTrue(any(data['bufferViews'][image['bufferView']]['byteLength']>50000 for image in data['images']))
   self.assertTrue(all('TEXCOORD_0' in p['attributes'] for m in data['meshes'] for p in m['primitives']))

 def test_routes_are_rebound_to_current_models_and_have_fine_branches_without_large_gaps(self):
  manifest=json.loads((ROOT/'src/assets/anatomy/models.manifest.json').read_text())
  routes=json.loads((ROOT/'src/features/meridians/paths.json').read_text())
  for variant in ['male','female']:
   subset=[p for p in routes if p['variant']==variant]
   self.assertEqual(len({p['meridianId'] for p in subset if p.get('role')=='primary'}),14)
   self.assertGreater(len([p for p in subset if p.get('role')=='secondary']),20)
   for path in subset:
    self.assertEqual(path['modelSha256'],manifest[variant]['sha256'])
    for a,b in zip(path['points'],path['points'][1:]):
     self.assertLess(sum((x-y)**2 for x,y in zip(a,b))**.5,.04)

 def test_primary_routes_reach_the_annotated_points_of_the_same_meridian(self):
  definitions={d['knowledgeId']:d for d in json.loads((ROOT/'src/features/meridians/acupoints.json').read_text())}
  paths=json.loads((ROOT/'src/features/meridians/paths.json').read_text())
  for anchor in json.loads((ROOT/'src/features/meridians/anchors.json').read_text()):
   meridian=definitions[anchor['knowledgeId']]['meridianId']
   if not meridian:continue
   points=[p for route in paths if route['modelId']==anchor['modelId'] and route['meridianId']==meridian and route['side']==anchor['side'] and route.get('role')=='primary' for p in route['points']]
   self.assertLess(min(sum((x-y)**2 for x,y in zip(p,anchor['position']))**.5 for p in points),.012,anchor['knowledgeId'])

if __name__=='__main__':unittest.main()
