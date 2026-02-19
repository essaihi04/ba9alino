import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ba9alino.app',
  appName: 'Ba9alino',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'http://87.106.1.128',
    cleartext: true,
  },
}

export default config
