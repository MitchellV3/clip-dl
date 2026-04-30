import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'clip-dl',
    description: 'description',
    permissions: ['nativeMessaging', "storage", "downloads"],
    web_accessible_resources: [
      {
        matches: ['https://www.youtube.com/*'],
        resources: ['/sfx/*.wav'],
      },
    ],

  },
  vite: () => ({
    plugins: [tailwindcss() as any],
    resolve: {
      tsconfigPaths: true,
    },

  }),
});
