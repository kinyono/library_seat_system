const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 托管前端静态文件（让前端页面可以直接访问）
app.use(express.static(path.join(__dirname, '..')));

// 导入路由
const authRoutes = require('./routes/auth');
const seatRoutes = require('./routes/seats');
const bookingRoutes = require('./routes/bookings');
const statsRoutes = require('./routes/stats');

// 注册 API 路由
app.use('/api/auth', authRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/stats', statsRoutes);

// 基础路由（访问根路径返回 index.html）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务
app.listen(port, () => {
  console.log(`🚀 服务已启动，端口 ${port}`);
  console.log(`🌐 访问 http://localhost:${port}`);
});