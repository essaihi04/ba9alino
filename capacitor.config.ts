import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ba9alino.app',
  appName: 'Ba9alino',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://ba9alino.duckdns.org',
    cleartext: false,
  },
}

export default config
