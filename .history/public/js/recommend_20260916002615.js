/**
 * recommend.js — 智能推荐座位算法
 * 评分维度：空闲状态(必选) + 电源 + 区域偏好 + 楼层偏好 + 远离拥挤 + 历史使用
 */
(function (global) {
    'use strict';

    const AREA_WEIGHT = { quiet: 3, discuss: 2, window: 2.5 };

    /**
     * 计算单个座位得分（0-100）
     */
    function scoreSeat(seat, ctx) {
        if (!seat.enabled || seat.status !== 'free') return -1;

        let score = 50; // 基础分

        // 电源加分
        if (seat.has_power) score += 15;

        // 区域偏好
        const prefArea = ctx.prefArea || 'quiet';
        if (seat.area === prefArea) score += AREA_WEIGHT[prefArea] * 4;
        else score += 3;

        // 楼层偏好（优先选中楼层，其次低楼层）
        if (ctx.floor && ctx.floor !== 'all' && seat.floor == ctx.floor) score += 12;
        score += (4 - seat.floor) * 2;

        // 远离拥挤：周围空闲座位越多越安静（简单用座位编号做抖动，实际可用坐标）
        const neighborFree = ctx.freeCount || 0;
        score += Math.min(neighborFree * 0.5, 8);

        // 历史使用加分（被预约次数越多说明位置好）
        const usage = ctx.usageMap ? (ctx.usageMap[seat.code] || 0) : 0;
        score += Math.min(usage * 2, 10);

        return Math.min(Math.round(score), 100);
    }

    /**
     * 获取推荐列表
     * @param {Array} seats 全部座位
     * @param {Object} ctx 上下文（floor, area, prefArea, usageMap）
     * @param {number} limit 返回条数
     */
    function getRecommendations(seats, ctx = {}, limit = 3) {
        const freeCount = seats.filter(s => s.enabled && s.status === 'free').length;
        const ctxFull = Object.assign({}, ctx, { freeCount });

        const scored = seats
            .map(seat => ({ seat, score: scoreSeat(seat, ctxFull) }))
            .filter(x => x.score >= 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ seat, score }) => ({
                seat,
                score,
                reasons: buildReasons(seat, ctxFull)
            }));

        return scored;
    }

    function buildReasons(seat, ctx) {
        const reasons = [];
        const prefArea = ctx.prefArea || 'quiet';
        if (seat.area === prefArea) reasons.push('偏好区域');
        if (seat.has_power) reasons.push('有电源');
        if (ctx.floor && ctx.floor !== 'all' && seat.floor == ctx.floor) reasons.push(`${seat.floor}F`);
        else reasons.push(`${seat.floor}F`);
        return reasons;
    }

    /**
     * 生成推荐文案（给统计侧栏用的一句话总结）
     */
    function summary(seats, ctx) {
        const free = seats.filter(s => s.enabled && s.status === 'free').length;
        const total = seats.length;
        if (free === 0) return `当前无空闲座位（共 ${total} 个）`;
        const recs = getRecommendations(seats, ctx, 1);
        if (!recs.length) return `空闲 ${free}/${total}，暂无推荐`;
        const top = recs[0];
        return `推荐 ${top.seat.code}（${top.score}分）· 空闲 ${free}/${total}`;
    }

    global.Recommend = { getRecommendations, scoreSeat, summary, buildReasons };
})(window);
