import {cp,mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises';

const source=new URL('../dist/',import.meta.url);
const publish=new URL('../public/',import.meta.url);
const html=await readFile(new URL('index.html',source),'utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match=>match[1]);
if(!assets.some(path=>path.endsWith('.js'))||!assets.some(path=>path.endsWith('.css'))){
 throw new Error('Expected a Vite production entry with external JavaScript and CSS');
}
for(const path of assets)await stat(new URL(path.slice(1),source));

// Local compatibility output for the `render-compatible` production test
// project. The Render static site publishes dist/ directly, so public/ and the
// generated qihuang-unified.html entry stay untracked.
await mkdir(publish,{recursive:true});
await rm(new URL('assets/',publish),{recursive:true,force:true});
await cp(new URL('assets/',source),new URL('assets/',publish),{recursive:true});
await cp(new URL('licenses/',source),new URL('licenses/',publish),{recursive:true});
await writeFile(new URL('index.html',publish),html);
await writeFile(new URL('../qihuang-unified.html',import.meta.url),html);
console.log('Prepared split release in public/ with a compatible qihuang-unified.html entry.');
