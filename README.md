# 🎓 UniMatch — Web-Based Project Matching & Team Formation Platform

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
├── server.js                 # Ana sunucu dosyası. Express uygulamasını başlatır,
│                             # middleware'leri ve route'ları tanımlar. PORT: 3000
│
├── database.js               # Veritabanı bağlantısı ve tablo oluşturma (initDB).
│                             # Uygulama ilk çalıştığında tabloları ve varsayılan
│                             # kategorileri + admin kullanıcısını oluşturur.
│
├── authMiddleware.js         # JWT doğrulama middleware'i.
│                             # authenticateToken: Token'ı doğrular, kullanıcının
│                             # aktif olup olmadığını DB'den kontrol eder (real-time).
│                             # requireRole: Belirli bir role erişimi kısıtlar.
│
├── seed.js                   # Veritabanını demo verilerle doldurur.
│                             # 12 öğretim üyesi, 25 öğrenci, 8 proje,
│                             # 3 başvuru ve 3 duyuru ekler. Şifre: pass123
│
├── check_users.js            # Yardımcı script. DB'deki tüm kullanıcıların
│                             # email ve rollerini listeler. Debug için kullanılır.
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
│   ├── admin.js              # Kategori CRUD, Duyuru CRUD, Kullanıcı yönetimi,
│   │                         # Sistem metrikleri (GET /metrics)
│   ├── student.js            # Profil, proje listeleme/oluşturma, başvuru,
│   │                         # danışman arama ve isteme, görev yönetimi,
│   │                         # öğrenci arama, davet gönderme
│   ├── instructor.js         # Profil, danışman isteklerini görme/cevaplama,
│   │                         # danışmanlık yapılan projeler ve ekip üyeleri, duyurular
│   └── notifications.js      # Bildirimleri listele ve okundu olarak işaretle
│
├── services/
│   └── notification.js       # sendNotification(userId, msg, type): Tekil bildirim
│                             # notifyAllUsers(msg, type): Tüm aktif kullanıcılara bildirim
│
└── public/                   # Frontend (tarayıcıya gönderilen statik dosyalar)
    ├── index.html            # Tek sayfa uygulamanın HTML iskeleti. Toast, modal
    │                         # ve auth/dashboard view'larını içerir.
    ├── style.css             # Tüm stil tanımları. CSS değişkenleri, layout,
    │                         # bileşen stilleri (kart, buton, form, sidebar vb.)
    └── app.js                # Tüm frontend mantığı (~1400 satır).
                              # Login/register, rol bazlı sidebar, tüm view
                              # render fonksiyonları, API çağrıları, modal/toast
                              # yönetimi burada tanımlanır.
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

Node.js kurulumunu doğrulamak için terminal/komut satırına şunu yaz:
```bash
node --version
npm --version
```

---

### Adım 1 — Repoyu İndir

```bash
git clone <REPO_URL>
```

> `<REPO_URL>` yerine GitHub'daki gerçek repo linkini yaz.

---

### Adım 2 — Proje Klasörüne Gir

```bash
cd "-dosya yolu-"
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

UniMatch giriş ekranı karşına gelecek. Aşağıdaki test kullanıcılarından biriyle giriş yapabilirsin.

---

### Sıfırdan Kurulum Özeti (Hızlı Referans)

```bash
git clone <REPO_URL>
cd "pm project - Kopya/Unimatch"
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

> Toplam 25 öğrenci hesabı `seed.js` tarafından oluşturulur. Diğer öğrenciler için pattern: `{isim_küçük_harf}{sıra_no}@unimatch.edu`

> ⚠️ **Not:** Veritabanında `owner.xxx@unimatch.edu`, `member.xxx@unimatch.edu` gibi timestamp'li hesaplar görünebilir. Bunlar otomatik E2E testlerinin (`run_tests.js`) oluşturduğu geçici test kullanıcılarıdır, şifreleri yoktur/önemsizdir. Sistemi kendiniz test etmek için yukarıdaki seed hesaplarını kullanın.

---

### Yeni Hesap Oluşturma

Kayıt ekranından da yeni hesap açılabilir. Admin hesapları sadece sistem tarafından oluşturulabilir, kayıt formu üzerinden admin kaydı yapılamaz.

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

---

*UniMatch — Üsküdar Üniversitesi | Web Tabanlı Proje Eşleştirme ve Ekip Oluşturma Platformu*
