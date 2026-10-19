const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');

// 加载 .env 环境变量配置
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 测试数据库连接
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功！');
  }
});

// 基础路由
app.get('/', (req, res) => {
  res.send('图书馆座位预约系统后端已启动！');
});

// 启动服务
app.listen(port, () => {
  console.log(`🚀 服务已启动，端口 ${port}`);
});