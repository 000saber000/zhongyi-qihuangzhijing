import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/production',
 timeout:60000,
 workers:1,
 projects:[
  {name:'vite-dist',use:{baseURL:'http://127.0.0.1:4173'}},
  {name:'render-compatible',use:{baseURL:'http://127.0.0.1:4174'}}
 ],
 use:{
  baseURL:'http://127.0.0.1:4173',
  headless:true,
  reducedMotion:'reduce',
  viewport:{width:390,height:844},
  launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 },
 webServer:[
  {command:'npm run preview -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:false},
  {command:'npm run preview -- --port 4174 --strictPort --outDir public',url:'http://127.0.0.1:4174',reuseExistingServer:false}
 ],
 reporter:'list'
});
