# Quy trình Git chuẩn cho Developer

Để hạn chế tối đa tình trạng "đụng" code (conflict), ghi đè file của người khác, hoặc gây lỗi hệ thống deploy tự động, các developer **bắt buộc** tuân thủ quy trình Git sau:

## 1. Nguyên tắc cốt lõi
1. **KHÔNG BAO GIỜ** code và push thẳng lên nhánh `main` (trừ khi làm việc độc lập 1 mình dự án nhỏ).
2. **LUÔN LUÔN** pull code mới nhất về trước khi bắt đầu code tính năng mới.
3. **LUÔN LUÔN** kiểm tra kỹ các file thay đổi (bằng lệnh `git status` hoặc công cụ của IDE) trước khi `git add` và `commit`.

## 2. Quy trình làm việc an toàn (Workflow chuẩn)

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

## 3. "Cứu hộ" nhanh khi gặp lỗi phổ biến

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
