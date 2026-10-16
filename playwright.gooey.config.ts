import {chromium,defineConfig} from '@playwright/test';
import base from './playwright.navigation.config';
export default defineConfig({...base,testMatch:['gooey-navigation.spec.ts','library-navigation.spec.ts','navigation-layout.spec.ts'],use:{...base.use,launchOptions:{...base.use?.launchOptions,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()}}});
