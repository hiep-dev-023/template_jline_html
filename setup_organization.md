# 🔧 Hướng Dẫn Cài Đặt Cho Quản Lý Organization

Tài liệu này dành cho **người quản lý (Owner/Admin)** của GitHub Organization, hướng dẫn chi tiết cách thiết lập hệ thống CI/CD deploy tự động lên FTP server.

---

## 📋 Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Yêu cầu trước khi bắt đầu](#2-yêu-cầu-trước-khi-bắt-đầu)
3. [Bước 1: Chuẩn bị thư mục trên FTP Server](#3-bước-1-chuẩn-bị-thư-mục-trên-ftp-server)
4. [Bước 2: Tạo GitHub Secret cho FTP Server](#4-bước-2-tạo-github-secret-cho-ftp-server)
5. [Bước 3: Xác nhận deploy thành công](#5-bước-3-xác-nhận-deploy-thành-công)
6. [Thêm server mới](#6-thêm-server-mới)
7. [Thêm dự án mới (repo mới)](#7-thêm-dự-án-mới-repo-mới)
8. [Quản lý và bảo trì](#8-quản-lý-và-bảo-trì)
9. [Câu hỏi thường gặp](#9-câu-hỏi-thường-gặp)
10. [Quy trình Git chuẩn cho Developer](#10-quy-trình-git-chuẩn-cho-developer)

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

> ⚠️ **LƯU Ý QUAN TRỌNG**: GitHub **Free plan** KHÔNG cho phép repo private truy cập Organization Secrets. Nếu org đang dùng Free plan và repo là private, **BẮT BUỘC** phải dùng **Repository Secret**.

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

---

## 6. Thêm server mới

Nếu có thêm server FTP mới (ví dụ: `SERVER_B`), chỉ cần tạo thêm Secret:

| Secret Name        | Giá trị                                      |
| ------------------ | --------------------------------------------- |
| `SERVER_B_CONFIG`  | JSON chứa thông tin FTP của server B           |

Developer sẽ thay đổi `"server": "SERVER_B"` trong `deploy-config.json` để deploy sang server mới.

**Ví dụ:**

```json
{
  "host": "203.100.50.10",
  "user": "user_server_b",
  "pass": "password_server_b",
  "ftp_dir": "./public_html/projects",
  "root_path": "/home/user_b/public_html/projects"
}
```

> 💡 **Quy tắc đặt tên**: Tên Secret luôn là `<TÊN_SERVER>_CONFIG` (viết HOA). Ví dụ: `SERVER_B` → `SERVER_B_CONFIG`, `STAGING` → `STAGING_CONFIG`.

---

## 7. Thêm dự án mới (repo mới)

Khi developer tạo repo mới cần deploy, bạn cần:

### Nếu dùng Organization Secret (paid plan)

✅ **Không cần làm gì thêm** — Secret đã có sẵn cho tất cả repo (hoặc repo đã được chọn).

Nếu Repository access là **"Selected repositories"**:
1. Vào Organization Settings → Secrets → Actions
2. Nhấn **Edit** bên cạnh Secret (ví dụ: `SERVER_A_CONFIG`)
3. Thêm repo mới vào danh sách **Selected repositories**
4. Nhấn **Update secret**

### Nếu dùng Repository Secret (free plan)

Cần tạo Secret cho repo mới:

1. Vào `https://github.com/<org>/<repo-mới>/settings/secrets/actions`
2. Nhấn **"New repository secret"**
3. Name: `SERVER_A_CONFIG`
4. Value: paste giá trị JSON (giống các repo khác nếu cùng server)
5. Nhấn **"Add secret"**

---

## 8. Quản lý và bảo trì

### 8.1. Đổi mật khẩu FTP

Khi cần đổi mật khẩu FTP server:

1. Đổi mật khẩu trên hosting/cPanel
2. Cập nhật GitHub Secret:
   - Vào Organization/Repository Settings → Secrets
   - Nhấn **Edit** bên cạnh Secret
   - Sửa trường `"pass"` trong JSON
   - Nhấn **Update secret**
3. Chạy lại workflow hoặc push commit mới để kiểm tra

### 8.2. Xóa dự án khỏi server

1. Dùng FTP client (FileZilla) xóa thư mục dự án trên server
   - Ví dụ: xóa `github_deploy/template_jline_html/`
2. (Tùy chọn) Xóa hoặc disable workflow trong repo GitHub

### 8.3. Reset deploy (deploy lại từ đầu)

Nếu dự án bị lỗi trên server và muốn deploy lại hoàn toàn:

1. Dùng FTP client xóa **toàn bộ** thư mục dự án (ví dụ: `template_jline_html/`)
2. Vào GitHub → tab Actions → nhấn **"Run workflow"** (workflow_dispatch)
3. Hoặc push một commit mới lên `main`
4. Script sẽ tự nhận là deploy lần đầu và setup lại toàn bộ

### 8.4. Xem danh sách Secret hiện có

- **Organization Secrets**: `https://github.com/organizations/<org>/settings/secrets/actions`
- **Repository Secrets**: `https://github.com/<org>/<repo>/settings/secrets/actions`

> ⚠️ **Lưu ý**: GitHub **không hiển thị** giá trị Secret sau khi tạo. Nếu quên, bạn phải tạo lại (Update Secret).

---

## 9. Câu hỏi thường gặp

### Q: Deploy thất bại, báo "Không tìm thấy Secret cho server"?

**A**: Secret chưa được tạo hoặc tên sai.
- Kiểm tra tên Secret phải khớp: `<TÊN_SERVER>_CONFIG` (viết HOA)
- Nếu dùng Organization Secret: kiểm tra Repository access
- Nếu repo private + Free plan: phải dùng Repository Secret

### Q: Deploy thất bại, báo lỗi kết nối FTP?

**A**: Kiểm tra thông tin FTP trong Secret:
- `host` có đúng không?
- `user` và `pass` có đúng không?
- Server có chặn IP không? (GitHub Actions dùng IP động)

### Q: Hai repo có thể deploy vào cùng thư mục không?

**A**: **KHÔNG**. Hệ thống có lớp bảo mật `.repo_lock` ngăn việc này. Mỗi thư mục trên server chỉ thuộc về **một repo duy nhất**. Nếu repo khác cố deploy vào, sẽ bị chặn với thông báo:
```
❌ CẢNH BÁO BẢO MẬT: Thư mục [...] đang thuộc về dự án [...]. HỦY DEPLOY ĐỂ TRÁNH GHI ĐÈ!
```

### Q: Developer có thể xem được mật khẩu FTP không?

**A**: **KHÔNG**. GitHub Secrets được mã hóa và không hiển thị trong log. Developer chỉ cần khai báo tên server trong `deploy-config.json`, không cần biết thông tin FTP.

### Q: Tôi có thể dùng FTPS (FTP over TLS) không?

**A**: Hiện tại script kết nối FTP không mã hóa (`secure: false`). Nếu server hỗ trợ FTPS, cần sửa file `.github/scripts/deploy.cjs` để bật `secure: true`.

### Q: Có cách nào kiểm tra Secret đã đúng chưa mà không cần push code?

**A**: Có. Vào repo → tab **Actions** → chọn workflow → nhấn nút **"Run workflow"** để chạy thủ công mà không cần push commit.

---

## 10. Quy trình Git chuẩn cho Developer

Để hạn chế tối đa tình trạng "đụng" code (conflict), ghi đè file của người khác, hoặc gây lỗi hệ thống deploy tự động, các developer **bắt buộc** tuân thủ quy trình Git sau:

### 10.1. Nguyên tắc cốt lõi
1. **KHÔNG BAO GIỜ** code và push thẳng lên nhánh `main` (trừ khi làm việc độc lập 1 mình dự án nhỏ).
2. **LUÔN LUÔN** pull code mới nhất về trước khi bắt đầu code tính năng mới.
3. **LUÔN LUÔN** kiểm tra kỹ các file thay đổi (bằng lệnh `git status` hoặc công cụ của IDE) trước khi `git add` và `commit`.

### 10.2. Quy trình làm việc an toàn (Workflow chuẩn)

**✅ Bước 1: Cập nhật code mới nhất từ team**
Trước khi code bất cứ tính năng nào, phải đảm bảo code trên máy mình là mới nhất.
```bash
git checkout main
git pull origin main
```

**✅ Bước 2: Tạo nhánh riêng cho công việc**
Tạo một nhánh mới từ `main` để làm việc. Đặt tên nhánh rõ ràng theo chức năng hoặc tên người làm.
- Ví dụ: `feature/login`, `fix/header-css`, `dev-hiep-homepage`
```bash
git checkout -b feature/ten-chuc-nang
```

**✅ Bước 3: Code và Commit cẩn thận**
Làm việc trên nhánh vừa tạo. **Chỉ `git add` những file mình thực sự sửa chữa**.
```bash
git status
git add file-da-sua.html assets/css/style.css
git commit -m "feat: cập nhật giao diện header"
```
> 💡 *Mẹo:* Hạn chế dùng `git add .` nếu bạn không chắc chắn 100% mình đã sửa những file nào, để tránh đưa file rác hoặc file cấu hình cá nhân lên server.

**✅ Bước 4: Cập nhật lại nhánh `main` (Xử lý conflict cục bộ)**
Trong lúc bạn đang code ở nhánh của mình, có thể người khác đã push code lên `main`. Để tránh conflict lúc merge:
```bash
git checkout main
git pull origin main
git checkout feature/ten-chuc-nang
git merge main
```
*(Lúc này, nếu có conflict, bạn sẽ tự xử lý an toàn ngay trên máy của mình. Ổn thỏa mới đi tiếp).*

**✅ Bước 5: Push nhánh lên GitHub và tạo Pull Request (PR)**
Sau khi kiểm tra kỹ lưỡng, push nhánh của bạn lên GitHub:
```bash
git push origin feature/ten-chuc-nang
```
- Lên web GitHub, tạo **Pull Request** từ nhánh của bạn vào nhánh `main`.
- Nếu có thể, nhờ đồng đội review code.
- Merge PR vào `main`. Lúc này GitHub Actions mới tự động kích hoạt deploy lên server một cách an toàn nhất!
- Xóa nhánh sau khi merge xong để repo gọn gàng.

### 10.3. "Cứu hộ" nhanh khi gặp lỗi phổ biến

**Trường hợp 1: Lỡ viết code trực tiếp trên `main` mà chưa commit, lúc `git pull` bị lỗi báo đè file:**
```bash
# 1. Cất code đang làm dở đi vào kho tạm
git stash

# 2. Giờ nhánh đã sạch, lấy code mới trên server về
git pull origin main

# 3. Lấy code đang làm dở ở kho tạm ra lại
git stash pop
```
*(Nếu lúc pop ra báo conflict, bạn chỉ việc sửa file bị conflict, rồi lưu lại và commit)*

**Trường hợp 2: Lỡ commit nhầm vào `main` nhưng chưa push:**
```bash
# Lùi lại 1 commit nhưng giữ nguyên file đã sửa
git reset --soft HEAD~1

# Tạo nhánh mới và mang code theo
git checkout -b feature/nhanh-moi
git commit -m "messsage"
```
