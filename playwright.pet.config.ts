import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'pet.spec.ts',timeout:30000,workers:1,
 use:{baseURL:'http://127.0.0.1:5173',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']},viewport:{width:1180,height:820}},
 webServer:{command:'npx vite --host 127.0.0.1',url:'http://127.0.0.1:5173',reuseExistingServer:false},reporter:'list'
});
