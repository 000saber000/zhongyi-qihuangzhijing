import {copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function bundledShiyunLicense():Plugin{
 let source='',destination='',reactSource='',reactDestination='';
 return {name:'bundled-shiyun-license',apply:'build',
  configResolved(config){source=resolve(config.root,'third-party/SHIYUN-LICENSE.md');destination=resolve(config.root,config.build.outDir,'licenses');reactSource=resolve(config.root,'third-party/REACT-BITS-LICENSE.md');reactDestination=resolve(destination,'react-bits.txt');},
  async writeBundle(){await mkdir(destination,{recursive:true});await copyFile(source,resolve(destination,'shiyun-MIT.txt'));await copyFile(reactSource,reactDestination);}
 };
}

export default defineConfig({plugins:[react(),bundledShiyunLicense()],publicDir:false,server:{port:5173,strictPort:true}});
