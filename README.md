# 🎓 UniMatch — Web-Based Project Matching & Team Formation Platform

UniMatch is a web-based platform that makes it easy for university students to create projects, build teams, and find academic advisors.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Technologies Used](#-technologies-used)
3. [Project Architecture](#-project-architecture)
4. [File Structure and Descriptions](#-file-structure-and-descriptions)
5. [Database Schema](#-database-schema)
6. [API Endpoint Summary](#-api-endpoint-summary)
7. [Installation and Running](#-installation-and-running)
8. [Test Users (Pre-configured Accounts)](#-test-users-pre-configured-accounts)
9. [User Roles and Permissions](#-user-roles-and-permissions)

---

## 🎯 Project Overview

UniMatch has three core user roles:

| Role | Description |
|---|---|
| **Admin** | System administration, category/announcement management, user management |
| **Instructor** | Accepting/rejecting advisor requests, project academic advising |
| **Student** | Creating projects, applying to projects, building teams, searching for advisors |

**Supported Project Categories:**
- Course Project
- TÜBİTAK Student Project
- Teknofest Student Project

---

## 🛠 Technologies Used

| Layer | Technology | Description |
|---|---|---|
| **Backend** | Node.js + Express.js v5 | REST API server |
| **Database** | SQLite3 | File-based relational database |
| **Authentication** | JSON Web Token (JWT) | Stateless session management |
| **Password Security** | bcryptjs | Password hashing (salt rounds: 10) |
| **CORS** | cors | Cross-origin request support |
| **Frontend** | Vanilla HTML + CSS + JavaScript | SPA (Single Page Application) |
| **Testing** | Playwright | E2E test automation |

---

## 🏗 Project Architecture

```
[Browser (SPA)]
      │
      │  HTTP / REST API (JSON)
      ▼
[Express.js Server — server.js]
      │
      ├── /api/auth        ← Authentication
      ├── /api/admin       ← Admin operations
      ├── /api/student     ← Student operations
      ├── /api/instructor  ← Instructor operations
      └── /api/notifications ← Notification retrieval
      │
      ▼
[SQLite3 Database — unimatch.db]
```

**Workflow:**
1. The user opens `index.html` → all UI is managed dynamically by `app.js` (SPA).
2. After login, a JWT token is received and saved in `localStorage`.
3. For every API request, the token is sent in the `Authorization: Bearer <token>` header.
4. `authMiddleware.js` verifies the token and checks in real-time whether the user is active in the database.
5. Routes restrict access based on roles (`requireRole`).

---

## 📁 File Structure and Descriptions

```
Unimatch/
│
├── server.js                 # Main server file. Starts the Express app, defines middlewares and routes. PORT: 3000
│
├── database.js               # Database connection and table creation (initDB). Automatically creates tables, default categories, and admin user on first run.
│
├── authMiddleware.js         # JWT verification middleware.
│                             # authenticateToken: Verifies the token and checks user status in real-time.
│                             # requireRole: Restricts access to specific roles.
│
├── seed.js                   # Populates the database with demo data (12 instructors, 25 students, 8 projects, 3 applications, 3 announcements). Password: pass123
│
├── check_users.js            # Helper script. Lists the email and roles of all users in the DB. Used for debugging.
│
├── run_tests.js              # Automated E2E test runner with Playwright.
│
├── test_all_functions.js     # Script testing all API functions.
│
├── package.json              # Project dependencies and metadata.
├── unimatch.db               # SQLite database file (automatically created).
│
├── routes/                   # API Route definitions (where operations occur)
│   ├── auth.js               # POST /register, POST /login
│   ├── admin.js              # Category CRUD, Announcement CRUD, User management, System metrics (GET /metrics)
│   ├── student.js            # Profile, project listing/creation, applications, advisor search & requests, task management, student search, invites, member removal
│   ├── instructor.js         # Profile, viewing/answering advisor requests, supervised projects & team members, announcements
│   └── notifications.js      # List notifications and mark as read
│
├── services/
│   └── notification.js       # sendNotification: Single notification, notifyAllUsers: Notifications to all active users
│
└── public/                   # Frontend (static files served to the browser)
    ├── index.html            # HTML skeleton for Single Page Application. Contains toast, modal, and auth/dashboard views.
    ├── style.css             # All styling. Defines CSS variables, layout, component styles (card, button, form, sidebar, etc.).
    └── app.js                # All frontend logic (~1400 lines). Manages login/register, role-based sidebar, view rendering, API calls, modals, and toasts.
```

---

## 🗄 Database Schema

| Table | Description |
|---|---|
| `Users` | All users (id, name, email, password_hash, role, is_active) |
| `StudentProfiles` | Student profile details (department, year, interests, skills, GitHub/LinkedIn) |
| `InstructorProfiles` | Instructor profile details (department, academic_title, expertise, availability) |
| `ProjectCategories` | Project categories (Course, TÜBİTAK, Teknofest) + constraints |
| `Announcements` | System announcements (title, description, category, creator, creation time) |
| `Projects` | Projects (title, type, description, required skills/members, owner, advisor) |
| `ProjectApplications` | Project applications (Pending/Accepted/Rejected) — invitations are also managed here |
| `AdvisorRequests` | Advisor requests (Pending/Accepted/Rejected) |
| `Notifications` | User notifications |
| `ProjectTasks` | Project tasks (Todo/In Progress/Done) |

---

## 🔌 API Endpoint Summary

### Auth (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register new user (student/instructor) |
| POST | `/login` | Login → returns JWT token |

### Admin (`/api/admin`) — Admin token required
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/categories` | List / create categories |
| PUT/DELETE | `/categories/:id` | Update / delete category |
| GET/POST | `/announcements` | List / publish announcements |
| PUT/DELETE | `/announcements/:id` | Update / delete announcement |
| GET | `/users` | List all users |
| PUT | `/users/:id/deactivate` | Deactivate user |
| PUT | `/users/:id/reactivate` | Reactivate user |
| PUT | `/users/:id/role` | Change user role |
| DELETE | `/users/:id` | Permanently delete user |
| GET | `/metrics` | Get system statistics |

### Student (`/api/student`) — Student token required
| Method | Endpoint | Description |
|---|---|---|
| GET/PUT | `/profile` | View / update profile |
| GET | `/announcements` | View announcements |
| GET | `/projects` | List all projects (marketplace) |
| POST | `/projects` | Create new project |
| POST | `/projects/:id/apply` | Apply to a project |
| GET | `/my-projects` | List own projects |
| GET | `/my-applications` | List my applications |
| PUT | `/my-applications/:app_id/respond` | Respond (Accept/Decline) to incoming project invitations |
| DELETE | `/my-applications/:app_id` | Withdraw application |
| GET | `/my-projects/incoming-applications` | View incoming project applications |
| PUT | `/projects/:id/applications/:app_id/respond` | Accept/Reject incoming project applications |
| GET | `/instructors` | List available advisors |
| POST | `/projects/:id/advisor-request` | Send advisor request |
| GET | `/my-advisor-requests` | Status of sent advisor requests |
| DELETE | `/my-advisor-requests/:id` | Withdraw advisor request |
| GET | `/students` | Search students (with department/skill filters) |
| POST | `/projects/:id/invite` | Invite student to project |
| DELETE | `/projects/:id/members/:userId` | Remove a member or advisor from the project team (Project Owner only) |
| GET | `/my-tasks` | List tasks assigned to me |
| GET/POST | `/projects/:id/tasks` | Project tasks |
| PUT | `/projects/:id/tasks/:taskId` | Update task status |

### Instructor (`/api/instructor`) — Instructor token required
| Method | Endpoint | Description |
|---|---|---|
| GET/PUT | `/profile` | View / update profile |
| GET | `/announcements` | View announcements |
| GET | `/supervised-projects` | List supervised projects |
| GET | `/supervised-projects/:id/members` | View team members of a supervised project |
| GET | `/requests` | View incoming advisor requests |
| PUT | `/requests/:id/respond` | Accept/Reject advisor request |
| DELETE | `/requests/:id` | Delete advisor request |

### Notifications (`/api/notifications`) — Auth required
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List notifications (last 20, descending order) |
| PUT | `/read-all` | Mark all notifications as read |
| PUT | `/:id/read` | Mark single notification as read |

---

## 🚀 Installation and Running

### Prerequisites

- **Node.js** (v18 or higher) → Download from [nodejs.org](https://nodejs.org/)
- **npm** (comes packaged with Node.js)
- **Git** → Download from [git-scm.com](https://git-scm.com/)

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/Zana-C/Unimatch.git
```

---

### Step 2 — Go to Project Directory

```bash
cd Unimatch
```

---

### Step 3 — Install Dependencies

```bash
npm install
```

This creates the `node_modules` folder and downloads all necessary packages.

---

### Step 4 — Prepare the Database (With Demo Data)

If you want to start with a **blank database**, skip this step — the database is created automatically on the first run.

To populate it with demo data (12 instructors, 25 students, 8 projects, and announcements):

```bash
node seed.js
```

> ⚠️ **Caution:** Run `seed.js` only **once**. Running it multiple times will append duplicate data.

---

### Step 5 — Start the Server

```bash
node server.js
```

You should see this in the terminal:
```
Server is running on http://localhost:3000
```

---

### Step 6 — Open in Browser

Open your browser and navigate to:

```
http://localhost:3000
```

---

## 🔑 Test Users (Pre-configured Accounts)

> The password for all seed users is: **`pass123`**

### Admin Account

| Field | Value |
|---|---|
| **Email** | `admin@unimatch.edu` |
| **Password** | `admin123` |
| **Role** | Admin |

> The admin account is created automatically even if `seed.js` is not run.

---

### Instructor Accounts (created via seed.js)

| Name | Email | Password |
|---|---|---|
| Dr. Ahmet Yılmaz | `ahmet.yilmaz@unimatch.edu` | `pass123` |
| Dr. Elif Kaya | `elif.kaya@unimatch.edu` | `pass123` |
| Dr. Mehmet Demir | `mehmet.demir@unimatch.edu` | `pass123` |
| Dr. Selin Aksoy | `selin.aksoy@unimatch.edu` | `pass123` |
| Dr. Caner Bulut | `caner.bulut@unimatch.edu` | `pass123` |
| Dr. Merve Tan | `merve.tan@unimatch.edu` | `pass123` |
| Dr. Burak Can | `burak.can@unimatch.edu` | `pass123` |
| Dr. Özlem Yıldız | `ozlem.yildiz@unimatch.edu` | `pass123` |
| Dr. Deniz Kılıç | `deniz.kilic@unimatch.edu` | `pass123` |
| Dr. Hakan Arslan | `hakan.arslan@unimatch.edu` | `pass123` |
| Dr. Yasemin Koç | `yasemin.koc@unimatch.edu` | `pass123` |
| Dr. Murat Aydın | `murat.aydin@unimatch.edu` | `pass123` |

---

### Student Accounts (created via seed.js — first 10 examples)

| Name | Email | Password |
|---|---|---|
| Zeynep Arslan | `zeynep1@unimatch.edu` | `pass123` |
| Caner Yildiz | `caner2@unimatch.edu` | `pass123` |
| Merve Celik | `merve3@unimatch.edu` | `pass123` |
| Burak Aydin | `burak4@unimatch.edu` | `pass123` |
| Selin Bakir | `selin5@unimatch.edu` | `pass123` |
| Emre Ozturk | `emre6@unimatch.edu` | `pass123` |
| Aslı Kilic | `asli7@unimatch.edu` | `pass123` |
| Mert Demir | `mert8@unimatch.edu` | `pass123` |
| Gizem Aksoy | `gizem9@unimatch.edu` | `pass123` |
| Onur Sahin | `onur10@unimatch.edu` | `pass123` |

---

## 👤 User Roles and Permissions

### 🔴 Admin
- Create, edit, and delete project categories
- Publish, edit, and delete system-wide announcements
- View all users
- Change user roles
- Deactivate / activate users
- Permanently delete users
- View system metrics (total users, total projects, etc.)

### 🟡 Instructor
- View and edit academic profile
- View incoming advisor requests
- Accept or reject advisor requests
- View supervised projects
- View team members of supervised projects
- View system announcements

### 🟢 Student
- View and edit student profile
- View system announcements
- View and filter projects (Project Marketplace)
- Create new projects (becomes the Project Owner)
- Apply to projects
- Accept or reject applications to their own project
- Invite other students to their project team
- Accept or reject project invitations
- Search for advisors and send advisor requests (for TÜBİTAK/Teknofest)
- Track advisor requests
- Assign tasks to team members
- View assigned tasks and update status

---
---

## 🇹🇷 Türkçe Dokümantasyon

### 🎓 UniMatch — Web Tabanlı Proje Eşleştirme & Ekip Kurma Platformu

UniMatch, üniversite öğrencilerinin proje oluşturmasını, ekip kurmasını ve akademik danışman bulmasını kolaylaştıran web tabanlı bir platformdur.

---

## 📋 İçindekiler

1. [Proje Genel Bakış](#-proje-genel-bakış)
2. [Kullanılan Teknolojiler](#-kullanılan-teknolojiler)
3. [Proje Mimarisi](#-proje-mimarisi)
4. [Dosya Yapısı ve Açıklamaları](#-dosya-yapısı-ve-açıklamaları)
5. [Veritabanı Şeması](#-veritabanı-şeması)
6. [API Endpoint Özeti](#-api-endpoint-özeti)
7. [Kurulum ve Çalıştırma](#-kurulum-ve-çalıştırma)
8. [Test Kullanıcıları (Hazır Hesaplar)](#-test-kullanıcıları-hazır-hesaplar)
9. [Kullanıcı Rolleri ve Yetkiler](#-kullanıcı-rolleri-ve-yetkiler)

---

## 🎯 Proje Genel Bakış

UniMatch, üç temel kullanıcı rolüne sahiptir:

| Rol | Açıklama |
|---|---|
| **Admin** | Sistem yönetimi, kategori/duyuru yönetimi, kullanıcı yönetimi |
| **Instructor (Öğretim Üyesi)** | Danışman isteklerini kabul/reddetme, proje danışmanlığı |
| **Student (Öğrenci)** | Proje oluşturma, projeye başvurma, ekip kurma, danışman arama |

**Desteklenen Proje Kategorileri:**
- Course Project (Ders Projesi)
- TÜBİTAK Student Project
- Teknofest Student Project

---

## 🛠 Kullanılan Teknolojiler

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **Backend** | Node.js + Express.js v5 | REST API sunucusu |
| **Veritabanı** | SQLite3 | Dosya tabanlı ilişkisel veritabanı |
| **Kimlik Doğrulama** | JSON Web Token (JWT) | Stateless oturum yönetimi |
| **Şifre Güvenliği** | bcryptjs | Şifre hash'leme (salt rounds: 10) |
| **CORS** | cors | Cross-origin istek desteği |
| **Frontend** | Vanilla HTML + CSS + JavaScript | SPA (Single Page Application) |
| **Test** | Playwright | E2E test otomasyonu |

---

## 🏗 Proje Mimarisi

```
[Tarayıcı (SPA)]
      │
      │  HTTP / REST API (JSON)
      ▼
[Express.js Sunucusu — server.js]
      │
      ├── /api/auth        ← Kimlik doğrulama
      ├── /api/admin       ← Admin işlemleri
      ├── /api/student     ← Öğrenci işlemleri
      ├── /api/instructor  ← Öğretim üyesi işlemleri
      └── /api/notifications ← Bildirim okuma
      │
      ▼
[SQLite3 Veritabanı — unimatch.db]
```

**Akış:**
1. Kullanıcı `index.html`'i açar → tüm UI `app.js` tarafından yönetilir (SPA)
2. Login sonrası JWT token alınır, `localStorage`'a kaydedilir
3. Her API isteğinde token `Authorization: Bearer <token>` header'ı ile gönderilir
4. `authMiddleware.js` token'ı doğrular ve kullanıcının aktif olup olmadığını kontrol eder
5. Route'lar role göre erişimi kısıtlar (`requireRole`)

---

## 📁 Dosya Yapısı ve Açıklamaları

```
Unimatch/
│
├── server.js                 # Ana sunucu dosyası. Express uygulamasını başlatır, middleware'leri ve route'ları tanımlar. PORT: 3000
│
├── database.js               # Veritabanı bağlantısı ve tablo oluşturma (initDB). Uygulama ilk çalıştığında tabloları ve varsayılan kategorileri + admin kullanıcısını oluşturur.
│
├── authMiddleware.js         # JWT doğrulama middleware'i.
│                             # authenticateToken: Token'ı doğrular, kullanıcının aktif olup olmadığını DB'den kontrol eder (real-time).
│                             # requireRole: Belirli bir role erişimi kısıtlar.
│
├── seed.js                   # Veritabanını demo verilerle doldurur. 12 öğretim üyesi, 25 öğrenci, 8 proje, 3 başvuru ve 3 duyuru ekler. Şifre: pass123
│
├── check_users.js            # Yardımcı script. DB'deki tüm kullanıcıların email ve rollerini listeler. Debug için kullanılır.
│
├── run_tests.js              # Playwright ile otomatik E2E test koşucusu.
│
├── test_all_functions.js     # Tüm API fonksiyonlarını test eden script.
│
├── package.json              # Proje bağımlılıkları ve metadata.
├── unimatch.db               # SQLite veritabanı dosyası (otomatik oluşturulur).
│
├── routes/                   # API Route tanımları (işlemlerin gerçekleştiği yer)
│   ├── auth.js               # POST /register, POST /login
│   ├── admin.js              # Kategori CRUD, Duyuru CRUD, Kullanıcı yönetimi, Sistem metrikleri (GET /metrics)
│   ├── student.js            # Profil, proje listeleme/oluşturma, başvuru, danışman arama ve isteme, görev yönetimi, öğrenci arama, davet gönderme, ekip üyesi çıkarma
│   ├── instructor.js         # Profil, danışman isteklerini görme/cevaplama, danışmanlık yapılan projeler ve ekip üyeleri, duyurular
│   └── notifications.js      # Bildirimleri listele ve okundu olarak işaretle
│
├── services/
│   └── notification.js       # sendNotification(userId, msg, type): Tekil bildirim, notifyAllUsers(msg, type): Tüm aktif kullanıcılara bildirim
│
└── public/                   # Frontend (tarayıcıya gönderilen statik dosyalar)
    ├── index.html            # Tek sayfa uygulamanın HTML iskeleti. Toast, modal ve auth/dashboard view'larını içerir.
    ├── style.css             # Tüm stil tanımları. CSS değişkenleri, layout, bileşen stilleri (kart, buton, form, sidebar vb.)
    └── app.js                # Tüm frontend mantığı (~1400 satır). Login/register, rol bazlı sidebar, tüm view render fonksiyonları, API çağrıları, modal/toast yönetimi burada tanımlanır.
```

---

## 🗄 Veritabanı Şeması

| Tablo | Açıklama |
|---|---|
| `Users` | Tüm kullanıcılar (id, name, email, password_hash, role, is_active) |
| `StudentProfiles` | Öğrenci profil detayları (bölüm, sınıf, beceriler, GitHub/LinkedIn) |
| `InstructorProfiles` | Öğretim üyesi profil detayları (bölüm, unvan, uzmanlık, müsaitlik) |
| `ProjectCategories` | Proje kategorileri (Course, TÜBİTAK, Teknofest) + kısıtlar |
| `Announcements` | Sistem duyuruları (başlık, açıklama, kategori, oluşturan, oluşturma zamanı) |
| `Projects` | Projeler (başlık, tür, açıklama, gereken beceri/üye, sahibi, danışmanı) |
| `ProjectApplications` | Proje başvuruları (Pending/Accepted/Rejected) — davetler de burada |
| `AdvisorRequests` | Danışman istekleri (Pending/Accepted/Rejected) |
| `Notifications` | Kullanıcı bildirimleri |
| `ProjectTasks` | Proje görevleri (Todo/In Progress/Done) |

---

## 🔌 API Endpoint Özeti

### Auth (`/api/auth`)
| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/register` | Yeni kullanıcı kaydı (student/instructor) |
| POST | `/login` | Giriş → JWT token döner |

### Admin (`/api/admin`) — Admin token gerekli
| Method | Endpoint | Açıklama |
|---|---|---|
| GET/POST | `/categories` | Kategori listele / oluştur |
| PUT/DELETE | `/categories/:id` | Kategori güncelle / sil |
| GET/POST | `/announcements` | Duyuru listele / yayınla |
| PUT/DELETE | `/announcements/:id` | Duyuru güncelle / sil |
| GET | `/users` | Tüm kullanıcıları listele |
| PUT | `/users/:id/deactivate` | Kullanıcı deaktive et |
| PUT | `/users/:id/reactivate` | Kullanıcı aktive et |
| PUT | `/users/:id/role` | Kullanıcı rolü değiştir |
| DELETE | `/users/:id` | Kullanıcı kalıcı sil |
| GET | `/metrics` | Sistem istatistikleri |

### Student (`/api/student`) — Student token gerekli
| Method | Endpoint | Açıklama |
|---|---|---|
| GET/PUT | `/profile` | Profil görüntüle / güncelle |
| GET | `/announcements` | Duyuruları görüntüle |
| GET | `/projects` | Tüm projeleri listele (marketplace) |
| POST | `/projects` | Yeni proje oluştur |
| POST | `/projects/:id/apply` | Projeye başvur |
| GET | `/my-projects` | Kendi projelerini listele |
| GET | `/my-applications` | Başvurularımı listele |
| PUT | `/my-applications/:app_id/respond` | Gelen daveti kabul/reddet |
| DELETE | `/my-applications/:app_id` | Başvuruyu geri çek |
| GET | `/my-projects/incoming-applications` | Gelen başvuruları gör |
| PUT | `/projects/:id/applications/:app_id/respond` | Başvuruyu kabul/reddet |
| GET | `/instructors` | Müsait danışmanları listele |
| POST | `/projects/:id/advisor-request` | Danışman isteği gönder |
| GET | `/my-advisor-requests` | Danışman isteklerimin durumu |
| DELETE | `/my-advisor-requests/:id` | Danışman isteğini geri çek |
| GET | `/students` | Öğrenci ara (bölüm/beceri filtresi) |
| POST | `/projects/:id/invite` | Öğrenciyi projeye davet et |
| DELETE | `/projects/:id/members/:userId` | Ekip üyesini/danışmanı ekipten çıkar (Proje Sahibi) |
| GET | `/my-tasks` | Kendime atanan görevleri listele |
| GET/POST | `/projects/:id/tasks` | Proje görevleri |
| PUT | `/projects/:id/tasks/:taskId` | Görev durumu güncelle |

### Instructor (`/api/instructor`) — Instructor token gerekli
| Method | Endpoint | Açıklama |
|---|---|---|
| GET/PUT | `/profile` | Profil görüntüle / güncelle |
| GET | `/announcements` | Duyuruları görüntüle |
| GET | `/supervised-projects` | Danışmanlık yapılan projeler |
| GET | `/supervised-projects/:id/members` | Danışmanlık yapılan projenin ekip üyelerini görüntüle |
| GET | `/requests` | Gelen danışman istekleri |
| PUT | `/requests/:id/respond` | İsteği kabul/reddet |
| DELETE | `/requests/:id` | İsteği sil |

### Notifications (`/api/notifications`) — Auth gerekli
| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/` | Bildirimleri listele (son 20, DESC sıralı) |
| PUT | `/read-all` | Tüm bildirimleri okundu işaretle |
| PUT | `/:id/read` | Tek bildirimi okundu işaretle |

---

## 🚀 Kurulum ve Çalıştırma

### Ön Koşullar

- **Node.js** (v18 veya üzeri) → [nodejs.org](https://nodejs.org/) adresinden indirebilirsin
- **npm** (Node.js ile birlikte gelir)
- **Git** → [git-scm.com](https://git-scm.com/) adresinden indirebilirsin

---

### Adım 1 — Repoyu İndir

```bash
git clone https://github.com/Zana-C/Unimatch.git
```

---

### Adım 2 — Proje Klasörüne Gir

```bash
cd Unimatch
```

---

### Adım 3 — Bağımlılıkları Yükle

```bash
npm install
```

Bu komut `node_modules` klasörünü oluşturur ve gerekli tüm paketleri indirir.

---

### Adım 4 — Veritabanını Hazırla (Demo Verilerle)

Eğer **boş bir veritabanıyla** başlamak istersen bu adımı atla — veritabanı ilk çalıştırmada otomatik oluşur.

Demo verilerle doldurmak için (12 öğretim üyesi, 25 öğrenci, 8 proje, duyurular):

```bash
node seed.js
```

> ⚠️ **Dikkat:** `seed.js`'i yalnızca **bir kere** çalıştır. Tekrar çalıştırırsan mevcut veriler üzerine ekleme yapar.

---

### Adım 5 — Sunucuyu Başlat

```bash
node server.js
```

Terminal çıktısında şunu görmelisin:
```
Server is running on http://localhost:3000
```

---

### Adım 6 — Tarayıcıda Aç

Tarayıcını aç ve şu adrese git:

```
http://localhost:3000
```

---

### Sıfırdan Kurulum Özeti (Hızlı Referans)

```bash
git clone https://github.com/Zana-C/Unimatch.git
cd Unimatch
npm install
node seed.js      # (isteğe bağlı — demo veri)
node server.js
# Tarayıcıda: http://localhost:3000
```

---

## 🔑 Test Kullanıcıları (Hazır Hesaplar)

> Tüm seed kullanıcılarının şifresi: **`pass123`**

### Admin Hesabı

| Alan | Değer |
|---|---|
| **Email** | `admin@unimatch.edu` |
| **Şifre** | `admin123` |
| **Rol** | Admin |

> Admin hesabı `seed.js` çalıştırılmadan da otomatik olarak oluşur.

---

### Öğretim Üyesi Hesapları (seed.js ile oluşur)

| İsim | Email | Şifre |
|---|---|---|
| Dr. Ahmet Yılmaz | `ahmet.yilmaz@unimatch.edu` | `pass123` |
| Dr. Elif Kaya | `elif.kaya@unimatch.edu` | `pass123` |
| Dr. Mehmet Demir | `mehmet.demir@unimatch.edu` | `pass123` |
| Dr. Selin Aksoy | `selin.aksoy@unimatch.edu` | `pass123` |
| Dr. Caner Bulut | `caner.bulut@unimatch.edu` | `pass123` |
| Dr. Merve Tan | `merve.tan@unimatch.edu` | `pass123` |
| Dr. Burak Can | `burak.can@unimatch.edu` | `pass123` |
| Dr. Özlem Yıldız | `ozlem.yildiz@unimatch.edu` | `pass123` |
| Dr. Deniz Kılıç | `deniz.kilic@unimatch.edu` | `pass123` |
| Dr. Hakan Arslan | `hakan.arslan@unimatch.edu` | `pass123` |
| Dr. Yasemin Koç | `yasemin.koc@unimatch.edu` | `pass123` |
| Dr. Murat Aydın | `murat.aydin@unimatch.edu` | `pass123` |

---

### Öğrenci Hesapları (seed.js ile oluşur — ilk 10 örnek)

| İsim | Email | Şifre |
|---|---|---|
| Zeynep Arslan | `zeynep1@unimatch.edu` | `pass123` |
| Caner Yildiz | `caner2@unimatch.edu` | `pass123` |
| Merve Celik | `merve3@unimatch.edu` | `pass123` |
| Burak Aydin | `burak4@unimatch.edu` | `pass123` |
| Selin Bakir | `selin5@unimatch.edu` | `pass123` |
| Emre Ozturk | `emre6@unimatch.edu` | `pass123` |
| Aslı Kilic | `asli7@unimatch.edu` | `pass123` |
| Mert Demir | `mert8@unimatch.edu` | `pass123` |
| Gizem Aksoy | `gizem9@unimatch.edu` | `pass123` |
| Onur Sahin | `onur10@unimatch.edu` | `pass123` |

---

## 👤 Kullanıcı Rolleri ve Yetkiler

### 🔴 Admin
- Proje kategorilerini oluştur, düzenle, sil
- Sistem geneli duyuru yayınla, düzenle, sil
- Tüm kullanıcıları görüntüle
- Kullanıcı rolü değiştir
- Kullanıcı deaktive / aktive et
- Kullanıcıyı kalıcı sil
- Sistem metriklerini görüntüle (toplam kullanıcı, proje sayısı vb.)

### 🟡 Instructor (Öğretim Üyesi)
- Kendi profilini görüntüle ve düzenle (bölüm, unvan, uzmanlık, müsaitlik)
- Gelen danışman isteklerini görüntüle
- Danışman isteklerini kabul veya reddet
- Danışmanlık yaptığı projeleri görüntüle
- Danışmanlık yaptığı projelerin **ekip üyelerini görüntüle** (View Team)
- Sistem duyurularını görüntüle

### 🟢 Student (Öğrenci)
- Kendi profilini görüntüle ve düzenle
- Sistem duyurularını görüntüle
- Proje ilanlarını görüntüle ve filtrele (Project Marketplace)
- Yeni proje oluştur (Proje Sahibi olur)
- Projelere başvur
- Kendi projesine gelen başvuruları kabul/reddet
- Ekibi için diğer öğrencileri davet et
- Davetlere kabul/red cevabı ver
- TÜBİTAK/Teknofest projeleri için danışman ara ve istek gönder
- Gönderilen danışman isteklerinin durumunu takip et
- Proje ekibine görev ata
- Kendi görevlerini görüntüle ve durumunu güncelle

---

## ⚠️ Önemli Notlar

- **Veritabanı dosyası** (`unimatch.db`) `.gitignore`'a eklenmediyse repoya dahildir. GitHub'dan indirince mevcut verilerle gelir.
- **seed.js** yalnızca boş veritabanı için çalıştırılmalıdır. Tekrar çalıştırılırsa `INSERT OR IGNORE` sayesinde çakışan kayıtlar atlanır.
- **TÜBİTAK ve Teknofest** projeleri için öğrenci aynı anda yalnızca **bir** projeye sahip olabilir veya üye olabilir.
- **Danışman istekleri** yalnızca TÜBİTAK ve Teknofest proje tipleri için gönderilebilir.
- Sunucu varsayılan olarak **3000** portunu kullanır. Port değiştirmek için `PORT` ortam değişkeni kullanılabilir:
  ```bash
  PORT=8080 node server.js
  ```
- JWT token süresi **24 saat**'tir. Süresi dolunca tekrar giriş yapılması gerekir.
