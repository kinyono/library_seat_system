// 推荐算法单元测试（直接 eval recommend.js 逻辑）
const fs = require('fs');
const code = fs.readFileSync(__dirname + '/public/js/recommend.js', 'utf8');
global.window = {};
const vm = require('vm');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Recommend = sandbox.window.Recommend;

const seats = [
  { id: 1, code: 'A-01', floor: 1, area: 'quiet', has_power: true, status: 'free', enabled: true },
  { id: 2, code: 'A-02', floor: 1, area: 'quiet', has_power: false, status: 'free', enabled: true },
  { id: 3, code: 'B-01', floor: 2, area: 'window', has_power: true, status: 'free', enabled: true },
  { id: 4, code: 'B-02', floor: 2, area: 'discuss', has_power: false, status: 'used', enabled: true }, // 占用
  { id: 5, code: 'C-01', floor: 3, area: 'window', has_power: true, status: 'free', enabled: false },  // 禁用
];

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; console.log('  ✅ ' + msg); } else { fail++; console.log('  ❌ ' + msg); } }

console.log('\n[推荐算法测试]');
const ctx = { floor: '1', prefArea: 'quiet', usageMap: { 'A-01': 5, 'B-01': 2 } };

const recs = Recommend.getRecommendations(seats, ctx, 3);
assert(recs.length <= 3, `返回数量限制 (实际${recs.length})`);
assert(recs.every(r => r.score <= 100), '得分不超过100');
assert(recs.every(r => r.score >= 0), '得分非负');
// 占用/禁用座位不应被推荐
assert(!recs.find(r => r.seat.code === 'B-02'), '占用座位(B-02)不被推荐');
assert(!recs.find(r => r.seat.code === 'C-01'), '禁用座位(C-01)不被推荐');
// 降序排列
assert(recs.every((r, i) => i === 0 || recs[i-1].score >= r.score), '按得分降序排列');
// 偏好区域 + 电源 的 A-01 应排第一
assert(recs[0].seat.code === 'A-01', `偏好区域有电源的座位排第一 (实际: ${recs[0].seat.code})`);

const s = Recommend.scoreSeat(seats[0], ctx);
assert(s >= 0 && s <= 100, `单座打分范围正常 (A-01=${s})`);

// 禁用/占用座位得分 -1
assert(Recommend.scoreSeat(seats[3], ctx) === -1, '占用座位得分-1');
assert(Recommend.scoreSeat(seats[4], ctx) === -1, '禁用座位得分-1');

// summary
const sum = Recommend.summary(seats, ctx);
assert(typeof sum === 'string' && sum.includes('A-01'), `summary 生成正常: ${sum}`);

// 空座位场景
const empty = Recommend.summary([], ctx);
assert(empty.includes('无空闲'), `空库提示正常: ${empty}`);

// 使用频次加分验证：A-01 使用5次应高于 B-01 使用2次（其他条件相近）
const rec2 = Recommend.getRecommendations(seats, { floor: 'all', prefArea: 'quiet', usageMap: { 'A-01': 5, 'B-01': 2 } }, 10);
const a01 = rec2.find(r => r.seat.code === 'A-01');
const b01 = rec2.find(r => r.seat.code === 'B-01');
assert(a01 && b01 && a01.score > b01.score, `使用频次高加分生效 (A-01:${a01.score} > B-01:${b01.score})`);

console.log(`\n通过: ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
