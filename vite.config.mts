import { defineConfig, UserConfig, ConfigEnv } from 'vite';
import path from 'path';

export default defineConfig((env: ConfigEnv): UserConfig => {
  let common: UserConfig = {
    server: {
      port: 5000,
      cors: true,
    },
    preview: {
      port: 5000,
      cors: true,
    },
    root: './',
    base: './',
    publicDir: './public',
    assetsInclude: ['**/*.vert', '**/*.frag'],
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@framework': path.resolve(__dirname, '../../../Framework/src'),
      }
    },
    build: {
      target: 'baseline-widely-available',
      assetsDir: 'assets',
      outDir: './dist',
      emptyOutDir: false,
      sourcemap: env.mode == 'development' ? true : false,
    },
  };
  return common;
});
