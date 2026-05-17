const API_URL = '/api';
let state = { token: localStorage.getItem('token'), user: JSON.parse(localStorage.getItem('user')) };

// === ENTERPRISE UTILS ===
const SKILLS_LIST = [
    "React", "Node.js", "Python", "Java", "C++", "SQL", "UI/UX", "Figma", 
    "AWS", "Docker", "Machine Learning", "Data Science", "C#", "Unity", 
    "Angular", "Vue.js", "Swift", "Kotlin", "Go", "Rust", "TensorFlow", 
    "PyTorch", "Kubernetes", "Firebase", "MongoDB", "PostgreSQL", "Solidity"
];

const DEPARTMENTS_LIST = [
    "Computer Engineering", "Software Engineering", "Electrical Engineering", 
    "Industrial Design", "Management Information Systems", "Mathematics", 
    "Physics", "Civil Engineering", "Mechanical Engineering", "Psychology",
    "Digital Game Design", "Visual Communication Design"
];

function renderTagCloud(containerId, selectedSkills, isSelection = true) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const selected = selectedSkills ? selectedSkills.split(',').map(s => s.trim()) : [];
    container.innerHTML = (isSelection ? SKILLS_LIST : selected).map(skill => `
        <span class="skill-tag ${selected.includes(skill) ? 'active' : ''}" 
              ${isSelection ? `onclick="toggleSkill(this, '${containerId}')"` : ''}>
            ${skill}
        </span>
    `).join('');
}

window.toggleSkill = function(el, containerId) {
    el.classList.toggle('active');
    // Auto-trigger form check if it's a profile/project edit
    const btnId = containerId.includes('sp') ? 'sp-btn' : (containerId.includes('ip') ? 'ip-btn' : 'cp-btn');
    const btn = document.getElementById(btnId);
    if (btn) btn.disabled = false;
};

function getSelectedSkills(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .skill-tag.active`)).map(el => el.innerText).join(', ');
}

function toast(msg, type='suc') {
    const t = document.getElementById('toast');
    const d = document.createElement('div');
    d.className = `toast-item ${type}`;
    d.innerText = msg;
    t.appendChild(d);
    setTimeout(() => d.remove(), 4000);
}

// === MODAL SYSTEM ===
function showModal({ title, content, buttons }) {
    const overlay = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-container');
    
    container.innerHTML = `
        <div class="modal">
            <div class="modal-h">${title}</div>
            <div class="modal-body">${content}</div>
            <div class="modal-f">
                ${buttons.map((b, i) => `<button class="btn ${b.type === 'p' ? 'btn-p' : (b.type === 'dan' ? 'btn-dan' : 'btn-o')}" id="modal-btn-${i}">${b.text}</button>`).join('')}
            </div>
        </div>
    `;
    
    overlay.classList.add('on');
    
    buttons.forEach((b, i) => {
        document.getElementById(`modal-btn-${i}`).onclick = () => {
            if (b.action) b.action();
            if (!b.keepOpen) closeModal();
        };
    });
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('on');
}

async function apiFetch(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    
    try {
        const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        const data = await res.json();
        
        if (res.status === 403 && data.error && data.error.includes("deactivated by an Admin")) {
            logout();
            toast("Your account has been deactivated by an Admin.", "warn");
            throw new Error(data.error);
        }
        
        if (!res.ok) throw new Error(data.error || 'API Error');
        return data;
    } catch (err) {
        if (!err.message.includes("deactivated by an Admin")) {
            toast(err.message, 'warn');
        }
        throw err;
    }
}

// === AUTH ===
function toggleAuth(view) {
    document.getElementById('auth-login-view').style.display = view === 'login' ? 'block' : 'none';
    document.getElementById('auth-register-view').style.display = view === 'register' ? 'block' : 'none';
}

async function login() {
    const btn = document.querySelector('#auth-login-view button');
    btn.disabled = true; btn.innerText = "Signing In...";
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({email, password}) });
        state.token = data.token; state.user = data.user;
        localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
        toast('Logged in successfully');
        initApp();
    } catch (e) {}
    btn.disabled = false; btn.innerText = "Sign In";
}

async function register() {
    const btn = document.querySelector('#auth-register-view button');
    btn.disabled = true; btn.innerText = "Creating Account...";
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    try {
        await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({name, email, password, role}) });
        toast('Registered successfully! Please log in.');
        toggleAuth('login');
    } catch (e) {}
    btn.disabled = false; btn.innerText = "Create Account";
}

function logout() {
    state.token = null; state.user = null;
    localStorage.removeItem('token'); localStorage.removeItem('user');
    document.getElementById('app-view').classList.remove('on');
    document.getElementById('auth-view').classList.add('on');
}

// === NOTIFICATIONS ===
let notifInterval;
async function fetchNotifications() {
    if (!state.token) return;
    try {
        const notifs = await apiFetch('/notifications');
        const unread = notifs.filter(n => !n.is_read);
        const badge = document.getElementById('notif-badge');
        const list = document.getElementById('notif-list');
        if (!list) return;
        
        if (unread.length > 0) {
            badge.style.display = 'block';
            badge.innerText = unread.length;
        } else {
            badge.style.display = 'none';
        }
        
        const header = `<div style="padding:10px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:#fff">
            <span style="font-weight:700; font-size:14px">Notifications</span>
            ${unread.length > 0 ? `<span style="font-size:11px; color:var(--primary); cursor:pointer; font-weight:600" onclick="markAllRead()">Mark all as read</span>` : ''}
        </div>`;
        
        list.innerHTML = header + (notifs.length ? notifs.map(n => `
            <div style="padding:12px; border-bottom:1px solid var(--border-color); background:${n.is_read?'#fff':'#F9FAFB'}">
                <div style="font-size:13px; color:var(--text-main); font-weight:${n.is_read?'400':'600'}">${n.message}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px; display:flex; justify-content:space-between">
                    <span>${new Date(n.created_at).toLocaleDateString()}</span>
                    ${!n.is_read ? `<span style="color:var(--primary);cursor:pointer;" onclick="markRead(${n.id}, event)">Mark Read</span>` : ''}
                </div>
            </div>
        `).join('') : '<div style="padding:12px; font-size:13px; color:var(--text-muted)">No notifications</div>');
    } catch(e) {}
}

function toggleNotifs() {
    const el = document.getElementById('notif-dropdown');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function markRead(id, e) {
    e.stopPropagation();
    await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
    fetchNotifications();
}

async function markAllRead() {
    await apiFetch(`/notifications/read-all`, { method: 'PUT' });
    fetchNotifications();
}

// === APP INIT & NAVIGATION ===
function initApp() {
    if (!state.token) {
        document.getElementById('auth-view').classList.add('on');
        document.getElementById('app-view').classList.remove('on');
        clearInterval(notifInterval);
        return;
    }
    document.getElementById('auth-view').classList.remove('on');
    document.getElementById('app-view').classList.add('on');
    
    document.getElementById('nav-name').innerText = state.user.name;
    document.getElementById('nav-role').innerText = state.user.role.toUpperCase();
    document.getElementById('nav-av').innerText = state.user.name[0].toUpperCase();
    
    renderSidebar();
    fetchNotifications();
    notifInterval = setInterval(fetchNotifications, 10000);
}

const main = document.getElementById('main-content');
const title = document.getElementById('page-title');

function emptyState(msg) {
    return `<div style="text-align:center; padding:60px; color:var(--text-muted);">
        <div style="font-size:48px; margin-bottom:16px;">📭</div>
        <div style="font-size:16px; font-weight:500;">${msg}</div>
    </div>`;
}

function renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';
    const addLink = (text, view) => {
        const d = document.createElement('div');
        d.className = 'ni';
        d.innerText = text;
        d.onclick = () => {
            document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
            d.classList.add('active');
            loadView(view);
        };
        nav.appendChild(d);
        return d;
    };

    let defaultLink;
    if (state.user.role === 'admin') {
        defaultLink = addLink('Dashboard', 'admin-dash');
        addLink('Categories', 'admin-categories');
        addLink('Announcements', 'admin-announcements');
        addLink('Users', 'admin-users');
    } else if (state.user.role === 'instructor') {
        defaultLink = addLink('Dashboard', 'instructor-dash');
        addLink('Announcements', 'instructor-announcements');
        addLink('Advisor Requests', 'instructor-requests');
        addLink('My Profile', 'instructor-profile');
    } else if (state.user.role === 'student') {
        defaultLink = addLink('Dashboard', 'student-dash');
        addLink('Announcements', 'student-announcements');
        addLink('Projects Market', 'student-projects');
        addLink('My Projects', 'student-my-projects');
        addLink('Advisor Search', 'student-advisors');
        addLink('Student Search', 'student-search');
        addLink('My Profile', 'student-profile');
    }
    defaultLink.click();
}

function loadView(view) {
    if (view === 'admin-dash') renderAdminDash();
    else if (view === 'admin-categories') renderAdminCategories();
    else if (view === 'admin-announcements') renderAdminAnnouncements();
    else if (view === 'admin-users') renderAdminUsers();
    
    else if (state.user.role === 'instructor') {
        if (view === 'instructor-dash') renderInstructorDash();
        else if (view === 'instructor-announcements') renderInstructorAnnouncements();
        else if (view === 'instructor-profile') renderInstructorProfile();
        else if (view === 'instructor-requests') renderInstructorRequests();
    }
    else if (state.user.role === 'student') {
        if (view === 'student-dash') renderStudentDash();
        else if (view === 'student-announcements') renderStudentAnnouncements();
        else if (view === 'student-projects') renderStudentProjects();
        else if (view === 'student-my-projects') renderStudentMyProjects();
        else if (view === 'student-advisors') renderStudentAdvisors();
        else if (view === 'student-search') renderStudentSearch();
        else if (view === 'student-profile') renderStudentProfile();
    }
}

// === ADMIN VIEWS ===
async function renderAdminDash() {
    title.innerText = 'Admin Dashboard';
    main.innerHTML = `<div style="text-align:center; padding:40px;">Loading metrics...</div>`;
    const metrics = await apiFetch('/admin/metrics');
    main.innerHTML = `
        <div class="g3">
            <div class="card stat-card">
                <div class="stat-val" style="color:var(--primary)">${metrics.total_users}</div>
                <div class="stat-lbl">Total Users</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val" style="color:var(--success)">${metrics.total_projects}</div>
                <div class="stat-lbl">Total Projects</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val" style="color:var(--danger)">${metrics.total_categories}</div>
                <div class="stat-lbl">Categories</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val" style="color:var(--primary)">${metrics.total_applications}</div>
                <div class="stat-lbl">Success Matches</div>
            </div>
        </div>
    `;
}

async function renderAdminCategories() {
    title.innerText = 'Project Categories';
    main.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px">
            <div class="sec-hd" style="margin:0"><div class="sec-t">Platform Categories</div></div>
            <button class="btn btn-p" onclick="showAddCategoryModal()">+ Add Category</button>
        </div>
        <div id="cat-list">Loading...</div>
    `;
    const cats = await apiFetch('/admin/categories');
    const container = document.getElementById('cat-list');
    if (!cats.length) return container.innerHTML = emptyState("No categories found");
    
    container.innerHTML = `<div class="g2">` + cats.map(c => `
        <div class="card" style="padding:20px; border-top:3px solid var(--primary)">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <div class="sec-t" style="margin:0; font-size:18px;">${c.name}</div>
                    <div style="font-size:13px; color:var(--text-muted); margin-top:8px; display:flex; gap:12px;">
                        <span>👥 Team: <b>${c.team_size_constraint || 'N/A'}</b></span>
                        <span>💰 Budget: <b>${c.budget_constraint || 'N/A'}</b></span>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-o btn-sm" onclick='showEditCategoryModal(${JSON.stringify(c)})'>Edit</button>
                    <button class="btn btn-o btn-sm" style="color:var(--danger); border-color:var(--danger)" onclick="deleteCategory(${c.id})">Delete</button>
                </div>
            </div>
        </div>
    `).join('') + `</div>`;
}

