import {defineConfig} from '@playwright/test';
import base from './playwright.meridians.config';
export default defineConfig({...base,testMatch:['course-card-swap.spec.ts','course-orbit.spec.ts'],use:{...base.use,launchOptions:{...base.use?.launchOptions,executablePath:process.env.CHROMIUM_PATH||base.use?.launchOptions?.executablePath}}});
