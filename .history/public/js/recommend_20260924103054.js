(function (global) {
    'use strict';

    const AREA_BONUS = { quiet: 18, window: 14, discuss: 10 };
    const AREA_FALLBACK = 3;

    function scoreSeat(seat, ctx) {
        if (!seat.enabled || seat.status !== 'free') return -1;
        var score = 52;
        if (seat.has_power) score += 14;
        var pref = (ctx && ctx.prefArea) || 'quiet';
        if (seat.area === pref) score += AREA_BONUS[pref] || AREA_BONUS.quiet;
        else score += AREA_FALLBACK;
        var floorPref = ctx && ctx.floor && ctx.floor !== 'all' ? Number(ctx.floor) : null;
        if (floorPref !== null) {
            if (Number(seat.floor) === floorPref) score += 12;
            else score -= Math.abs(Number(seat.floor) - floorPref) * 3;
        } else {
            score -= (Number(seat.floor) - 1) * 2;
        }
        var usage = (ctx && ctx.usageMap && ctx.usageMap[seat.code]) || 0;
        score += Math.min(Math.round(Math.sqrt(usage) * 3), 8);
        score += Math.floor(Math.random() * 3);
        return Math.max(0, Math.min(100, score));
    }

    function getRecommendations(seats, ctx, limit) {
        if (!Array.isArray(seats)) return [];
        ctx = ctx || {};
        limit = limit || 3;
        return seats
            .map(function (seat) { return { seat: seat, score: scoreSeat(seat, ctx) }; })
            .filter(function (x) { return x.score >= 0; })
            .sort(function (a, b) {
                if (b.score !== a.score) return b.score - a.score;
                if (a.seat.has_power !== b.seat.has_power) return a.seat.has_power ? -1 : 1;
                return String(a.seat.code).localeCompare(String(b.seat.code));
            })
            .slice(0, limit)
            .map(function (x) {
                var reasons = [];
                var pref = ctx.prefArea || 'quiet';
                if (x.seat.area === pref) reasons.push('偏好区域');
                if (x.seat.has_power) reasons.push('有电源');
                reasons.push(x.seat.floor + 'F');
                return { seat: x.seat, score: x.score, reasons: reasons };
            });
    }

    global.Recommend = { getRecommendations: getRecommendations, scoreSeat: scoreSeat };
})(window);