window.showAddCategoryModal = function() {
    showModal({
        title: 'Add New Category',
        content: `
            <div class="fg"><label class="fl">Category Name</label><input class="fi" id="new-cat-name" placeholder="e.g. Research Project"></div>
            <div class="fg"><label class="fl">Team Size Constraint</label><input class="fi" id="new-cat-size" type="number" placeholder="e.g. 5"></div>
            <div class="fg"><label class="fl">Budget Constraint</label><input class="fi" id="new-cat-budget" placeholder="e.g. 5000 TL"></div>
        `,
        buttons: [
            { text: 'Cancel', type: 'o' },
            { text: 'Create Category', type: 'p', action: async () => {
                const name = document.getElementById('new-cat-name').value;
                const team_size_constraint = parseInt(document.getElementById('new-cat-size').value);
                const budget_constraint = document.getElementById('new-cat-budget').value;
                if (!name) return toast('Name is required', 'warn');
                await apiFetch('/admin/categories', { 
                    method: 'POST', 
                    body: JSON.stringify({ name, team_size_constraint, budget_constraint }) 
                });
                toast('Category created');
                renderAdminCategories();
            }}
        ]
    });
};

window.showEditCategoryModal = function(category) {
    showModal({
        title: 'Edit Category',
        content: `
            <div class="fg"><label class="fl">Category Name</label><input class="fi" id="edit-cat-name" value="${category.name || ''}"></div>
            <div class="fg"><label class="fl">Team Size Constraint</label><input class="fi" id="edit-cat-size" type="number" value="${category.team_size_constraint || ''}"></div>
            <div class="fg"><label class="fl">Budget Constraint</label><input class="fi" id="edit-cat-budget" value="${category.budget_constraint || ''}"></div>
        `,
        buttons: [
            { text: 'Cancel', type: 'o' },
            { text: 'Save Changes', type: 'p', action: async () => {
                const name = document.getElementById('edit-cat-name').value.trim();
                const teamSizeVal = document.getElementById('edit-cat-size').value;
                const team_size_constraint = teamSizeVal ? parseInt(teamSizeVal, 10) : null;
                const budget_constraint = document.getElementById('edit-cat-budget').value.trim() || null;
                if (!name) return toast('Category name is required', 'warn');
                await apiFetch(`/admin/categories/${category.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, team_size_constraint, budget_constraint })
                });
                toast('Category updated');
                renderAdminCategories();
            }}
        ]
    });
};

async function deleteCategory(id) {
    if (!confirm('Delete category?')) return;
    await apiFetch(`/admin/categories/${id}`, { method: 'DELETE' });
    toast('Category deleted');
    renderAdminCategories();
}

async function renderAdminAnnouncements() {
    title.innerText = 'Announcements';
    const cats = await apiFetch('/admin/categories');
    const announcements = await apiFetch('/admin/announcements');
    const catOpts = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    main.innerHTML = `
        <div class="card">
            <div class="sec-hd"><div class="sec-t">Create Announcement</div></div>
            <div class="fg"><label class="fl">Title</label><input class="fi" id="ann-title" oninput="checkAnnForm()"></div>
            <div class="fg"><label class="fl">Description</label><textarea class="fi" id="ann-desc" oninput="checkAnnForm()"></textarea></div>
            <div class="fg"><label class="fl">Category</label><select class="fi fsel" id="ann-cat"><option value="">General</option>${catOpts}</select></div>
            <button class="btn btn-p" id="ann-btn" disabled onclick="createAnnouncement()">Publish Announcement</button>
        </div>
        <div class="sec-hd"><div class="sec-t">Existing Announcements</div></div>
        <div>
            ${announcements.length ? announcements.map(a => `
                <div class="card" style="padding:18px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                        <div>
                            <div style="font-weight:700; font-size:16px;">${a.title}</div>
                            <div style="font-size:13px; color:var(--text-muted); margin-top:6px;">${a.description || ''}</div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">Category: ${a.category_name || 'General'}</div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-o btn-sm" onclick='showEditAnnouncementModal(${JSON.stringify(a)})'>Edit</button>
                            <button class="btn btn-o btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="deleteAnnouncement(${a.id})">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('') : emptyState('No announcements yet.')}
        </div>
    `;
}

window.checkAnnForm = function() {
    const title = document.getElementById('ann-title').value;
    const desc = document.getElementById('ann-desc').value;
    document.getElementById('ann-btn').disabled = !(title && desc);
};

async function createAnnouncement() {
    const btn = document.getElementById('ann-btn');
    btn.disabled = true; btn.innerText = "Publishing...";
    const title = document.getElementById('ann-title').value;
    const description = document.getElementById('ann-desc').value;
    const category_id = document.getElementById('ann-cat').value || null;
    await apiFetch('/admin/announcements', { method: 'POST', body: JSON.stringify({title, description, category_id})});
    toast('Announcement published');
    renderAdminAnnouncements();
}

window.showEditAnnouncementModal = async function(announcement) {
    const cats = await apiFetch('/admin/categories');
    const catOpts = [`<option value="">General</option>`, ...cats.map(c => `<option value="${c.id}" ${announcement.category_id === c.id ? 'selected' : ''}>${c.name}</option>`)].join('');
    showModal({
        title: 'Edit Announcement',
        content: `
            <div class="fg"><label class="fl">Title</label><input class="fi" id="edit-ann-title" value="${announcement.title || ''}"></div>
            <div class="fg"><label class="fl">Description</label><textarea class="fi" id="edit-ann-desc">${announcement.description || ''}</textarea></div>
            <div class="fg"><label class="fl">Category</label><select class="fi fsel" id="edit-ann-cat">${catOpts}</select></div>
        `,
        buttons: [
            { text: 'Cancel', type: 'o' },
            { text: 'Save Changes', type: 'p', action: async () => {
                const title = document.getElementById('edit-ann-title').value.trim();
                const description = document.getElementById('edit-ann-desc').value.trim();
                const category_id = document.getElementById('edit-ann-cat').value || null;
                if (!title || !description) return toast('Title and description are required', 'warn');
                await apiFetch(`/admin/announcements/${announcement.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ title, description, category_id })
                });
                toast('Announcement updated');
                renderAdminAnnouncements();
            }}
        ]
    });
};

async function deleteAnnouncement(id) {
    if (!confirm('Delete announcement?')) return;
    await apiFetch(`/admin/announcements/${id}`, { method: 'DELETE' });
    toast('Announcement deleted');
    renderAdminAnnouncements();
}

async function renderAdminUsers() {
    title.innerText = 'User Management';
    main.innerHTML = `<div style="padding:40px; text-align:center">Loading users...</div>`;
    const users = await apiFetch('/admin/users');
    
    main.innerHTML = `
        <div class="card" style="padding:0; overflow:hidden">
            <table class="dt">
                <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td style="font-weight:600">${u.name}</td>
                            <td>${u.email}</td>
                            <td>
                                <select class="fi fsel role-select" onchange="changeUserRole(${u.id}, this.value)" ${!u.is_active ? 'disabled' : ''}>
                                    <option value="student" ${u.role==='student'?'selected':''}>Student</option>
                                    <option value="instructor" ${u.role==='instructor'?'selected':''}>Instructor</option>
                                    <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
                                </select>
                            </td>
                            <td><span class="badge ${u.is_active?'bg':'bs'}" style="${!u.is_active?'background:#FEE2E2;color:#DC2626':''}">${u.is_active?'Active':'Deactivated'}</span></td>
                            <td>
                                ${u.id !== state.user.id ? `
                                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                                        ${u.is_active
                                            ? `<button class="btn btn-o btn-sm" style="color:var(--danger); border-color:var(--danger)" onclick="deactivateUser(${u.id})">Deactivate</button>`
                                            : `<button class="btn btn-o btn-sm" onclick="reactivateUser(${u.id})">Reactivate</button>`
                                        }
                                        <button class="btn btn-o btn-sm" style="color:var(--danger); border-color:var(--danger)" onclick="deleteUserPermanently(${u.id})">Delete</button>
                                    </div>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function changeUserRole(id, role) {
    if(!confirm('Change user role?')) return renderAdminUsers();
    await apiFetch(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({role}) });
    toast('User role updated');
}

async function deactivateUser(id) {
    if(!confirm('Deactivate user?')) return;
    await apiFetch(`/admin/users/${id}/deactivate`, { method: 'PUT' });
    toast('User deactivated');
    renderAdminUsers();
}

async function reactivateUser(id) {
    if(!confirm('Reactivate user?')) return;
    await apiFetch(`/admin/users/${id}/reactivate`, { method: 'PUT' });
    toast('User reactivated');
    renderAdminUsers();
}

async function deleteUserPermanently(id) {
    if(!confirm('Permanently delete this user and related records?')) return;
    await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
    toast('User deleted permanently');
    renderAdminUsers();
}

// === INSTRUCTOR VIEWS ===
async function renderInstructorDash() {
    title.innerText = 'Instructor Dashboard';
    const reqs = await apiFetch('/instructor/requests');
    const projs = await apiFetch('/instructor/supervised-projects');
    const pending = reqs.filter(r => r.status === 'Pending').length;
    
    main.innerHTML = `
        <div class="g2" style="margin-bottom:24px;">
            <div class="card stat-card">
                <div class="stat-val" style="color:var(--primary)">${pending}</div>
                <div class="stat-lbl">Pending Requests</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val" style="color:var(--success)">${projs.length}</div>
                <div class="stat-lbl">Supervised Projects</div>
            </div>
        </div>
        
        <div class="sec-hd"><div class="sec-t">Projects You Advise</div></div>
        <div class="g2">
            ${projs.length ? projs.map(p => `
                <div class="card" style="padding:20px; border-left:4px solid var(--success)">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start">
                        <div>
                            <div style="font-weight:600; font-size:17px">${p.title}</div>
                            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">${p.type}</div>
                            <div style="margin-top:12px; font-size:14px;">
                                <strong>Owner:</strong> ${p.owner_name} (<a href="mailto:${p.owner_email}" style="color:var(--primary)">${p.owner_email}</a>)
                            </div>
                        </div>
                        <button class="btn btn-o btn-sm" onclick="viewTeamMembers(${p.id}, 'instr-team-${p.id}')">View Team</button>
                    </div>
                    <div id="instr-team-${p.id}" style="margin-top:16px;"></div>
                </div>
            `).join('') : emptyState("No supervised projects found.")}
        </div>
    `;
}

async function renderInstructorProfile() {
    title.innerText = 'My Profile';
    const profile = await apiFetch('/instructor/profile');
    const deptOpts = DEPARTMENTS_LIST.map(d => `<option value="${d}" ${profile.department===d?'selected':''}>${d}</option>`).join('');
    main.innerHTML = `
        <div class="card">
            <div class="fg"><label class="fl">Department</label><select class="fi fsel" id="ip-dept" onchange="checkIpForm()">${deptOpts}</select></div>
            <div class="fg"><label class="fl">Academic Title</label><input class="fi" id="ip-title" value="${profile.academic_title||''}" oninput="checkIpForm()"></div>
            <div class="fg"><label class="fl">Areas of Expertise (Tags)</label><div id="ip-skills-container" class="tag-cloud" style="margin-top:8px;"></div></div>
            <div class="fg"><label class="fl">Research Interests</label><input class="fi" id="ip-research" value="${profile.research_interests||''}" oninput="checkIpForm()"></div>
            <div class="fg"><label class="fl">Previously Supervised Project Types</label><input class="fi" id="ip-prev-types" value="${profile.previous_project_types||''}" oninput="checkIpForm()"></div>
            <div class="fg"><label class="fl">Available for Advising</label><select class="fi fsel" id="ip-avail" onchange="checkIpForm()"><option value="1" ${profile.is_available?'selected':''}>Yes</option><option value="0" ${!profile.is_available?'selected':''}>No</option></select></div>
            <button class="btn btn-p" id="ip-btn" disabled onclick="saveInstructorProfile()">Save Profile</button>
        </div>
    `;
    renderTagCloud('ip-skills-container', profile.expertise);
}
window.checkIpForm = function() { document.getElementById('ip-btn').disabled = false; };

async function saveInstructorProfile() {
    const btn = document.getElementById('ip-btn');
    btn.disabled = true; btn.innerText = "Saving...";
    await apiFetch('/instructor/profile', { method: 'PUT', body: JSON.stringify({
        department: document.getElementById('ip-dept').value,
        academic_title: document.getElementById('ip-title').value,
        expertise: getSelectedSkills('ip-skills-container'),
        research_interests: document.getElementById('ip-research').value,
        previous_project_types: document.getElementById('ip-prev-types').value,
        is_available: document.getElementById('ip-avail').value === '1'
    })});
    toast('Profile updated successfully!');
    btn.innerText = "Save Profile";
}

async function renderInstructorRequests() {
    title.innerText = 'Advisor Requests';
    const reqs = await apiFetch('/instructor/requests');
    if (!reqs.length) return main.innerHTML = emptyState("No advisor requests found.");
    
    main.innerHTML = reqs.map(r => `
        <div class="card" style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <div>
                    <div class="sec-t" style="margin-bottom:4px">Project: ${r.project_title}</div>
                    <div style="font-size:14px; color:var(--text-muted)">From: <b>${r.student_name}</b></div>
                </div>
                <div class="badge ${r.status==='Accepted'?'bg':r.status==='Pending'?'bs':''}" style="${r.status==='Rejected'?'background:#FEE2E2;color:#DC2626':''}">${r.status}</div>
            </div>
            <div style="margin-top:16px; display:flex; gap:12px; border-top:1px solid var(--border-color); padding-top:16px;">
                ${r.status === 'Pending' ? `
                    <button class="btn btn-suc btn-sm" onclick="respondAdvisorReq(${r.id}, 'Accepted')">Accept Request</button>
                    <button class="btn btn-dan btn-sm" onclick="respondAdvisorReq(${r.id}, 'Rejected')">Reject</button>
                ` : ''}
                <button class="btn btn-o btn-sm" style="color:var(--danger); border-color:var(--danger)" onclick="deleteInstructorRequest(${r.id})">Delete</button>
            </div>
        </div>
    `).join('');
}
async function respondAdvisorReq(id, status) {
    await apiFetch(`/instructor/requests/${id}/respond`, { method: 'PUT', body: JSON.stringify({status})});
    toast(`Request ${status}`);
    renderInstructorRequests();
}

async function deleteInstructorRequest(id) {
    if (!confirm('Delete this advisor request?')) return;
    await apiFetch(`/instructor/requests/${id}`, { method: 'DELETE' });
    toast('Advisor request deleted');
    renderInstructorRequests();
}

async function renderInstructorAnnouncements() {
    title.innerText = 'Announcements';
    main.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">Loading announcements...</div>`;
    try {
        const anns = await apiFetch('/instructor/announcements');
        if (!anns.length) return main.innerHTML = emptyState("No announcements available.");

        main.innerHTML = anns.map(a => `
            <div class="card ann-card" style="margin-bottom:16px; cursor:pointer;" onclick="expandAnn(this)">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div class="sec-t" style="margin:0">${a.title}</div>
                    <span class="badge bs">${a.category_name || 'General'}</span>
                </div>
                <div class="ann-summary" style="font-size:15px; color:#4B5563; line-height:1.6;">${a.description.substring(0,120)}${a.description.length > 120 ? '...' : ''}</div>
                <div class="ann-full" style="display:none; font-size:15px; color:#4B5563; line-height:1.6;">${a.description}</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:16px;">Posted on ${new Date(a.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    } catch(e) {
        main.innerHTML = emptyState("Could not load announcements.");
    }
}

// === STUDENT VIEWS ===
async function renderStudentDash() {
    title.innerText = 'Student Dashboard';
    main.innerHTML = `<div style="padding:40px; text-align:center">
        <div class="card" style="display:inline-block">Loading dashboard data...</div>
    </div>`;
    
    try {
        const apps = await apiFetch('/student/my-applications');
        const incoming = await apiFetch('/student/my-projects/incoming-applications');
        const anns = await apiFetch('/student/announcements');
        const activeApps = apps.filter(a => a.status === 'Pending').length;
    
    main.innerHTML = `
        <div class="g3" style="margin-bottom:24px;">
            <div class="card stat-card">
                <div class="stat-val" style="color:var(--primary)">${activeApps}</div>
                <div class="stat-lbl">My Pending Applications</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val" style="color:var(--danger)">${incoming.length}</div>
                <div class="stat-lbl">Incoming Applications</div>
            </div>
            <div class="card stat-card">
                <div class="stat-val" style="color:var(--success)">${apps.length}</div>
                <div class="stat-lbl">Total Applications</div>
            </div>
        </div>
        
        ${incoming.length > 0 ? `
        <div class="sec-hd"><div class="sec-t" style="color:var(--danger)">Action Required: New Applications to Your Projects</div></div>
        <div class="g2" style="margin-bottom:32px;">
            ${incoming.map(a => `
                <div class="card" style="border:1px solid var(--danger); background:#FEF2F2;">
                    <div style="font-weight:700; font-size:16px; color:var(--text-main)">${a.name} applied to "${a.project_title}"</div>
                    <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">Dept: ${a.department}</div>
                    <div style="margin-top:12px; display:flex; gap:8px;">
                        <button class="btn btn-p btn-sm" onclick="manageProjectTeam(${a.project_id})">Go to Manage Team</button>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="sec-hd"><div class="sec-t">My Applications</div></div>
        <div class="g2" style="margin-bottom:32px;">
            ${apps.map(a => `
                <div class="card" style="padding:20px; border-left:4px solid ${a.status==='Accepted'?'var(--success)':a.status==='Rejected'?'var(--danger)':'var(--primary)'}">
                    <div style="font-weight:600; font-size:16px">${a.title}</div>
                    <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">Status: <b>${a.status}</b></div>
                    ${a.is_invitation && a.status === 'Pending' ? `
                        <div style="margin-top:12px; display:flex; gap:8px;">
                            <button class="btn btn-suc btn-sm" onclick="respondInvitation(${a.id}, 'Accepted')">Accept Invite</button>
                            <button class="btn btn-dan btn-sm" onclick="respondInvitation(${a.id}, 'Rejected')">Decline</button>
                        </div>
                    ` : ''}
                    <button class="btn btn-o btn-sm" style="margin-top:10px; color:var(--danger); border-color:var(--danger)" onclick="deleteMyApplication(${a.id})">Delete Request</button>
                    ${a.status === 'Accepted' ? `
                        <button class="btn btn-o btn-sm" style="margin-top:12px" onclick="viewTeamMembers(${a.project_id}, 'team-dash-${a.id}')">View Team</button>
                        <div id="team-dash-${a.id}" style="display:none; margin-top:16px; border-radius:var(--radius-sm); overflow:hidden; border:1px solid var(--border-color);"></div>
                    ` : ''}
                </div>
            `).join('') || emptyState("No applications yet.")}
        </div>

        <div class="sec-hd"><div class="sec-t">My Assigned Tasks</div></div>
        <div class="card" style="margin-bottom:32px;">
            <div id="my-tasks-list">Loading tasks...</div>
        </div>
        
        <div class="sec-hd"><div class="sec-t">Recent Announcements</div></div>
        <div class="g2" id="dash-ann-list">
            ${anns.slice(0,3).map(a => `
                <div class="card ann-card" style="padding:20px; border-left:4px solid var(--primary); cursor:pointer;" onclick="expandAnn(this)">
                    <div style="font-weight:600; font-size:16px">${a.title}</div>
                    <div class="ann-summary" style="font-size:13px; color:var(--text-muted); margin-top:4px;">${a.description.substring(0,80)}${a.description.length > 80 ? '...' : ''}</div>
                    <div class="ann-full" style="display:none; font-size:14px; color:var(--text-main); margin-top:12px; line-height:1.5;">${a.description}</div>
                </div>
            `).join('') || emptyState("No recent announcements.")}
        </div>
    `;
        fetchMyTasks();
    } catch (e) {
        main.innerHTML = emptyState("Could not load dashboard data.");
    }
}

async function fetchMyTasks() {
    const container = document.getElementById('my-tasks-list');
    try {
        const tasks = await apiFetch('/student/my-tasks');
        if (!tasks.length) return container.innerHTML = `<div style="padding:16px; color:var(--text-muted)">No active tasks assigned to you.</div>`;
        
        container.innerHTML = tasks.map(t => `
            <div style="padding:16px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:600; font-size:15px;">${t.title}</div>
                    <div style="font-size:12px; color:var(--text-muted)">Project: ${t.project_title}</div>
                </div>
                <select class="fi fsel" style="width:auto; padding:4px 8px; font-size:12px;" onchange="updateTaskStatus(${t.project_id}, ${t.id}, this.value)">
                    <option value="Todo" ${t.status==='Todo'?'selected':''}>Todo</option>
                    <option value="In Progress" ${t.status==='In Progress'?'selected':''}>In Progress</option>
                    <option value="Done">Mark Done</option>
                </select>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = `<div style="padding:16px; color:var(--danger)">Error loading tasks.</div>`;
    }
}

async function updateTaskStatus(projectId, taskId, status) {
    try {
        await apiFetch(`/student/projects/${projectId}/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        toast(`Task status updated to ${status}`);
        renderStudentDash();
    } catch(e) {}
}





window.expandAnn = function(el) {
    const full = el.querySelector('.ann-full');
    const summary = el.querySelector('.ann-summary');
    if (full.style.display === 'none') {
        full.style.display = 'block';
        summary.style.display = 'none';
    } else {
        full.style.display = 'none';
        summary.style.display = 'block';
    }
};

async function viewTeamMembers(projectId, containerId) {
    const container = document.getElementById(containerId);
    if (container.style.display === 'block') {
        container.style.display = 'none';
        return;
    }
    
    container.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted)">Loading...</div>`;
    container.style.display = 'block';
    
    try {
        const endpoint = state.user.role === 'instructor'
            ? `/instructor/supervised-projects/${projectId}/members`
            : `/student/projects/${projectId}/members`;
        const members = await apiFetch(endpoint);
        if (!members.length) {
            container.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:13px; font-weight:500;">No other accepted members yet.</div>`;
            return;
        }
        
        container.innerHTML = `<div style="padding:16px; background:#F9FAFB;">` + 
            members.map(m => `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #E5E7EB; padding-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:32px; height:32px; border-radius:50%; background:${m.role==='Owner'?'var(--primary)':m.role==='Advisor'?'var(--success)':'#6366F1'}; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">${m.name[0]}</div>
                        <div>
                            <div style="font-weight:600; font-size:14px; color:var(--text-main);">${m.name}</div>
                            <div style="font-size:12px; color:var(--text-muted);">${m.department || 'Department N/A'}</div>
                        </div>
                    </div>
                    <span class="badge ${m.role==='Owner'?'bg':m.role==='Advisor'?'bg':'bs'}" style="font-size:10px">${m.role}</span>
                </div>
            `).join('') + `</div>`;
    } catch(e) {
        container.innerHTML = `<div style="padding:16px; text-align:center; color:var(--danger); font-size:13px;">Failed to load members</div>`;
    }
}

async function renderStudentAnnouncements() {
    title.innerText = 'Announcements';
    const anns = await apiFetch('/student/announcements');
    if (!anns.length) return main.innerHTML = emptyState("No announcements available.");
    
    main.innerHTML = anns.map(a => `
        <div class="card ann-card" style="margin-bottom:16px; cursor:pointer;" onclick="expandAnn(this)">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div class="sec-t" style="margin:0">${a.title}</div>
                <span class="badge bs">${a.category_name || 'General'}</span>
            </div>
            <div class="ann-summary" style="font-size:15px; color:#4B5563; line-height:1.6;">${a.description.substring(0,120)}${a.description.length > 120 ? '...' : ''}</div>
            <div class="ann-full" style="display:none; font-size:15px; color:#4B5563; line-height:1.6;">${a.description}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:16px;">Posted on ${new Date(a.created_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}

async function renderStudentProjects() {
    title.innerText = 'Projects Marketplace';
    const projects = await apiFetch('/student/projects');
    if (!projects.length) return main.innerHTML = emptyState("No projects posted yet.");
    
    main.innerHTML = `<div class="g2">` + projects.map(p => {
        let btnHtml = '';
        if (p.owner_id === state.user.id) {
            btnHtml = `<div style="text-align:center; padding:8px; font-weight:600; color:var(--primary); background:#EEF2FF; border-radius:var(--radius-sm);">You are the owner</div>`;
        } else if (p.my_application_status === 'Accepted') {
            btnHtml = `<div style="text-align:center; padding:8px; font-weight:600; color:var(--success); background:#ECFDF5; border-radius:var(--radius-sm);">You are a member</div>`;
        } else if (p.my_application_status) {
            let color = p.my_application_status === 'Rejected' ? 'var(--danger)' : 'var(--text-muted)';
            btnHtml = `<button class="btn btn-full" disabled style="background:#F3F4F6; color:${color}; border:1px solid #E5E7EB; font-weight:600;">Status: ${p.my_application_status}</button>`;
        } else if (p.accepted_count >= p.needed_members) {
            btnHtml = `<button class="btn btn-full" disabled style="background:#FEE2E2; color:var(--danger); border:1px solid #FCA5A5; font-weight:600;">Team Full</button>`;
        } else {
            btnHtml = `<button class="btn btn-p btn-full" onclick="applyToProject(${p.id}, this)">Apply Now</button>`;
        }
        
        return `
        <div class="pc">
            <div style="display:flex; gap:8px"><span class="badge bs">${p.type}</span></div>
            <div class="pc-title">${p.title}</div>
            <div class="pc-creator">Posted by <b>${p.owner_name}</b></div>
            <div class="pc-desc">${p.description}</div>
            <div class="pc-meta">Needed Members: ${p.needed_members}</div>
            <div style="margin-top:auto; padding-top:16px;">
                ${btnHtml}
            </div>
        </div>
        `;
    }).join('') + `</div>`;
}
async function applyToProject(id, btn) {
    btn.disabled = true; btn.innerText = "Applying...";
    try {
        await apiFetch(`/student/projects/${id}/apply`, { method: 'POST' });
        toast('Applied to project successfully!');
        btn.innerText = "Status: Pending";
        btn.style.background = '#F3F4F6';
        btn.style.color = 'var(--text-muted)';
        btn.style.borderColor = '#E5E7EB';
        btn.classList.remove('btn-p');
    } catch(e) {
        btn.disabled = false; btn.innerText = "Apply Now";
    }
}

async function renderStudentSearch() {
    title.innerText = 'Student & Teammate Search';
    main.innerHTML = `
        <div class="card" style="margin-bottom:24px;">
            <div class="t-row">
                <div class="t-sw" id="match-all-sw" onclick="this.classList.toggle('on'); applyFilters()"></div>
                <div class="t-lab">Match ALL selected skills (Strict Filter)</div>
            </div>
            <div class="sec-hd"><div class="sec-t">Filter by Department</div></div>
            <div id="filter-depts" class="tag-cloud" style="margin-bottom:20px"></div>
            <div class="sec-hd"><div class="sec-t">Filter by Skills</div></div>
            <div id="filter-skills" class="tag-cloud"></div>
        </div>
        <div id="student-search-results"></div>
    `;
    
    const students = await apiFetch('/student/students');
    window.allStudents = students;
    
    document.getElementById('filter-depts').innerHTML = DEPARTMENTS_LIST.map(d => `<span class="skill-tag" onclick="toggleFilter(this, 'dept')">${d}</span>`).join('');
    document.getElementById('filter-skills').innerHTML = SKILLS_LIST.map(s => `<span class="skill-tag" onclick="toggleFilter(this, 'skill')">${s}</span>`).join('');
    
    applyFilters();
}

window.toggleFilter = function(el, type) {
    el.classList.toggle('active');
    if (window.applyFilters) window.applyFilters();
};

window.applyFilters = function() {
    const sw = document.getElementById('match-all-sw');
    if (!sw) return;
    const isStrict = sw.classList.contains('on');
    const activeDepts = Array.from(document.querySelectorAll('#filter-depts .skill-tag.active')).map(el => el.innerText);
    const activeSkills = Array.from(document.querySelectorAll('#filter-skills .skill-tag.active')).map(el => el.innerText);
    
    const filtered = window.allStudents.filter(s => {
        const deptMatch = activeDepts.length === 0 || activeDepts.includes(s.department);
        const skills = (s.technical_skills || '').split(',').map(v => v.trim());
        
        let skillMatch = false;
        if (activeSkills.length === 0) {
            skillMatch = true;
        } else if (isStrict) {
            skillMatch = activeSkills.every(as => skills.includes(as));
        } else {
            skillMatch = activeSkills.some(as => skills.includes(as));
        }
        
        return deptMatch && skillMatch;
    });
    
    const container = document.getElementById('student-search-results');
    if (!filtered.length) return container.innerHTML = emptyState("No students match your selected filters.");
    
    container.innerHTML = `<div class="g2">` + filtered.map(s => `
        <div class="ic" style="text-align:center">
            <div style="width:64px; height:64px; border-radius:50%; background:var(--primary); color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:24px; margin:0 auto 16px;">${s.name[0]}</div>
            <div class="ic-name">${s.name}</div>
            <div class="ic-dept" style="margin-bottom:12px;">${s.department || 'N/A'}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Interests: ${s.interests || 'N/A'}</div>
            <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:4px; justify-content:center;">
                ${(s.technical_skills || '').split(',').filter(t => t.trim()).map(tag => `<span class="badge bs" style="font-size:10px">${tag.trim()}</span>`).join('')}
            </div>
            <button class="btn btn-p btn-sm btn-full" style="margin-top:20px;" onclick="window.inviteStudentPrompt(${s.id}, '${s.name}')">Invite to Team</button>
        </div>
    `).join('') + `</div>`;
}

window.inviteStudentPrompt = async function(studentId, name) {
    const myProjects = await apiFetch('/student/my-projects');
    if (!myProjects.length) return toast('You do not have any projects to invite this student to.', 'warn');
    
    showModal({
        title: `Invite ${name} to Project`,
        content: `
            <div class="fg">
                <label class="fl">Select Project</label>
                <select class="fi" id="invite-project-select">
                    ${myProjects.map(p => `<option value="${p.id}">${p.title}</option>`).join('')}
                </select>
            </div>
            <p class="modal-p">The student will receive a notification and can accept or reject your invitation.</p>
        `,
        buttons: [
            { text: 'Cancel', type: 'o' },
            { text: 'Send Invitation', type: 'p', action: async () => {
                const projectId = document.getElementById('invite-project-select').value;
                await apiFetch(`/student/projects/${projectId}/invite`, {
                    method: 'POST',
                    body: JSON.stringify({ student_id: studentId })
                });
                toast(`Invitation sent to ${name}!`);
            }}
        ]
    });
};

async function renderStudentMyProjects() {
    title.innerText = 'My Projects';
    main.innerHTML = `<button class="btn btn-p" onclick="renderCreateProject()">+ Create New Project</button><div id="my-proj-list" style="margin-top:24px;"></div>`;
    
    const projects = await apiFetch('/student/my-projects');
    if (!projects.length) return document.getElementById('my-proj-list').innerHTML = emptyState("You haven't created any projects.");
    
    document.getElementById('my-proj-list').innerHTML = projects.map(p => `
        <div class="card" style="border-left:4px solid var(--primary); padding:24px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div class="sec-t" style="margin:0">${p.title}</div>
                    <div style="font-size:14px; color:var(--text-muted); margin-top:4px;">${p.type}</div>
                </div>
                <div style="display:flex; gap:12px;">
                    <button class="btn btn-o btn-sm" onclick="viewTeamMembers(${p.id}, 'team-proj-${p.id}')">View Team</button>
                    <button class="btn btn-p btn-sm" onclick="manageProjectTeam(${p.id})">Manage Team & Tasks</button>
                </div>
            </div>
            <div id="team-proj-${p.id}" style="display:none; margin-top:16px; border-radius:var(--radius-sm); overflow:hidden; border:1px solid var(--border-color);"></div>
        </div>
    `).join('');
}

async function renderCreateProject() {
    title.innerText = 'Create Project';
    main.innerHTML = `
        <div class="card">
            <div class="fg"><label class="fl">Project Title</label><input class="fi" id="cp-title" oninput="checkCpForm()"></div>
            <div class="fg"><label class="fl">Type</label><select class="fi fsel" id="cp-type">
                <option value="Course Project">Course Project</option>
                <option value="TÜBİTAK Student Project">TÜBİTAK Student Project</option>
                <option value="Teknofest Student Project">Teknofest Student Project</option>
            </select></div>
            <div class="fg"><label class="fl">Description</label><textarea class="fi" id="cp-desc" oninput="checkCpForm()"></textarea></div>
            <div class="fg"><label class="fl">Required Skills</label><input class="fi" id="cp-required-skills" placeholder="e.g. React, Node.js"></div>
            <div class="fg"><label class="fl">Needed Roles</label><input class="fi" id="cp-needed-roles" placeholder="e.g. Frontend, Backend"></div>
            <div class="fg"><label class="fl">Needed Members Count</label><input class="fi" type="number" id="cp-members" value="1" oninput="checkCpForm()"></div>
            <button class="btn btn-p" id="cp-btn" disabled onclick="createProject()">Create Project</button>
            <button class="btn btn-o" onclick="renderStudentMyProjects()">Cancel</button>
        </div>
    `;
}
window.checkCpForm = function() {
    document.getElementById('cp-btn').disabled = !(document.getElementById('cp-title').value && document.getElementById('cp-desc').value);
};

async function createProject() {
    const btn = document.getElementById('cp-btn');
    btn.disabled = true; btn.innerText = "Creating...";
    await apiFetch('/student/projects', { method: 'POST', body: JSON.stringify({
        title: document.getElementById('cp-title').value,
        type: document.getElementById('cp-type').value,
        description: document.getElementById('cp-desc').value,
        required_skills: document.getElementById('cp-required-skills').value,
        needed_roles: document.getElementById('cp-needed-roles').value,
        needed_members: document.getElementById('cp-members').value
    })});
    toast('Project Created Successfully!');
    renderStudentMyProjects();
}

async function manageProjectTeam(projectId) {
    title.innerText = 'Manage Project';
    main.innerHTML = `<button class="btn btn-o btn-sm" onclick="renderStudentMyProjects()">← Back</button><div id="manage-area" style="margin-top:24px"></div>`;
    
    const members = await apiFetch(`/student/projects/${projectId}/members`);
    const apps = await apiFetch(`/student/my-projects/${projectId}/applications`);
    const tasks = await apiFetch(`/student/projects/${projectId}/tasks`);
    
    const container = document.getElementById('manage-area');
    
    container.innerHTML = `
        <div class="sec-hd"><div class="sec-t">Team Members</div></div>
        <div class="g2">
            ${members.map(m => `
                <div class="card" style="padding:16px; border-left:4px solid ${m.role==='Owner'?'var(--primary)':m.role==='Advisor'?'var(--success)':'#6366F1'}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start">
                        <div>
                            <div style="font-weight:600;">${m.name || 'Unknown User'}</div>
                            <div style="font-size:12px; color:var(--text-muted)">${m.department || 'N/A'}</div>
                        </div>
                        <span class="badge ${m.role==='Owner'?'bg':m.role==='Advisor'?'bg':'bs'}">${m.role || 'Member'}</span>
                    </div>
                    ${m.role !== 'Owner' ? `
                    <div style="margin-top:12px; display:flex; gap:8px;">
                        <button class="btn btn-o btn-sm" onclick="assignTaskPrompt(${projectId}, ${m.id}, '${m.name.replace(/'/g, "\\'")}')">Assign Task</button>
                        <button class="btn btn-dan btn-sm" onclick="removeMember(${projectId}, ${m.id})">${m.role === 'Advisor' ? 'Remove Advisor' : 'Remove'}</button>
                    </div>
                    ` : ''}
                </div>
            `).join('') || '<div class="card" style="padding:16px; color:var(--text-muted)">No members accepted yet.</div>'}
        </div>

        <div class="sec-hd" style="margin-top:32px;"><div class="sec-t">Project Tasks</div></div>
        <div class="card">
            ${tasks.map(t => `
                <div style="padding:12px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:600; font-size:14px;">${t.title}</div>
                        <div style="font-size:12px; color:var(--text-muted)">Assigned to: ${t.assignee_name} | Status: <b>${t.status}</b></div>
                    </div>
                </div>
            `).join('') || '<div style="padding:16px; color:var(--text-muted)">No tasks created yet.</div>'}
        </div>

        <div class="sec-hd" style="margin-top:32px;"><div class="sec-t">Pending Applications</div></div>
        <div class="g2">
            ${apps.filter(a => a.status === 'Pending').map(a => `
                <div class="card" style="padding:16px;">
                    <div style="font-weight:600;">${a.name}</div>
                    <div style="font-size:12px; color:var(--text-muted)">${a.department} | Skills: ${a.technical_skills}</div>
                    <div style="margin-top:12px; display:flex; gap:8px;">
                        <button class="btn btn-suc btn-sm" onclick="respondApp(${projectId}, ${a.id}, 'Accepted')">Accept</button>
                        <button class="btn btn-dan btn-sm" onclick="respondApp(${projectId}, ${a.id}, 'Rejected')">Reject</button>
                        <button class="btn btn-o btn-sm" style="color:var(--danger); border-color:var(--danger)" onclick="deleteIncomingApp(${projectId}, ${a.id})">Delete</button>
                    </div>
                </div>
            `).join('') || '<div class="card" style="padding:16px; color:var(--text-muted)">No pending applications.</div>'}
        </div>
    `;
}

window.assignTaskPrompt = function(projectId, studentId, name) {
    showModal({
        title: `Assign Task to ${name}`,
        content: `
            <div class="fg"><label class="fl">Task Title</label><input class="fi" id="task-title-input" placeholder="e.g. Design Login Page"></div>
            <div class="fg"><label class="fl">Description</label><textarea class="fi" id="task-desc-input" style="height:80px"></textarea></div>
        `,
        buttons: [
            { text: 'Cancel', type: 'o' },
            { text: 'Assign Task', type: 'p', action: async () => {
                const title = document.getElementById('task-title-input').value;
                const description = document.getElementById('task-desc-input').value;
                if (!title) return toast('Title is required', 'warn');
                await apiFetch(`/student/projects/${projectId}/tasks`, { 
                    method: 'POST', 
                    body: JSON.stringify({ assigned_to: studentId, title, description }) 
                });
                toast('Task assigned and student notified!');
                manageProjectTeam(projectId);
            }}
        ]
    });
};

async function respondInvitation(appId, status) {
    try {
        await apiFetch(`/student/my-applications/${appId}/respond`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        toast(`Invitation ${status}`);
        renderStudentDash();
    } catch(e) { console.error(e); }
}

async function deleteMyApplication(appId) {
    if (!confirm('Delete this project request?')) return;
    await apiFetch(`/student/my-applications/${appId}`, { method: 'DELETE' });
    toast('Request deleted');
    renderStudentDash();
}

window.removeMember = function(projectId, studentId) {
    if (!projectId || !studentId) return toast('Invalid Project or Member ID', 'error');
    showModal({
        title: 'Remove Team Member',
        content: '<p class="modal-p">Are you sure you want to remove this member from the project? They will be notified.</p>',
        buttons: [
            { text: 'Cancel', type: 'o' },
            { text: 'Remove', type: 'dan', action: async () => {
                try {
                    await apiFetch(`/student/projects/${projectId}/members/${studentId}`, { method: 'DELETE' });
                    toast('Member removed successfully');
                    manageProjectTeam(projectId);
                } catch(e) {
                    toast(e.message, 'error');
                }
            }}
        ]
    });
};

async function respondApp(projectId, appId, status) {
    await apiFetch(`/student/projects/${projectId}/applications/${appId}/respond`, { method: 'PUT', body: JSON.stringify({status})});
    toast(`Application ${status}`);
    manageProjectTeam(projectId);
}

async function deleteIncomingApp(projectId, appId) {
    if (!confirm('Delete this incoming application?')) return;
    await apiFetch(`/student/projects/${projectId}/applications/${appId}`, { method: 'DELETE' });
    toast('Incoming application deleted');
    manageProjectTeam(projectId);
}

let advisorReqsData = [];
let availableInstsData = [];
let eligibleProjsData = [];

async function renderStudentAdvisors() {
    title.innerText = 'Find an Advisor';
    availableInstsData = await apiFetch('/student/instructors');
    const myProjs = await apiFetch('/student/my-projects');
    eligibleProjsData = myProjs.filter(p => (p.type.includes('TÜBİTAK') || p.type.includes('Teknofest')) && p.advisor_id === null);
    advisorReqsData = await apiFetch('/student/my-advisor-requests');
    
    let projOpts = eligibleProjsData.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
    let projSelect = eligibleProjsData.length > 0 
        ? `<div class="card" style="margin-bottom:24px"><div class="fg" style="margin:0"><label class="fl">Select your project to request an advisor for:</label><select class="fi fsel" id="adv-proj" onchange="renderInstructorList()">${projOpts}</select></div></div>` 
        : `<div class="card" style="background:#FEF3C7; border-color:#FDE68A; color:#92400E; margin-bottom:24px; font-weight:500;">You must have an active project (TÜBİTAK, Teknofest, Research, etc.) without an advisor to request one. (Course projects are excluded)</div>`;
    
    main.innerHTML = projSelect + `
        <div class="card" style="margin-bottom:24px;">
            <div class="sec-hd"><div class="sec-t">Filter by Department</div></div>
            <div id="filter-adv-depts" class="tag-cloud" style="margin-bottom:20px"></div>
            <div class="sec-hd"><div class="sec-t">Filter by Expertise</div></div>
            <div id="filter-adv-skills" class="tag-cloud"></div>
        </div>
        <div id="inst-list-container"></div>
    `;
    
    // Render filters
    document.getElementById('filter-adv-depts').innerHTML = DEPARTMENTS_LIST.map(d => `<span class="skill-tag" onclick="toggleAdvFilter(this, 'dept')">${d}</span>`).join('');
    document.getElementById('filter-adv-skills').innerHTML = SKILLS_LIST.map(s => `<span class="skill-tag" onclick="toggleAdvFilter(this, 'skill')">${s}</span>`).join('');
    
    renderInstructorList();
}

window.toggleAdvFilter = function(el) {
    el.classList.toggle('active');
    renderInstructorList();
};

window.renderInstructorList = function() {
    const container = document.getElementById('inst-list-container');
    const selectedProjId = parseInt(document.getElementById('adv-proj')?.value || 0);
    const canRequest = selectedProjId > 0;
    
    if (!availableInstsData.length) {
        container.innerHTML = emptyState("No available advisors.");
        return;
    }

    const activeDepts = Array.from(document.querySelectorAll('#filter-adv-depts .skill-tag.active')).map(el => el.innerText);
    const activeSkills = Array.from(document.querySelectorAll('#filter-adv-skills .skill-tag.active')).map(el => el.innerText);

    const filtered = availableInstsData.filter(i => {
        const deptMatch = activeDepts.length === 0 || activeDepts.includes(i.department);
        const skills = (i.expertise || '').split(',').map(v => v.trim());
        const skillMatch = activeSkills.length === 0 || activeSkills.some(as => skills.includes(as));
        return deptMatch && skillMatch;
    });
    
    if (!filtered.length) return container.innerHTML = emptyState("No advisors match your filters.");

    container.innerHTML = `<div class="g2">` + filtered.map(i => {
        const existingReq = advisorReqsData.find(r => r.project_id === selectedProjId && r.instructor_id === i.user_id);
        let btnHtml = canRequest
            ? `<button class="btn btn-p btn-full" onclick="requestAdvisor(${i.user_id}, this)">Send Request</button>`
            : `<button class="btn btn-full" disabled style="background:#F3F4F6; color:var(--text-muted); border:1px solid #E5E7EB; font-weight:600;">Select eligible project first</button>`;
        if (existingReq) {
            btnHtml = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button class="btn btn-full" disabled style="background:#F3F4F6; color:var(--text-muted); border:1px solid #E5E7EB; font-weight:600;">Status: ${existingReq.status}</button>
                    <button class="btn btn-o btn-sm" style="color:var(--danger); border-color:var(--danger)" onclick="deleteAdvisorRequest(${existingReq.id})">Delete Request</button>
                </div>
            `;
        }
        
        return `
        <div class="ic" style="text-align:center">
             <div style="width:64px; height:64px; border-radius:50%; background:#10B981; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:24px; margin:0 auto 16px;">${i.name[0]}</div>
            <div class="ic-name">${i.academic_title || ''} ${i.name}</div>
            <div class="ic-dept" style="margin-bottom:12px;">${i.department || 'N/A'}</div>
            <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:4px; justify-content:center; margin-bottom:20px;">
                ${(i.expertise || '').split(',').filter(t => t.trim()).map(tag => `<span class="badge bs" style="font-size:10px">${tag.trim()}</span>`).join('')}
            </div>
            ${btnHtml}
        </div>
        `;
    }).join('') + `</div>`;
}

async function requestAdvisor(instructorId, btn) {
    const projId = document.getElementById('adv-proj').value;
    if (!projId) return toast('Select a project first', 'warn');
    btn.disabled = true; btn.innerText = "Sending...";
    try {
        await apiFetch(`/student/projects/${projId}/advisor-request`, { method: 'POST', body: JSON.stringify({instructor_id: instructorId})});
        toast('Advisor request sent successfully!');
        btn.innerText = "Status: Pending";
        btn.style.background = '#F3F4F6';
        btn.style.color = 'var(--text-muted)';
        btn.style.borderColor = '#E5E7EB';
        btn.classList.remove('btn-p');
        // Refresh requests data
        advisorReqsData = await apiFetch('/student/my-advisor-requests');
    } catch(e) {
        btn.disabled = false; btn.innerText = "Send Request";
    }
}

async function deleteAdvisorRequest(requestId) {
    if (!confirm('Delete this advisor request?')) return;
    await apiFetch(`/student/my-advisor-requests/${requestId}`, { method: 'DELETE' });
    toast('Advisor request deleted');
    advisorReqsData = await apiFetch('/student/my-advisor-requests');
    renderInstructorList();
}

async function renderStudentProfile() {
    title.innerText = 'My Profile';
    const profile = await apiFetch('/student/profile');
    const deptOpts = DEPARTMENTS_LIST.map(d => `<option value="${d}" ${profile.department===d?'selected':''}>${d}</option>`).join('');
    main.innerHTML = `
        <div class="card">
            <div class="fg"><label class="fl">Department</label><select class="fi fsel" id="sp-dept" onchange="checkSpForm()">${deptOpts}</select></div>
            <div class="fg"><label class="fl">Year/Grade</label><select class="fi fsel" id="sp-year" onchange="checkSpForm()"><option value="1" ${profile.year==='1'?'selected':''}>1st Year</option><option value="2" ${profile.year==='2'?'selected':''}>2nd Year</option><option value="3" ${profile.year==='3'?'selected':''}>3rd Year</option><option value="4" ${profile.year==='4'?'selected':''}>4th Year</option><option value="Graduate" ${profile.year==='Graduate'?'selected':''}>Graduate</option></select></div>
            <div class="fg"><label class="fl">Technical Skills (Tags)</label><div id="sp-skills-container" class="tag-cloud" style="margin-top:8px;"></div></div>
            <div class="fg"><label class="fl">Interests</label><input class="fi" id="sp-interests" value="${profile.interests||''}" oninput="checkSpForm()" placeholder="e.g. AI, UI/UX"></div>
            <div class="fg"><label class="fl">Bio / About</label><textarea class="fi" id="sp-bio" style="height:100px" oninput="checkSpForm()">${profile.bio||''}</textarea></div>
            <div class="fg"><label class="fl">GitHub URL</label><input class="fi" id="sp-github" value="${profile.github_url||''}" oninput="checkSpForm()"></div>
            <div class="fg"><label class="fl">LinkedIn URL</label><input class="fi" id="sp-linkedin" value="${profile.linkedin_url||''}" oninput="checkSpForm()"></div>
            <button class="btn btn-p" id="sp-btn" disabled onclick="saveStudentProfile()">Save Profile</button>
        </div>
    `;
    renderTagCloud('sp-skills-container', profile.technical_skills);
}
window.checkSpForm = function() { document.getElementById('sp-btn').disabled = false; };

async function saveStudentProfile() {
    const btn = document.getElementById('sp-btn');
    btn.disabled = true; btn.innerText = "Saving...";
    await apiFetch('/student/profile', { method: 'PUT', body: JSON.stringify({
        department: document.getElementById('sp-dept').value,
        year: document.getElementById('sp-year').value,
        interests: document.getElementById('sp-interests').value,
        technical_skills: getSelectedSkills('sp-skills-container'),
        bio: document.getElementById('sp-bio').value,
        github_url: document.getElementById('sp-github').value,
        linkedin_url: document.getElementById('sp-linkedin').value
    })});
    toast('Profile updated successfully!');
    btn.innerText = "Save Profile";
}

// Start App
initApp();
