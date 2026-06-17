// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // 确定性 gate：违规即 error，禁止滥用 inline-disable（V4 §4.1）
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'off', // main.ts 的 run log 走 console，允许
    },
  },
);
