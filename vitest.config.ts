import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * 单测跑在普通 Node 里，不启动 Electron。
 * 覆盖率只卡在纯逻辑文件上，避免为了凑数字去测界面壳。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        'src/main/preset/PresetMatcher.ts': { lines: 90, functions: 90 },
        'src/main/preset/TemplatePathResolver.ts': { lines: 90, functions: 90 },
        'src/main/preset/builtinTemplates.ts': { lines: 80 },
        'src/main/agent/triggers/**': { lines: 85, functions: 85 },
        'src/main/agent/intake.ts': { lines: 85 },
        'src/main/model/**': { lines: 90 },
        'src/main/userpref/userMarkdown.ts': { lines: 85 },
        'src/main/userpref/evaluateHabits.ts': { lines: 90 }
      }
    }
  }
});
