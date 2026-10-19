/* ========== 用户表格（从后端获取） ========== */
function renderUserTable(filter) {
    filter = filter || '';
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = '<tr><td colspan="7">加载中...</td></tr>';

    const token = localStorage.getItem('token');
    
    fetch('/api/users', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(res => {
        if (!res.ok) throw new Error('请求失败');
        return res.json();
    })
    .then(users => {
        if (!Array.isArray(users)) users = [];
        
        // ★★★ 关键修复：将后端获取的用户列表同步到本地存储 ★★★
        setUsers(users);
        
        if (filter) {
            const lower = filter.toLowerCase();
            users = users.filter(u => (u.studentId || '').toLowerCase().includes(lower) || (u.name || '').toLowerCase().includes(lower));
        }
        
        if(users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">暂无用户数据</td></tr>';
            updateSelectedCount();
            // ★★★ 刷新统计 ★★★
            updateStats();
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td><input type="checkbox" class="user-check" value="${u.id}" onchange="updateSelectedCount()"></td>
                <td>${u.id}</td>
                <td>${u.name}</td>
                <td>${u.studentId || '-'}</td>
                <td><span class="status-tag ${u.credit < 60 ? 'status-banned' : 'status-normal'}">${u.credit ?? 100}</span></td>
                <td><span class="status-tag ${u.banned ? 'status-banned' : 'status-normal'}">${u.banned ? '封禁' : '正常'}</span></td>
                <td>
                    <button class="btn btn-xs btn-outline" onclick="toggleUserBan(${u.id})">${u.banned ? '解封' : '封禁'}</button>
                    <button class="btn btn-xs btn-outline" onclick="resetUserCredit(${u.id})">重置信用分</button>
                </td>
            </tr>
        `).join('');
        updateSelectedCount();
        // ★★★ 刷新统计 ★★★
        updateStats();
    })
    .catch(err => {
        tbody.innerHTML = '<tr><td colspan="7">加载失败，请检查后端服务</td></tr>';
        console.error('获取用户失败', err);
    });
}