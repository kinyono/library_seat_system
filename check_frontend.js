const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');

let pass = 0, fail = 0;
const errors = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; errors.push(name + (detail ? `  (${detail})` : '')); console.log(`  ❌ ${name}${detail ? '  (' + detail + ')' : ''}`); }
}

console.log('\n[1] 文件存在性检查');
const required = [
  'public/index.html',
  'public/css/style.css',
  'public/css/login.css',
  'public/css/dashboard.css',
  'public/css/recommend.css',
  'public/js/api.js',
  'public/js/app.js',
  'public/js/recommend.js',
  'public/js/dashboard.js',
  'public/pages/dashboard.html',
];
required.forEach(f => check(`文件存在: ${f}`, fs.existsSync(path.join(ROOT, f))));

console.log('\n[2] index.html 引用检查');
const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
check('引用 css/style.css', html.includes('css/style.css'));
check('引用 css/login.css', html.includes('css/login.css'));
check('引用 js/api.js', html.includes('js/api.js'));
check('引用 js/app.js', html.includes('js/app.js'));
check('角色选择 radio', html.includes('name="role"'));
check('演示一键填入按钮 fillDemo', html.includes('fillDemo'));
check('错误提示区 loginError', html.includes('loginError'));

console.log('\n[3] dashboard.html 引用检查');
const dashHtml = fs.readFileSync(path.join(PUBLIC, 'pages/dashboard.html'), 'utf8');
check('引用 recommend.css', dashHtml.includes('recommend.css'));
check('引用 recommend.js', dashHtml.includes('recommend.js'));
check('引用 dashboard.js', dashHtml.includes('js/dashboard.js'));
check('统计卡片 statFree', dashHtml.includes('statFree'));
check('推荐列表 recommendList', dashHtml.includes('recommendList'));
check('偏好选择 prefArea', dashHtml.includes('prefArea'));
check('Toast 容器', dashHtml.includes('toastContainer'));
check('倒计时面板 timerPanel', dashHtml.includes('timerPanel'));

console.log('\n[4] JS 语法检查 (node --check)');
function checkSyntax(file) {
  try { require('child_process').execSync(`node --check "${path.join(ROOT, file)}"`, { stdio: 'pipe' }); return true; }
  catch (e) { return false; }
}
['public/js/api.js','public/js/app.js','public/js/recommend.js','public/js/dashboard.js'].forEach(f => {
  check(`语法正确: ${f}`, checkSyntax(f));
});

console.log('\n[5] recommend.js 接口检查');
const rec = fs.readFileSync(path.join(PUBLIC, 'js/recommend.js'), 'utf8');
check('导出 getRecommendations', rec.includes('getRecommendations'));
check('导出 scoreSeat', rec.includes('scoreSeat'));
check('导出 summary', rec.includes('summary'));
check('区域偏好加权', rec.includes('AREA_WEIGHT'));
check('电源加分', rec.includes('has_power'));

console.log('\n[6] dashboard.js 功能检查');
const dash = fs.readFileSync(path.join(PUBLIC, 'js/dashboard.js'), 'utf8');
check('使用 api.listSeats', dash.includes('api.listSeats'));
check('使用 api.createBooking (一人一座)', dash.includes('api.createBooking'));
check('使用 api.myBookings', dash.includes('api.myBookings'));
check('使用 api.startAway', dash.includes('api.startAway'));
check('使用 api.returnSeat', dash.includes('api.returnSeat'));
check('使用 api.timeoutBooking', dash.includes('api.timeoutBooking'));
check('使用 Recommend.getRecommendations', dash.includes('Recommend.getRecommendations'));
check('computeUsage 使用频次', dash.includes('computeUsage'));
check('renderStats 占用率', dash.includes('statRate') && dash.includes('rate ='));
check('showToast', dash.includes('showToast'));
check('startCountdown', dash.includes('startCountdown'));
check('stopCountdown (返回暂停计时)', dash.includes('stopCountdown'));
check('selectSeat 显示推荐度', dash.includes('detailScore'));
check('activeBooking 状态判断', dash.includes('ACTIVE_STATUS'));

console.log('\n[7] api.js 接口完整性');
const api = fs.readFileSync(path.join(PUBLIC, 'js/api.js'), 'utf8');
['/auth/login','/seats','/seats/stats','/bookings','createBooking','checkIn','startAway','returnSeat','cancelBooking','timeoutBooking','/rules'].forEach(k => {
  check(`接口: ${k}`, api.includes(k));
});

console.log('\n[8] CSS 关键样式检查');
const style = fs.readFileSync(path.join(PUBLIC, 'css/style.css'), 'utf8');
check('Toast 样式 .toast', style.includes('.toast'));
check('统计卡片 .stats-row', style.includes('.stats-row'));
check('推荐徽标 .badge-recommend', style.includes('.badge-recommend'));
check('骨架屏 .skeleton', style.includes('.skeleton'));
const loginCss = fs.readFileSync(path.join(PUBLIC, 'css/login.css'), 'utf8');
check('角色切换 .role-switch', loginCss.includes('.role-switch'));
check('浮动卡片动画', loginCss.includes('slideUp'));
const recCss = fs.readFileSync(path.join(PUBLIC, 'css/recommend.css'), 'utf8');
check('推荐列表 .recommend-list', recCss.includes('.recommend-list'));
check('评分条 .score-bar', recCss.includes('.score-bar'));

console.log(`\n========================================`);
console.log(`通过: ${pass} / ${pass + fail}`);
if (fail) { console.log('\n失败项:'); errors.forEach(e => console.log('  - ' + e)); process.exit(1); }
else console.log('🎉 全部检查通过');
