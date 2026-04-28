const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

// โหลด .env ที่ root โปรเจกต์ (ไม่ commit ค่าจริง — ใช้ .env.example เป็นตัวอย่าง)
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

/** ค่า default = Django ที่เครื่อง — ถ้าใช้ ngrok ให้ตั้งใน .env หรือตอนรัน: REACT_APP_API_BASE_URL=... npm start */
const REACT_APP_API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/';
const REACT_APP_LIFF_ENDPOINT_URL =
  process.env.REACT_APP_LIFF_ENDPOINT_URL || 'http://localhost:8000';

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
