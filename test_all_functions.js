const assert = require('assert');

const BASE = 'http://localhost:3000/api';
const runId = Date.now();

const users = {
  owner: { name: `Owner ${runId}`, email: `owner.${runId}@unimatch.edu`, password: 'password', role: 'student' },
  member: { name: `Member ${runId}`, email: `member.${runId}@unimatch.edu`, password: 'password', role: 'student' },
  instr1: { name: `Instr1 ${runId}`, email: `instr1.${runId}@unimatch.edu`, password: 'password', role: 'instructor' },
  instr2: { name: `Instr2 ${runId}`, email: `instr2.${runId}@unimatch.edu`, password: 'password', role: 'instructor' }
};

async function req(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function login(email, password) {
  const out = await req('POST', '/auth/login', null, { email, password });
  assert.equal(out.status, 200, `Login failed for ${email}: ${JSON.stringify(out.data)}`);
  return out.data.token;
}

async function registerAll() {
  for (const key of Object.keys(users)) {
    const u = users[key];
    const out = await req('POST', '/auth/register', null, u);
    assert([201, 400].includes(out.status), `Unexpected register response: ${out.status}`);
  }
}

(async () => {
  await registerAll();

  const adminToken = await login('admin@unimatch.edu', process.env.DEFAULT_ADMIN_PASSWORD || 'admin123');
  const ownerToken = await login(users.owner.email, users.owner.password);
  const memberToken = await login(users.member.email, users.member.password);
  const instr1Token = await login(users.instr1.email, users.instr1.password);
  const instr2Token = await login(users.instr2.email, users.instr2.password);

  // Admin functions
  let out = await req('GET', '/admin/metrics', adminToken);
  assert.equal(out.status, 200);
  out = await req('POST', '/admin/categories', adminToken, { name: `Research ${runId}`, team_size_constraint: 5, budget_constraint: '10000 TL' });
  assert.equal(out.status, 201);
  const catId = out.data.id;
  out = await req('PUT', `/admin/categories/${catId}`, adminToken, { name: `Research Updated ${runId}`, team_size_constraint: 6, budget_constraint: '12000 TL' });
  assert.equal(out.status, 200);
  out = await req('POST', '/admin/announcements', adminToken, { title: `Announcement ${runId}`, description: 'Integration test', category_id: catId });
  assert.equal(out.status, 201);
  out = await req('GET', '/admin/users', adminToken);
  assert.equal(out.status, 200);
  const memberUser = out.data.find(u => u.email === users.member.email);
  assert(memberUser, 'Member user not found in admin users');

  // Student profile
  out = await req('PUT', '/student/profile', ownerToken, { department: 'Software Engineering', year: '3', technical_skills: 'Node.js,React', github_url: '', linkedin_url: '', bio: 'Owner bio' });
  assert.equal(out.status, 200);
  out = await req('GET', '/student/profile', ownerToken);
  assert.equal(out.status, 200);

  // Instructor profiles
  out = await req('PUT', '/instructor/profile', instr1Token, { department: 'Computer Engineering', academic_title: 'Assoc. Prof.', expertise: 'AI,ML', research_interests: '', previous_project_types: '', is_available: 1 });
  assert.equal(out.status, 200);
  out = await req('PUT', '/instructor/profile', instr2Token, { department: 'Computer Engineering', academic_title: 'Dr.', expertise: 'Backend', research_interests: '', previous_project_types: '', is_available: 1 });
  assert.equal(out.status, 200);

  // Project creation and listing
  const projectTitle = `API Project ${runId}`;
  out = await req('POST', '/student/projects', ownerToken, {
    title: projectTitle,
    type: 'TÜBİTAK Student Project',
    description: 'Project from integration test',
    required_skills: 'Node.js',
    needed_members: 2,
    needed_roles: 'Backend'
  });
  assert.equal(out.status, 201);
  const projectId = out.data.id;

  out = await req('GET', '/student/projects', memberToken);
  assert.equal(out.status, 200);
  assert(out.data.some(p => p.id === projectId), 'Project missing from marketplace');

  // Apply + owner review
  out = await req('POST', `/student/projects/${projectId}/apply`, memberToken);
  assert.equal(out.status, 200);
  out = await req('GET', `/student/my-projects/${projectId}/applications`, ownerToken);
  assert.equal(out.status, 200);
  const app = out.data.find(a => a.student_id === memberUser.id);
  assert(app, 'Application not found');
  out = await req('PUT', `/student/projects/${projectId}/applications/${app.id}/respond`, ownerToken, { status: 'Accepted' });
  assert.equal(out.status, 200);

  // Team visibility and invitations
  out = await req('GET', `/student/projects/${projectId}/members`, ownerToken);
  assert.equal(out.status, 200);
  out = await req('GET', '/student/students', ownerToken);
  assert.equal(out.status, 200);
  out = await req('POST', `/student/projects/${projectId}/invite`, ownerToken, { student_id: memberUser.id });
  assert([200, 400].includes(out.status)); // might already be accepted member

  // Advisor request flow
  out = await req('GET', '/student/instructors', ownerToken);
  assert.equal(out.status, 200);
  const advisorId = out.data[0].user_id;
  out = await req('POST', `/student/projects/${projectId}/advisor-request`, ownerToken, { instructor_id: advisorId });
  assert.equal(out.status, 200);
  out = await req('GET', '/instructor/requests', instr1Token);
  assert.equal(out.status, 200);
  const myReq = out.data.find(r => r.project_id === projectId);
  if (myReq) {
    out = await req('PUT', `/instructor/requests/${myReq.id}/respond`, instr1Token, { status: 'Accepted' });
    assert.equal(out.status, 200);
  }

  // Task flow
  out = await req('POST', `/student/projects/${projectId}/tasks`, ownerToken, { assigned_to: memberUser.id, title: 'Implement API', description: 'Do the endpoint work' });
  assert.equal(out.status, 201);
  out = await req('GET', '/student/my-tasks', memberToken);
  assert.equal(out.status, 200);
  const task = out.data.find(t => t.project_id === projectId);
  assert(task, 'Assigned task missing');
  out = await req('PUT', `/student/projects/${projectId}/tasks/${task.id}`, memberToken, { status: 'Done' });
  assert.equal(out.status, 200);
  out = await req('GET', `/student/projects/${projectId}/tasks`, ownerToken);
  assert.equal(out.status, 200);

  // Notifications
  out = await req('GET', '/notifications', ownerToken);
  assert.equal(out.status, 200);
  if (out.data.length) {
    await req('PUT', `/notifications/${out.data[0].id}/read`, ownerToken);
  }
  out = await req('PUT', '/notifications/read-all', ownerToken);
  assert.equal(out.status, 200);

  // Instructor supervised projects
  out = await req('GET', '/instructor/supervised-projects', instr1Token);
  assert.equal(out.status, 200);

  // Admin role/deactivate + category delete
  out = await req('PUT', `/admin/users/${memberUser.id}/role`, adminToken, { role: 'student' });
  assert.equal(out.status, 200);
  out = await req('PUT', `/admin/users/${memberUser.id}/deactivate`, adminToken);
  assert.equal(out.status, 200);
  out = await req('DELETE', `/admin/categories/${catId}`, adminToken);
  assert.equal(out.status, 200);

  console.log('All API functions tested successfully');
})();
