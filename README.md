# 📦 Template JLine HTML

Template dự án web tĩnh (static site) sử dụng **EJS + SCSS + JavaScript** với hệ thống build tự động và CI/CD deploy lên FTP server.

---

## 📋 Mục lục

- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt & Chạy dự án](#-cài-đặt--chạy-dự-án)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Cách thức hoạt động](#-cách-thức-hoạt-động)
- [Setup Server Deploy (CI/CD)](#-setup-server-deploy-cicd)
- [Xử lý sự cố](#-xử-lý-sự-cố)

---

## 💻 Yêu cầu hệ thống

| Công cụ  | Phiên bản tối thiểu |
| -------- | -------------------- |
| Node.js  | v20 trở lên          |
| npm      | v9 trở lên           |
| Git      | v2 trở lên           |

---

## 🚀 Cài đặt & Chạy dự án

### 1. Clone dự án

```bash
git clone https://github.com/hiep-dev-023/template_jline_html.git
cd template_jline_html
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Chạy môi trường phát triển (Development)

```bash
npm run dev
```

- Tự động build toàn bộ file EJS, SCSS, JS, images
- Mở trình duyệt tại **http://localhost:8080**
- **Hot reload**: Tự động reload khi bạn sửa file trong thư mục `src/`

### 4. Build sản phẩm (Production)

```bash
npm run build
```

- Build một lần, xuất kết quả vào thư mục `public/`
- Dùng khi cần kiểm tra kết quả build trước khi push

### 5. Dọn dẹp thư mục build

```bash
npm run clean
```

- Xóa toàn bộ thư mục `public/` (output đã build)

---

## 📁 Cấu trúc dự án

```
template_jline_html/
├── src/                          ← 📝 SOURCE CODE (viết code ở đây)
│   ├── layouts/                  ← Layout dùng chung
│   │   ├── _default.ejs          ← Layout chính (HTML wrapper)
│   │   ├── _header.ejs           ← Header component
│   │   └── _footer.ejs           ← Footer component
│   ├── assets/                   ← Tài nguyên tĩnh
│   │   ├── scss/                 ← File SCSS (style)
│   │   ├── js/                   ← File JavaScript
│   │   ├── images/               ← Hình ảnh gốc (tự chuyển sang WebP)
│   │   └── vendor/               ← Thư viện bên ngoài (jQuery, Slick, AOS...)
│   ├── index.ejs                 ← Trang chủ
│   ├── sample.ejs                ← Trang mẫu
│   └── about/                    ← Trang con
│       └── index.ejs
│
├── public/                       ← 📤 OUTPUT (tự động sinh, KHÔNG sửa tay)
│   ├── index.html                ← HTML đã compile từ EJS
│   ├── assets/
│   │   ├── css/                  ← CSS đã compile từ SCSS
│   │   ├── js/                   ← JS đã xử lý
│   │   └── images/               ← Hình ảnh đã tối ưu (WebP)
│   └── about/
│       └── index.html
│
├── scripts/                      ← 🔧 Build scripts
│   ├── build.js                  ← Script build chính
│   └── clean.js                  ← Script dọn dẹp
│
├── .github/                      ← ⚙️ CI/CD
│   ├── workflows/
│   │   └── deploy.yml            ← GitHub Actions workflow
│   └── scripts/
│       └── deploy.cjs            ← Script deploy lên FTP
│
├── deploy-config.json            ← 🔑 Cấu hình deploy cho dự án
├── package.json                  ← Dependencies & scripts
└── .gitignore
```

---

## ⚙️ Cách thức hoạt động

### Quy trình Build

```
src/ (EJS + SCSS + JS + Images)
          │
          ▼
    scripts/build.js
          │
          ▼
public/ (HTML + CSS + JS + WebP)
```

| Loại file     | Xử lý                                                         |
| ------------- | -------------------------------------------------------------- |
| `.ejs`        | Compile thành `.html`, hỗ trợ layout và include component     |
| `.scss`       | Compile thành `.css`, tự động thêm prefix, nén (minify)       |
| `.js`         | Copy và xử lý                                                 |
| Hình ảnh      | Tự động chuyển đổi `.jpg/.png` → `.webp` để tối ưu dung lượng |
| `vendor/`     | Copy nguyên bản các thư viện bên ngoài                         |

### Hệ thống Layout (EJS)

Mỗi trang EJS sử dụng **front matter** (khối `---`) ở đầu file để khai báo metadata. Layout `_default.ejs` sẽ đọc các trường này để tự động sinh thẻ `<title>`, `<meta>`, `<link>`, `<script>`.

#### Ví dụ đầy đủ (trang chủ `src/index.ejs`)

```ejs
---
layout: _default
title: Trang chủ
description: Mô tả trang chủ cho SEO
keyword: từ khóa 1, từ khóa 2
vendorcss: ['aos/aos','slick/slick']
vendorjs: ['aos/aos','slick/slick.min']
css: ['common','top']
js: ['common','top']
page: top
---

<main class="p-top">
    <h1>Nội dung trang</h1>
</main>
```

#### Ví dụ trang con (`src/about/index.ejs`)

```ejs
---
layout: _default
title: about
description: description About
keyword: keyword About
vendorcss: ['aos/aos','slick/slick']
vendorjs: ['aos/aos','slick/slick.min']
css: ['common','about']
js: ['common','about']
page: about
---

<main class="p-about">
    <h1>Nội dung trang About</h1>
</main>
```

#### Bảng giải thích các trường Front Matter

| Trường       | Bắt buộc | Kiểu dữ liệu | Mô tả                                                                                                |
| ------------ | -------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `layout`     | ✅       | `string`       | Layout sử dụng — tương ứng file trong `src/layouts/` (ví dụ: `_default` → `_default.ejs`)             |
| `title`      | ✅       | `string`       | Tiêu đề trang, hiển thị trên tab trình duyệt và thẻ `<meta og:title>`                                |
| `description`| ❌       | `string`       | Mô tả trang cho SEO — sinh ra thẻ `<meta name="description">` và `<meta og:description>`             |
| `keyword`    | ❌       | `string`       | Từ khóa SEO — sinh ra thẻ `<meta name="keywords">`                                                   |
| `vendorcss`  | ❌       | `array`        | Danh sách file CSS thư viện ngoài cần load, đường dẫn tương đối từ `src/assets/vendor/` (không cần đuôi `.css`) |
| `vendorjs`   | ❌       | `array`        | Danh sách file JS thư viện ngoài cần load, đường dẫn tương đối từ `src/assets/vendor/` (không cần đuôi `.js`)   |
| `css`        | ❌       | `array`        | Danh sách file CSS riêng cho trang, đường dẫn tương đối từ `src/assets/scss/` (không cần đuôi `.css`)            |
| `js`         | ❌       | `array`        | Danh sách file JS riêng cho trang, đường dẫn tương đối từ `src/assets/js/` (không cần đuôi `.js`)               |
| `page`       | ❌       | `string`       | Tên trang, dùng để phân biệt class CSS trên `<body>` hoặc logic trong layout                          |

#### Thứ tự load trong HTML (sinh bởi `_default.ejs`)

```
<head>
  ├── <meta> tags (title, description, keyword, og:*)
  ├── <link> vendorcss   ← CSS thư viện (AOS, Slick...)
  └── <link> css         ← CSS riêng của trang (common, top...)
</head>
<body>
  ├── Header (_header.ejs)
  ├── Nội dung trang (contents)
  ├── Footer (_footer.ejs)
  ├── <script> jQuery     ← Luôn load jQuery trước
  ├── <script> cookie.js  ← Luôn load cookie.js
  ├── <script> vendorjs   ← JS thư viện (AOS, Slick...)
  └── <script> js         ← JS riêng của trang (common, top...)
</body>
```

> **💡 Lưu ý**: jQuery (`vendor/jquery/jquery-3.5.1.min.js`) và `cookie.js` được layout **tự động load** cho mọi trang, không cần khai báo trong front matter.

---

## 🚀 Setup Server Deploy (CI/CD)

Hệ thống tự động deploy code lên FTP server mỗi khi push code lên nhánh `main`.

### Tổng quan quy trình

```
Push code lên main
       │
       ▼
GitHub Actions chạy workflow
       │
       ├── 1. Cài Node.js & dependencies
       ├── 2. Build dự án (npm run build)
       ├── 3. Kết nối FTP server
       ├── 4. Kiểm tra bảo mật (.repo_lock)
       └── 5. Upload file lên server
```

### Bước 1: Cấu hình `deploy-config.json`

File này nằm ở **gốc dự án**, khai báo thông tin deploy:

```json
{
  "server": "SERVER_A",
  "project_dir": "template_jline_html",
  "source_folder": "public",
  "has_build_step": true,
  "build_command": "npm run build",
  "basic_auth": {
    "username": "tester",
    "password": "mat_khau_test_123"
  }
}
```

| Trường           | Mô tả                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `server`         | Tên server (dùng để ghép với `_CONFIG` tìm GitHub Secret, ví dụ: `SERVER_A` → `SERVER_A_CONFIG`) |
| `project_dir`    | Tên thư mục trên server FTP (chỉ cho phép chữ, số, `-`, `_`)                                    |
| `source_folder`  | Thư mục chứa file cần upload (thường là `public`)                                               |
| `has_build_step` | `true` nếu dự án cần build trước khi deploy                                                     |
| `build_command`  | Lệnh build (mặc định: `npm run build`)                                                          |
| `basic_auth`     | Thông tin đăng nhập Basic Auth bảo vệ trang web                                                 |

### Bước 2: Tạo GitHub Secret cho FTP Server

Vì **GitHub Free plan** không hỗ trợ Organization Secrets cho repo private, nên cần tạo **Repository Secret**.

1. Vào repo trên GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Nhấn **"New repository secret"**
3. Đặt tên: `SERVER_A_CONFIG` (ghép từ trường `server` + `_CONFIG`)
4. Nhập giá trị JSON chứa thông tin FTP:

```json
{
  "host": "ftp.example.com",
  "user": "ftp_username",
  "pass": "ftp_password",
  "ftp_dir": "./public_html/client/github_deploy",
  "root_path": "/home/username/public_html/client/github_deploy"
}
```

| Trường      | Mô tả                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| `host`      | Địa chỉ FTP server                                                      |
| `user`      | Tên đăng nhập FTP                                                        |
| `pass`      | Mật khẩu FTP                                                             |
| `ftp_dir`   | Đường dẫn **tương đối** đến thư mục chứa dự án trên FTP                 |
| `root_path` | Đường dẫn **tuyệt đối** trên server (dùng cho `.htpasswd` trong Apache)  |

> ⚠️ **Lưu ý**: `ftp_dir` và `root_path` trỏ đến **thư mục cha** chứa các dự án, KHÔNG bao gồm tên `project_dir`. Script sẽ tự thêm `project_dir` vào đường dẫn.

### Bước 3: Push code và kiểm tra

```bash
git add .
git commit -m "Deploy lần đầu"
git push origin main
```

Sau khi push:
1. Vào tab **Actions** trên GitHub để xem tiến trình
2. Workflow sẽ tự động build và deploy

### Chế độ Deploy

| Chế độ        | Khi nào                                        | Hành vi                                                                     |
| ------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| **Lần đầu**   | Thư mục `project_dir` chưa tồn tại trên server | Tạo thư mục, upload toàn bộ, setup `.htaccess`, `.htpasswd`, `.repo_lock`   |
| **Cập nhật**   | Đã deploy trước đó                              | Chỉ upload file **thay đổi** và xóa file **đã xóa** (dựa trên `git diff`)   |

### Hệ thống bảo mật (3 lớp)

| Lớp | Tên                   | Mô tả                                                                 |
| --- | ---------------------- | ---------------------------------------------------------------------- |
| 🛡️ 1 | Chống Path Traversal  | Chặn `project_dir` chứa `../` để tránh ghi file ra ngoài thư mục cho phép |
| 🛡️ 2 | Khóa chủ quyền       | File `.repo_lock` ghi tên repo — ngăn repo khác ghi đè nhầm dự án         |
| 🛡️ 3 | Bảo vệ file hệ thống | Không cho xóa/ghi đè `.htaccess`, `.htpasswd`, `.repo_lock` qua deploy    |

---

## 🔧 Xử lý sự cố

### Lỗi "require is not defined in ES module scope"

**Nguyên nhân**: `package.json` có `"type": "module"`, file deploy dùng CommonJS.

**Cách sửa**: Đảm bảo file deploy có đuôi `.cjs` (đã sửa: `deploy.cjs`).

### Lỗi "Không tìm thấy Secret cho server"

**Nguyên nhân**: GitHub Secret chưa được tạo hoặc visibility sai.

**Cách sửa**:
- Kiểm tra Secret tên `<SERVER>_CONFIG` đã tồn tại
- Nếu dùng Organization Secret: visibility phải là **"All repositories"** hoặc **"Selected repositories"** (bao gồm repo hiện tại)
- Nếu repo private trên Free plan: dùng **Repository Secret** thay vì Organization Secret

### Lỗi "550 No such file or directory"

**Nguyên nhân**: Bug `ensureDir()` thay đổi CWD, gây lồng đường dẫn.

**Cách sửa**: Đã fix — thêm `client.cd(ftpRoot)` sau mỗi `ensureDir()`.

### Deploy lại từ đầu

Nếu muốn reset và deploy lại hoàn toàn:
1. Xóa thư mục `project_dir` trên FTP server
2. Push một commit mới lên `main`
3. Script sẽ tự nhận là "deploy lần đầu" và setup lại toàn bộ

---

## 📄 Giấy phép

ISC License
