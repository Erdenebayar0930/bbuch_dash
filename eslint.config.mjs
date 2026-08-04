// eslint.config.mjs
import nextConfig from 'eslint-config-next/core-web-vitals'

export default [
  ...nextConfig,
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts'
    ]
  }
]
