const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/index.ts',
    output: {
      filename: 'tk-text-highlight.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'TKTextHighlight',
        type: 'umd',
        export: 'default'
      },
      globalObject: 'this'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              // Production 模式下去除所有 console
              drop_console: isProduction,
              drop_debugger: isProduction
            }
          }
        })
      ]
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map'
  };
};

