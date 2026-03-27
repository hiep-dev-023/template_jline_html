# ⚙️ Quản Lý Và Bảo Trì Hệ Thống Deploy

Tài liệu này dành cho **Admin / Owner**, hướng dẫn cách vận hành, thêm dự án mới, xử lý sự cố hệ thống CI/CD sau khi đã cài đặt xong ban đầu.

---

## 📋 Mục lục

1. [Thêm server mới](#1-thêm-server-mới)
2. [Thêm dự án mới (repo mới)](#2-thêm-dự-án-mới-repo-mới)
3. [Quản lý và bảo trì](#3-quản-lý-và-bảo-trì)
4. [Câu hỏi thường gặp](#4-câu-hỏi-thường-gặp)

---

## 1. Thêm server mới

Nếu có thêm server FTP mới (ví dụ: `SERVER_B`), chỉ cần tạo thêm Secret:

| Secret Name        | Giá trị                                      |
| ------------------ | --------------------------------------------- |
| `SERVER_B_CONFIG`  | JSON chứa thông tin FTP của server B           |

Developer sẽ thay đổi `"server": "SERVER_B"` trong `deploy-config.json` để deploy sang server mới.

**Ví dụ:**

```json
{
  "host": "host_server_b",
  "user": "user_server_b",
  "pass": "password_server_b",
  "ftp_dir": "./public_html/projects",
  "root_path": "/home/user_b/public_html/projects"
}
```

> 💡 **Quy tắc đặt tên**: Tên Secret luôn là `<TÊN_SERVER>_CONFIG` (viết HOA). Ví dụ: `SERVER_B` → `SERVER_B_CONFIG`, `STAGING` → `STAGING_CONFIG`.

---

## 2. Thêm dự án mới (repo mới)

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

## 3. Quản lý và bảo trì

### 3.1. Đổi mật khẩu FTP

Khi cần đổi mật khẩu FTP server:

1. Đổi mật khẩu trên hosting/cPanel
2. Cập nhật GitHub Secret:
   - Vào Organization/Repository Settings → Secrets
   - Nhấn **Edit** bên cạnh Secret
   - Sửa trường `"pass"` trong JSON
   - Nhấn **Update secret**
3. Chạy lại workflow hoặc push commit mới để kiểm tra

### 3.2. Xóa dự án khỏi server

1. Dùng FTP client (FileZilla) xóa thư mục dự án trên server
   - Ví dụ: xóa `/template_jline_html/`
2. (Tùy chọn) Xóa hoặc disable workflow trong repo GitHub

### 3.3. Reset deploy (deploy lại từ đầu)

Nếu dự án bị lỗi trên server và muốn deploy lại hoàn toàn:

1. Dùng FTP client xóa **toàn bộ** thư mục dự án (ví dụ: `template_jline_html/`)
2. Vào GitHub → tab Actions → nhấn **"Run workflow"** (workflow_dispatch)
3. Hoặc push một commit mới lên `main`
4. Script sẽ tự nhận là deploy lần đầu và setup lại toàn bộ

### 3.4. Xem danh sách Secret hiện có

- **Organization Secrets**: `https://github.com/organizations/<org>/settings/secrets/actions`
- **Repository Secrets**: `https://github.com/<org>/<repo>/settings/secrets/actions`

> ⚠️ **Lưu ý**: GitHub **không hiển thị** giá trị Secret sau khi tạo. Nếu quên, bạn phải tạo lại (Update Secret).

---

## 4. Câu hỏi thường gặp

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
