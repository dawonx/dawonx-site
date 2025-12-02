// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // site: 'https://yourusername.github.io',
  // base: '/dawonx-astro',  // Remove for local dev, add back for GitHub Pages
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ko'],
    routing: {
      prefixDefaultLocale: false
    }
  }
});
