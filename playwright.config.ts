import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:60000,workers:1,use:{baseURL:'http://127.0.0.1:5173',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH || "/usr/bin/chromium",args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]}},webServer:[
 {command:'npm --prefix server start',url:'http://127.0.0.1:3001/healthz',reuseExistingServer:false,env:{DATABASE_URL:process.env.TEST_DATABASE_URL||'postgres://postgres:qihuang_test@127.0.0.1:55432/qihuang_test',ALLOWED_ORIGINS:'http://127.0.0.1:5173',PORT:'3001'}},
 {command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:false,env:{VITE_API_BASE_URL:'http://127.0.0.1:3001'}}
],reporter:'list'});
