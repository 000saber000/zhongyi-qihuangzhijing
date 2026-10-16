import {defineConfig} from '@playwright/test';
import base from './playwright.gooey.config';
export default defineConfig({...base,testMatch:['star-picking.spec.ts','domain-navigation.spec.ts','gooey-navigation.spec.ts','library-navigation.spec.ts','navigation-layout.spec.ts','universe-transitions.spec.ts']});
