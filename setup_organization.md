# 🔧 Hướng Dẫn Cài Đặt Cho Quản Lý Organization

Tài liệu này dành cho **người quản lý (Owner/Admin)** của GitHub Organization, hướng dẫn chi tiết cách thiết lập hệ thống CI/CD deploy tự động lên FTP server.

---

## 📋 Mục lục

**Phần 1: Cài đặt hệ thống (Dành cho Admin)**
1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Yêu cầu trước khi bắt đầu](#2-yêu-cầu-trước-khi-bắt-đầu)
3. [Bước 1: Chuẩn bị thư mục trên FTP Server](#3-bước-1-chuẩn-bị-thư-mục-trên-ftp-server)
4. [Bước 2: Tạo GitHub Secret cho FTP Server](#4-bước-2-tạo-github-secret-cho-ftp-server)
5. [Bước 3: Xác nhận deploy thành công](#5-bước-3-xác-nhận-deploy-thành-công)

**Phần 2: Quản lý & Vận hành (Dành cho Admin)**
👉 [Xem tài liệu: Quản lý và Bảo trì Hệ thống (`admin_management.md`)](./admin_management.md)
*(Bao gồm: Thêm server mới, Thêm dự án mới, Câu hỏi thường gặp...)*

**Phần 3: Quy trình Git (Dành cho Developer)**
👉 [Xem tài liệu: Quy trình Git chuẩn cho Developer (`developer_git_workflow.md`)](./developer_git_workflow.md)
*(Hướng dẫn thao tác Git an toàn chống conflict cho dev)*

---

## 1. Tổng quan hệ thống

```
Developer push code lên main
            │
            ▼
   GitHub Actions tự động chạy
            │
            ├── Build dự án (nếu cần)
            ├── Đọc deploy-config.json trong repo
            ├── Lấy FTP secret từ GitHub Secrets  ← 🔑 ADMIN SETUP
            ├── Kết nối FTP server
            └── Upload file lên server
            │
            ▼
   Trang web được cập nhật tự động
```

**Vai trò của Admin:**
- Tạo và quản lý thư mục deploy trên FTP server
- Tạo GitHub Secret chứa thông tin đăng nhập FTP
- Không cần can thiệp vào code của developer

---

## 2. Yêu cầu trước khi bắt đầu

### Thông tin cần chuẩn bị

| STT | Thông tin               | Ví dụ                                              | Lấy từ đâu                |
| --- | ----------------------- | --------------------------------------------------- | -------------------------- |
| 1   | Địa chỉ FTP server     | `ftp.example.com`                                      | Nhà cung cấp hosting       |
| 2   | Tên đăng nhập FTP      | `your-username`                                         | Nhà cung cấp hosting       |
| 3   | Mật khẩu FTP           | `ftp_password_123`                                  | Nhà cung cấp hosting       |
| 4   | Đường dẫn FTP (tương đối) | `./public_html/client/github_deploy`              | Xem bên dưới               |
| 5   | Đường dẫn server (tuyệt đối) | `/home/your-username/public_html/client/github_deploy` | Xem bên dưới          |
| 6   | Quyền Owner/Admin trên GitHub Organization | —                              | GitHub Organization Settings |

### Tài khoản GitHub cần đủ quyền

- Bạn phải là **Owner** hoặc **Admin** của Organization trên GitHub
- Kiểm tra tại: `https://github.com/orgs/<tên-org>/people` → cột Role phải là **Owner**

---

## 3. Bước 1: Chuẩn bị thư mục trên FTP Server

### 3.1. Đăng nhập FTP server

Dùng **FileZilla** hoặc bất kỳ FTP client nào:

| Trường     | Giá trị                |
| ---------- | ---------------------- |
| Host       | `ftp.example.com`         |
| Username   | `your-username`            |
| Password   | `(mật khẩu FTP)`      |
| Port       | `21` (mặc định)       |

### 3.2. Tạo thư mục chứa dự án

Tạo một thư mục riêng để chứa **tất cả** dự án deploy từ GitHub. Ví dụ:

```
public_html/
└── client/
    └── github_deploy/     ← 📁 TẠO THƯ MỤC NÀY
```

> ⚠️ **QUAN TRỌNG**: Thư mục `github_deploy` là thư mục **cha**. Mỗi dự án sẽ tự tạo thư mục **con** bên trong (ví dụ: `github_deploy/template_jline_html/`). Bạn **KHÔNG** cần tạo thư mục con cho từng dự án.

### 3.3. Xác định 2 đường dẫn

Sau khi tạo thư mục, bạn cần xác định **2 đường dẫn** để điền vào Secret:

| Tên          | Cách xác định                                                                 | Ví dụ                                                   |
| ------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| **ftp_dir**  | Đường dẫn **tương đối** từ thư mục FTP root. Thường bắt đầu bằng `./`        | `./public_html/client/github_deploy`                     |
| **root_path**| Đường dẫn **tuyệt đối** trên server. Dùng cho cấu hình Apache `.htpasswd`    | `/home/your-username/public_html/client/github_deploy`       |

**Cách tìm đường dẫn tuyệt đối (`root_path`):**

1. Đăng nhập **cPanel** hoặc **SSH** vào server
2. Vào **File Manager** → Navigate đến thư mục `github_deploy`
3. Đường dẫn hiển thị trên thanh địa chỉ chính là `root_path`
4. Hoặc dùng SSH: `cd public_html/client/github_deploy && pwd`

> 💡 **Mẹo**: Nếu hosting dùng cPanel, đường dẫn thường có dạng: `/home/<tên_user>/public_html/...`

---

## 4. Bước 2: Tạo GitHub Secret cho FTP Server

### Hiểu cách đặt tên Secret

Hệ thống sử dụng quy tắc đặt tên: **`<TÊN_SERVER>_CONFIG`**

Developer sẽ khai báo tên server trong file `deploy-config.json` của họ:

```json
{
  "server": "SERVER_A"
}
hoặc
{
  "server": "JLWEB"
}
```

→ Hệ thống sẽ tìm Secret có tên: **`SERVER_A_CONFIG`**

### Chọn loại Secret phù hợp

| Loại Secret          | Ưu điểm                          | Nhược điểm                                         | Khi nào dùng                        |
| -------------------- | --------------------------------- | --------------------------------------------------- | ----------------------------------- |
| **Organization Secret** | Tạo 1 lần, dùng cho nhiều repo | Free plan: chỉ repo **public** mới truy cập được    | Org có **paid plan** hoặc chỉ dùng repo public |
| **Repository Secret**   | Luôn hoạt động ở mọi plan      | Phải tạo riêng cho **từng repo**                     | Free plan với repo **private**      |

> ⚠️ **LƯU Ý QUAN TRỌNG**: GitHub **Free plan** KHÔNG cho phép repo private truy cập Organization Secrets. Nếu org đang dùng Free plan và repo là private, **BẮT bắt buộc phải dùng **Repository Secret**.

---

### Cách A: Tạo Organization Secret (cho paid plan hoặc repo public)

**Bước 1**: Vào trang Organization Settings

```
https://github.com/organizations/<tên-org>/settings/secrets/actions
```

Ví dụ: `https://github.com/organizations/your-org-name/settings/secrets/actions`

**Bước 2**: Nhấn nút **"New organization secret"**

**Bước 3**: Điền thông tin

| Trường                | Giá trị                |
| --------------------- | ---------------------- |
| **Name**              | `SERVER_A_CONFIG`      |
| **Value**             | (JSON bên dưới)        |
| **Repository access** | Chọn phù hợp (xem bảng dưới) |

**Bước 4**: Nhập giá trị JSON vào ô **Value**:

```json
{
  "host": "ftp.example.com",
  "user": "your-username",
  "pass": "mat_khau_ftp_cua_ban",
  "ftp_dir": "./public_html/client/github_deploy",
  "root_path": "/home/your-username/public_html/client/github_deploy"
}
```

**Bước 5**: Chọn **Repository access**

| Tùy chọn                  | Mô tả                                                   | Khuyến nghị        |
| -------------------------- | -------------------------------------------------------- | ------------------ |
| **All repositories**       | Tất cả repo trong org đều dùng được secret này            | ✅ Đơn giản nhất   |
| **Selected repositories**  | Chỉ các repo được chọn mới dùng được                      | 🔒 An toàn hơn     |
| **Public repositories**    | Chỉ repo public mới dùng được (Free plan chỉ có option này) | ⚠️ Hạn chế        |

**Bước 6**: Nhấn **"Add secret"**

---

### Cách B: Tạo Repository Secret (cho free plan với repo private)

Cần lặp lại cho **từng repo** cần deploy.

**Bước 1**: Vào trang Settings của repo

```
https://github.com/<tên-org>/<tên-repo>/settings/secrets/actions
```

Ví dụ: `https://github.com/your-org-name/template_jline_html/settings/secrets/actions`

**Bước 2**: Nhấn **"New repository secret"**

**Bước 3**: Điền thông tin

| Trường   | Giá trị           |
| -------- | ------------------ |
| **Name** | `SERVER_A_CONFIG`  |
| **Value**| (JSON giống Cách A) |

**Bước 4**: Nhấn **"Add secret"**

---

### Giải thích các trường trong JSON Secret

```json
{
  "host": "ftp.example.com",
  "user": "your-username",
  "pass": "mat_khau_ftp_cua_ban",
  "ftp_dir": "./public_html/client/github_deploy",
  "root_path": "/home/your-username/public_html/client/github_deploy"
}
```

| Trường      | Kiểu       | Mô tả                                                                                          |
| ----------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `host`      | `string`   | Địa chỉ IP hoặc domain của FTP server                                                           |
| `user`      | `string`   | Tên đăng nhập FTP (giống khi đăng nhập FileZilla)                                                |
| `pass`      | `string`   | Mật khẩu FTP                                                                                     |
| `ftp_dir`   | `string`   | Đường dẫn **tương đối** đến thư mục cha chứa các dự án. Script sẽ tự thêm `project_dir` vào sau  |
| `root_path` | `string`   | Đường dẫn **tuyệt đối** trên server. Dùng để cấu hình `AuthUserFile` trong `.htaccess` (Apache)  |

> ⚠️ **CHÚ Ý**: `ftp_dir` và `root_path` đều trỏ đến **thư mục cha** (`github_deploy/`), KHÔNG bao gồm tên dự án. Script deploy sẽ tự động thêm tên dự án (`project_dir`) vào cuối.

**Ví dụ minh họa:**

```
Cấu hình:
  ftp_dir   = ./public_html/client/github_deploy
  root_path = /home/your-username/public_html/client/github_deploy

Developer khai báo:
  project_dir = template_jline_html

→ Script sẽ upload vào: ./public_html/client/github_deploy/template_jline_html/
→ .htaccess sẽ dùng:    /home/your-username/public_html/client/github_deploy/template_jline_html/.htpasswd
```

---

## 5. Bước 3: Xác nhận deploy thành công

Sau khi developer push code lên nhánh `main`, kiểm tra deploy:

### 5.1. Xem log trên GitHub Actions

1. Vào repo → tab **Actions**
2. Nhấn vào workflow run mới nhất
3. Nhấn vào job **"build-and-deploy"**
4. Xem step **"🚀 Chạy Script Deploy"**

### 5.2. Kết quả thành công (mẫu)

```
╔══════════════════════════════════════════════╗
║   🚀 HỆ THỐNG DEPLOY AN TOÀN — KHỞI ĐỘNG   ║
╚══════════════════════════════════════════════╝

📋 Cấu hình:
   • Server: ftp.example.com
   • Thư mục FTP: ./public_html/client/github_deploy/template_jline_html
   • Source: public/

🔗 Đang kết nối FTP (lần 1/3)...
✅ Kết nối FTP thành công: ftp.example.com
ℹ️ Phát hiện deploy lần đầu — sẽ setup đầy đủ.

━━━ DEPLOY LẦN ĐẦU: Tạo cấu trúc & bảo mật ━━━
🔒 Tạo .repo_lock...
🔐 Tạo .htpasswd...
🔐 Tạo .htaccess...
📤 Upload toàn bộ thư mục public/...
   ⬆️ index.html
   ⬆️ assets/css/common.css
   ⬆️ assets/js/common.js
   ...
   📊 Tổng cộng: 25 file đã upload.

✅ Hoàn thành Deploy lần đầu!
🔌 Đã ngắt kết nối FTP.
```

### 5.3. Kiểm tra trên FTP server

Sau deploy lần đầu, thư mục trên server sẽ có cấu trúc:

```
github_deploy/
└── template_jline_html/
    ├── .repo_lock          ← File khóa chủ quyền (tự động tạo)
    ├── .htaccess           ← Bảo vệ Basic Auth (tự động tạo)
    ├── .htpasswd           ← Mật khẩu mã hóa (tự động tạo)
    ├── index.html
    ├── about/
    │   └── index.html
    └── assets/
        ├── css/
        ├── js/
        ├── images/
        └── vendor/
```

### 5.4. Truy cập trang web

Trang web sẽ có Basic Auth (phải nhập username/password):

```
URL: https://<domain>/client/github_deploy/template_jline_html/
Username: (do developer khai báo trong deploy-config.json)
Password: (do developer khai báo trong deploy-config.json)
```
