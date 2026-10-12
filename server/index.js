const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'clarity-content-engine' });
});

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../dist')));

async function startServer() {
  try {
    await initDatabase();
    console.log('✓ SQLite 資料庫初始化完成 (content_engine.db)');

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🌿 Clarity Content Engine 後端已就緒: http://localhost:${PORT}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('啟動失敗:', error);
    process.exit(1);
  }
}

startServer();
