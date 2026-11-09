const { spawn, execSync, exec } = require('child_process');
const http = require('http');

console.log('');
console.log('====================================================');
console.log('  🌿 Clarity Content Engine 啟動中...');
console.log('====================================================');
console.log('');

// 1. Clean up ports 3002 and 5174 if previously hung
try {
  process.stdout.write('正在檢查並釋放通訊埠 (3002, 5174)... ');
  execSync(
    'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3002,5174 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"',
    { stdio: 'ignore' }
  );
  console.log('✓ 完成');
} catch (_) {
  console.log('（無佔用）');
}

// 2. Open browser once Vite is ready
let opened = false;
function openBrowser() {
  if (opened) return;
  opened = true;
  console.log('🌐 正在開啟瀏覽器：http://localhost:5174');
  exec('start "" "http://localhost:5174"', (err) => {
    if (err) {
      exec('powershell -NoProfile -Command "Start-Process \'http://localhost:5174\'"');
    }
  });
}

// Poll Vite server
const pollInterval = setInterval(() => {
  const req = http.get('http://localhost:5174', (res) => {
    if (res.statusCode) {
      clearInterval(pollInterval);
      openBrowser();
    }
  });
  req.on('error', () => {
    // Vite not ready yet
  });
}, 500);

// Fallback: open browser after 4 seconds anyway
setTimeout(() => {
  if (!opened) {
    clearInterval(pollInterval);
    openBrowser();
  }
}, 4000);

console.log('正在啟動 Vite 前端與 Express 後端...');
console.log('※ 提示：使用期間請保持此視窗開啟；關閉視窗即可退出。');
console.log('----------------------------------------------------');

// 3. Start npm run dev
const child = spawn('cmd.exe', ['/c', 'npm run dev'], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('error', (err) => {
  console.error('啟動失敗:', err);
});

child.on('close', (code) => {
  console.log(`\n服務已結束 (結束代碼: ${code})`);
});
