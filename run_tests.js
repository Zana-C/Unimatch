const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const outDir = path.join(__dirname, 'docs', 'screenshots');

async function clickNav(page, text) {
  await page.locator('#sidebar-nav .ni', { hasText: text }).first().click();
}

async function login(page, email, password) {
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#auth-login-view button:has-text("Sign In")');
  await page.waitForSelector('#app-view.on');
}

async function logout(page) {
  await page.click('button:has-text("Sign Out")');
  await page.waitForSelector('#auth-view.on');
}

async function register(page, { role, name, email, password }) {
  await page.click('a:has-text("Register here")');
  await page.selectOption('#reg-role', role);
  await page.fill('#reg-name', name);
  await page.fill('#reg-email', email);
  await page.fill('#reg-password', password);
  await page.click('#auth-register-view button:has-text("Create Account")');
  await page.waitForTimeout(300);
}

async function capture(page, tc) {
  await waitForCleanScreen(page);
  await page.screenshot({ path: path.join(outDir, `${tc}.png`), fullPage: true });
}

async function waitForCleanScreen(page) {
  await page.waitForTimeout(800);
  await page.waitForFunction(() => {
    const toasts = document.querySelectorAll('#toast .toast-item');
    const modal = document.getElementById('modal-overlay');
    const modalOpen = modal ? modal.classList.contains('on') : false;
    return toasts.length === 0 && !modalOpen;
  }, { timeout: 7000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('#toast .toast-item').forEach((n) => n.remove());
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('on');
  });
  await page.waitForTimeout(250);
}

(async () => {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const runId = Date.now();
  const student1Name = `Ali Yilmaz ${runId}`;
  const student2Name = `Zeynep Kaya ${runId}`;
  const projectTitle = `AI Chatbot System ${runId}`;
  const student1Email = `ali.${runId}@unimatch.edu`;
  const student2Email = `zeynep.${runId}@unimatch.edu`;
  const instructorEmail = `ahmet.${runId}@unimatch.edu`;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE_URL);
  await page.waitForSelector('#auth-view.on');

  // Register baseline accounts
  await register(page, { role: 'student', name: student1Name, email: student1Email, password: 'password' });
  await register(page, { role: 'student', name: student2Name, email: student2Email, password: 'password' });
  await register(page, { role: 'instructor', name: 'Dr. Ahmet', email: instructorEmail, password: 'password' });
  if (!(await page.locator('#auth-login-view').isVisible())) {
    await page.click('a:has-text("Sign in")');
  }

  // Admin flows
  await login(page, 'admin@unimatch.edu', process.env.DEFAULT_ADMIN_PASSWORD || 'admin123');

  // TC-01
  await clickNav(page, 'Categories');
  await capture(page, 'TC-01-before');
  await page.click('button:has-text("+ Add Category")');
  await page.fill('#new-cat-name', 'TC Category');
  await page.fill('#new-cat-size', '4');
  await page.fill('#new-cat-budget', '10000 TL');
  await page.click('button:has-text("Create Category")');
  await capture(page, 'TC-01-after-add');
  await page.locator('.card', { hasText: 'TC Category' }).locator('button:has-text("Edit")').first().click();
  await page.fill('#edit-cat-name', 'TC Category Updated');
  await page.fill('#edit-cat-size', '5');
  await page.fill('#edit-cat-budget', '12000 TL');
  await page.click('button:has-text("Save Changes")');
  await capture(page, 'TC-01-after-edit');
  page.once('dialog', d => d.accept());
  await page.locator('.card', { hasText: 'TC Category Updated' }).locator('button:has-text("Delete")').first().click();
  await capture(page, 'TC-01-after-delete');

  // TC-02
  await clickNav(page, 'Announcements');
  await capture(page, 'TC-02-before');
  await page.fill('#ann-title', 'Welcome to UniMatch');
  await page.fill('#ann-desc', 'System live announcement for all users.');
  await page.click('button:has-text("Publish Announcement")');
  await capture(page, 'TC-02-after-publish');
  await logout(page);

  // Instructor flows
  await login(page, instructorEmail, 'password');
  await clickNav(page, 'My Profile');
  await capture(page, 'TC-03-before');
  await page.selectOption('#ip-dept', { label: 'Computer Engineering' });
  await page.fill('#ip-title', 'Assoc. Prof.');
  await page.click('#ip-skills-container .skill-tag:has-text("Machine Learning")');
  await page.click('button:has-text("Save Profile")');
  await capture(page, 'TC-03-after-save');
  await logout(page);

  // Student owner flows
  await login(page, student1Email, 'password');
  await clickNav(page, 'My Profile');
  await capture(page, 'TC-13-before');
  await page.selectOption('#sp-dept', { label: 'Software Engineering' });
  await page.selectOption('#sp-year', '3');
  await page.click('#sp-skills-container .skill-tag:has-text("Python")');
  await page.click('#sp-skills-container .skill-tag:has-text("React")');
  await page.fill('#sp-bio', 'Student profile updated during automated test.');
  await page.click('button:has-text("Save Profile")');
  await capture(page, 'TC-13-after-save');

  await clickNav(page, 'Announcements');
  await capture(page, 'TC-05-view');

  await clickNav(page, 'My Projects');
  await capture(page, 'TC-06-before');
  await page.click('button:has-text("+ Create New Project")');
  await page.fill('#cp-title', projectTitle);
  await page.selectOption('#cp-type', { label: 'TÜBİTAK Student Project' });
  await page.fill('#cp-desc', 'A chatbot for students.');
  await page.fill('#cp-members', '3');
  await page.click('button:has-text("Create Project")');
  await capture(page, 'TC-06-after-create');

  await clickNav(page, 'Advisor Search');
  await capture(page, 'TC-10-before');
  await page.selectOption('#adv-proj', { label: projectTitle });
  await capture(page, 'TC-10-after-search');
  await page.click('button:has-text("Send Request")');
  await capture(page, 'TC-11-after-send');
  await logout(page);

  // Student applicant flows
  await login(page, student2Email, 'password');
  await clickNav(page, 'Projects Market');
  await capture(page, 'TC-07-view');
  const targetProjectCard = page.locator('.pc', { hasText: projectTitle }).first();
  await capture(page, 'TC-08-before');
  await targetProjectCard.locator('button:has-text("Apply Now")').click();
  await capture(page, 'TC-08-after-apply');
  await logout(page);

  // Student owner approves request
  await login(page, student1Email, 'password');
  await clickNav(page, 'My Projects');
  await page.locator('.card', { hasText: projectTitle }).locator('button:has-text("Manage Team & Tasks")').click();
  await capture(page, 'TC-09-before');
  await page.locator('.card', { hasText: student2Name }).locator('button:has-text("Accept")').first().click();
  await capture(page, 'TC-09-after-approve');
  await logout(page);

  // Instructor responds to advisor request
  await login(page, instructorEmail, 'password');
  await clickNav(page, 'Advisor Requests');
  await capture(page, 'TC-04-before');
  const acceptRequestBtn = page.locator('button:has-text("Accept Request")').first();
  if (await acceptRequestBtn.count()) {
    await acceptRequestBtn.click();
  }
  await capture(page, 'TC-04-after-accept');
  await logout(page);

  // Student sees advisor answer
  await login(page, student1Email, 'password');
  await clickNav(page, 'Advisor Search');
  await page.selectOption('#adv-proj', { label: projectTitle });
  await capture(page, 'TC-12-view');

  await browser.close();
  console.log('All tests finished');
})();
