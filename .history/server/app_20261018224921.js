const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 解析 JSON 请求体（API 需要）
app.use(express.json());

// 托管前端静态文件（将根目录作为静态资源目录）
app.use(express.static(path.join(__dirname, '..')));

// 数据库连接
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

// 基础路由（访问 http://localhost:3000 会显示 index.html）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 启动服务
app.listen(port, () => {
  console.log(`🚀 服务已启动，端口 ${port}`);
  console.log(`🌐 访问 http://localhost:${port} 打开系统`);
});