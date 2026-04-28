const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

// โหลด .env ที่ root โปรเจกต์ (ไม่ commit ค่าจริง — ใช้ .env.example เป็นตัวอย่าง)
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

/**
 * Build-time env สำหรับ frontend
 * - production: ถ้าไม่ตั้งจะปล่อยว่าง แล้ว src/config จะ fallback เป็น same-origin
 * - development: สามารถตั้ง .env ให้ชี้ localhost/ngrok ได้
 */
const REACT_APP_API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';
const REACT_APP_LIFF_ENDPOINT_URL = process.env.REACT_APP_LIFF_ENDPOINT_URL || '';

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      title: 'Samsung Panich Delivery',
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({
        REACT_APP_API_BASE_URL,
        REACT_APP_LIFF_ENDPOINT_URL,
        REACT_APP_LIFF_ID: process.env.REACT_APP_LIFF_ID || '2008347227-Bd7D38KD',
        REACT_APP_ENVIRONMENT: process.env.REACT_APP_ENVIRONMENT || 'development',
        REACT_APP_ENABLE_PAYMENT: process.env.REACT_APP_ENABLE_PAYMENT || 'true',
        REACT_APP_ENABLE_TRACKING: process.env.REACT_APP_ENABLE_TRACKING || 'true',
        REACT_APP_ENABLE_NOTIFICATIONS: process.env.REACT_APP_ENABLE_NOTIFICATIONS || 'true',
      }),
    }),
  ],
  devServer: {
    host: '0.0.0.0', // docker / LAN
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 3000,
    hot: true,
    historyApiFallback: true,
    allowedHosts: 'all', // Allow all hosts for development
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};
