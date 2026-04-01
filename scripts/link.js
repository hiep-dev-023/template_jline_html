import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, symlinkSync, unlinkSync, rmdirSync, readlinkSync, lstatSync } from 'fs';
import { platform } from 'os';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const SRC_DIR = resolve(ROOT, 'public');

let SERVER_TYPE = '';
let WEB_ROOT = '';

try {
  const envPath = resolve(ROOT, '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key === 'SERVER_TYPE') SERVER_TYPE = value;
        if (key === 'WEB_ROOT') WEB_ROOT = value;
      }
    });
  }
} catch (e) {
  console.error('❌ Lỗi không đọc được file .env', e);
}

console.log('\n╔════════════════════════════════════════╗');
console.log('║        Tạo Symlink / Junction          ║');
console.log('╚════════════════════════════════════════╝\n');

if (!WEB_ROOT) {
  console.error('❌ Lỗi: Chưa cấu hình WEB_ROOT trong file .env');
  console.log('Vui lòng thêm biến WEB_ROOT (ví dụ: WEB_ROOT=D:\\laragon\\www) vào file .env');
  process.exit(1);
}

if (!existsSync(WEB_ROOT)) {
  console.error(`❌ Lỗi: Thư mục WEB_ROOT '${WEB_ROOT}' không tồn tại trên máy tính.`);
  console.log('Hãy kiểm tra lại đường dẫn XAMPP, Laragon, MAMP hoặc Valet của bạn.');
  process.exit(1);
}

if (!existsSync(SRC_DIR)) {
  console.error(`❌ Lỗi: Thư mục chứa code '${SRC_DIR}' không tồn tại.`);
  console.log('Vui lòng chạy lệnh "npm run build" hoặc "npm run dev" để khởi tạo thư mục public trước.');
  process.exit(1);
}

const projectName = basename(ROOT);
const targetPath = resolve(WEB_ROOT, projectName);

console.log(`🔗 Đang tiến hành kết nối source thư mục '${projectName}'...`);
console.log(`👉 Source (Từ): ${SRC_DIR}`);
console.log(`👉 Target (Đến): ${targetPath}\n`);

// Remove existing target safely if it's a symlink or junction
if (existsSync(targetPath)) {
  let isLink = false;
  try {
    readlinkSync(targetPath);
    isLink = true;
  } catch(e) { /* ignores */ }
  
  if (isLink) {
    try {
      unlinkSync(targetPath); // For symlinks
    } catch {
      try { rmdirSync(targetPath); } catch {} // For junctions on Windows
    }
    console.log(`♻️  Đã gỡ symlink cũ thành công.`);
  } else {
    const stat = existsSync(targetPath) ? lstatSync(targetPath) : null;
    if (stat && (stat.isSymbolicLink() || stat.isDirectory())) {
      // Junction logic trick
       console.error(`❌ Lỗi: Thư mục '${targetPath}' đã tồn tại và là một thư mục thật (không phải symlink).`);
       console.error('Vui lòng xóa hoặc đổi tên nó bằng tay trên máy tính để tránh mất dữ liệu, sau đó chạy lại lệnh.');
       process.exit(1);
    }
  }
}

try {
  const osPlatform = platform();
  if (osPlatform === 'win32') {
    // try to create junction on Windows
    symlinkSync(SRC_DIR, targetPath, 'junction');
  } else {
    // create dir symlink on mac/linux
    symlinkSync(SRC_DIR, targetPath, 'dir');
  }
  console.log(`✅ Thành công! Bạn có thể truy cập dự án vào thư mục local server của mình.`);
} catch (error) {
  console.error('\n❌ Không thể tạo symlink tự động.');
  
  const osPlatform = platform();
  if (osPlatform === 'win32') {
    console.log('⚠️ Windows yêu cầu quyền Administrator để thực thi lệnh này.');
    console.log('🔄 Đang tự động hiển thị popup yêu cầu quyền qụản trị (UAC)...');
    try {
      const srcEscaped = SRC_DIR.replace(/'/g, "''");
      const targetEscaped = targetPath.replace(/'/g, "''");
      const psCommand = `Start-Process cmd -ArgumentList '/c mklink /J "${targetEscaped}" "${srcEscaped}" ^& echo [Thanh cong] Bam phim bat ky de hoan tat. ^& pause' -Verb RunAs`;
      execSync(`powershell -Command "${psCommand}"`);
      console.log('✅ Vui lòng kiểm tra màn hình đen CMD vừa bật lên. Nếu nó báo thành công thì Symlink đã sẵn sàng.');
    } catch (uacError) {
      console.error('❌ Lỗi: Người dùng từ chối cấp quyền Administrator hoặc lệnh chạy thất bại.');
      console.error('Hãy mở CMD/PowerShell bằng quyền Administrator (Run as Administrator) và chạy lại "npm run link".');
    }
  } else {
    console.log('\n⚠️ Mac / Linux yêu cầu quyền Sudo (Quản trị viên) để tạo Symlink ở thư mục hệ thống.');
    console.log('👉 Bạn hãy gõ lệnh dưới đây:');
    console.log('   sudo npm run link');
  }
  process.exit(1);
}
