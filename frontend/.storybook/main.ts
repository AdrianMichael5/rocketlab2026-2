import type { StorybookConfig } from '@storybook/react-vite'
import { mergeConfig } from 'vite'

// O iframe do Storybook (runtime + React + stories) passa de 1 MB; é ferramenta de
// desenvolvimento, não o bundle do app, então o aviso padrão de 500 kB não se aplica.
const CHUNK_SIZE_WARNING_KB = 1500

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  // Reaproveita o vite.config.ts do app (plugin React, CSS Modules).
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, { build: { chunkSizeWarningLimit: CHUNK_SIZE_WARNING_KB } }),
}

export default config
