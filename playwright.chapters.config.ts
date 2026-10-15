import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests',testMatch:'chapters.spec.ts',timeout:60000,workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:5187',headless:true,reducedMotion:'reduce',launchOptions:{executablePath:process.env.CHROMIUM_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:{command:'npm run dev -- --port 5187 --strictPort',url:'http://127.0.0.1:5187',reuseExistingServer:false,env:{VITE_API_BASE_URL:'http://127.0.0.1:3001'}}
});
