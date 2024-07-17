/* globals process */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

const environment = process.env.ENV || 'development';
const isDevelopmentEnv = environment === 'development';

const config = [
  {
    input: 'lib/udf-compatible-datafeed.js',
    output: {
      name: 'Datafeeds',
      format: 'esm',
      file: 'dist/bundle.esm.js',
    },
    plugins: [
      nodeResolve(),
      !isDevelopmentEnv &&
        terser({
          ecma: 2018,
          output: { inline_script: true },
        }),
    ],
  },
];

export default config;
