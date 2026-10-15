import {defineConfig} from '@playwright/test';
import base from './playwright.meridians.config';
export default defineConfig({...base,testMatch:['navigation-layout.spec.ts','library-navigation.spec.ts'],webServer:{command:'npm run dev -- --port 5183',url:'http://127.0.0.1:5183',reuseExistingServer:false,env:{VITE_API_BASE_URL:'http://127.0.0.1:3001'}}});
