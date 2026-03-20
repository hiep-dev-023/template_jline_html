const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const { execSync } = require('child_process');
const crypt = require('apache-crypt');

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

/**
 * Walk a local directory recursively, returning all file paths (relative to dir).
 */
function walkDir(dir, baseDir = dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(fullPath, baseDir));
        } else {
            results.push(path.relative(baseDir, fullPath).replace(/\\/g, '/'));
        }
    }
    return results;
}

/**
 * Validate deploy-config.json structure.
 * Returns an array of error messages (empty = valid).
 */
function validateConfig(config) {
    const errors = [];

    if (!config.server || typeof config.server !== 'string') {
        errors.push('Thiếu trường "server" (string)');
    }
    if (!config.project_dir || typeof config.project_dir !== 'string') {
        errors.push('Thiếu trường "project_dir" (string)');
    }
    if (!config.source_folder || typeof config.source_folder !== 'string') {
        errors.push('Thiếu trường "source_folder" (string)');
    }
    if (!config.basic_auth || !config.basic_auth.username || !config.basic_auth.password) {
        errors.push('Thiếu trường "basic_auth" với "username" và "password"');
    }

    return errors;
}

// ─────────────────────────────────────────────
// FTP Upload (recursive directory)
// ─────────────────────────────────────────────

/**
 * Upload toàn bộ nội dung của một thư mục local lên FTP (đệ quy).
 * Giải quyết lỗi: client.uploadFrom() chỉ upload 1 file, KHÔNG upload thư mục.
 */
async function uploadDirectory(client, localDir, remoteDir) {
    const files = walkDir(localDir);
    let uploadCount = 0;

    for (const relPath of files) {
        const localFilePath = path.join(localDir, relPath);
        const remoteFilePath = `${remoteDir}/${relPath}`;

        // Ensure remote directory exists
        const remoteFileDir = path.posix.dirname(remoteFilePath);
        await client.ensureDir(remoteFileDir);

        await client.uploadFrom(localFilePath, remoteFilePath);
        uploadCount++;
        console.log(`   ⬆️ ${relPath}`);
    }

    console.log(`   📊 Tổng cộng: ${uploadCount} file đã upload.`);
}

// ─────────────────────────────────────────────
// FTP Connection with Retry
// ─────────────────────────────────────────────

/**
 * Kết nối FTP với retry logic (tối đa 3 lần).
 */
async function connectWithRetry(client, serverInfo, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔗 Đang kết nối FTP (lần ${attempt}/${maxRetries})...`);
            await client.access({
                host: serverInfo.host,
                user: serverInfo.user,
                password: serverInfo.pass,
                secure: false,
            });
            console.log(`✅ Kết nối FTP thành công: ${serverInfo.host}`);
            return;
        } catch (err) {
            console.error(`⚠️ Lần ${attempt} thất bại: ${err.message}`);
            if (attempt === maxRetries) {
                throw new Error(`Không thể kết nối FTP sau ${maxRetries} lần thử: ${err.message}`);
            }
            // Chờ 3 giây trước khi thử lại
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }
}

// ─────────────────────────────────────────────
// Main Deploy Logic
// ─────────────────────────────────────────────

async function runDeploy() {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   🚀 HỆ THỐNG DEPLOY AN TOÀN — KHỞI ĐỘNG   ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');

    // ─── Đọc & validate config ───
    if (!fs.existsSync('deploy-config.json')) {
        console.error('❌ LỖI: Không tìm thấy file deploy-config.json!');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync('deploy-config.json', 'utf8'));

    // 🛡️ VALIDATION: Kiểm tra cấu trúc config
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
        console.error('❌ LỖI CẤU HÌNH deploy-config.json:');
        configErrors.forEach((e) => console.error(`   • ${e}`));
        process.exit(1);
    }

    // 🛡️ LỚP GIÁP 1: CHỐNG HACK ĐƯỜNG DẪN (PATH TRAVERSAL)
    // Ngăn chặn rủi ro Dev gõ "../../../" làm xóa nhầm hệ thống server
    const isValidDir = /^[a-zA-Z0-9_-]+$/.test(config.project_dir);
    if (!isValidDir) {
        console.error(`❌ LỖI NGHIÊM TRỌNG: Tên dự án "${config.project_dir}" KHÔNG HỢP LỆ!`);
        console.error(`   Chỉ cho phép dùng: Chữ cái, số, gạch ngang (-), gạch dưới (_).`);
        console.error(`   🛡️ Bảo vệ Server: Đã tự động ngắt.`);
        process.exit(1);
    }

    // ─── Kiểm tra source folder tồn tại ───
    if (!fs.existsSync(config.source_folder)) {
        console.error(`❌ LỖI: Thư mục source "${config.source_folder}" không tồn tại!`);
        console.error(`   Nếu dự án cần build, hãy kiểm tra has_build_step: true trong deploy-config.json.`);
        process.exit(1);
    }

    // ─── Kiểm tra Server Secret ───
    if (!process.env.SERVER_SECRET_JSON) {
        console.error(`❌ LỖI: Không tìm thấy Secret cho server [${config.server}].`);
        console.error(`   Hãy tạo GitHub Secret tên "${config.server}_CONFIG" chứa JSON cấu hình FTP.`);
        process.exit(1);
    }

    const serverInfo = JSON.parse(process.env.SERVER_SECRET_JSON);
    const targetDir = `${serverInfo.ftp_dir}/${config.project_dir}`;

    console.log(`📋 Cấu hình:`);
    console.log(`   • Server: ${serverInfo.host}`);
    console.log(`   • Thư mục FTP: ${targetDir}`);
    console.log(`   • Source: ${config.source_folder}/`);
    console.log('');

    // ─── Kết nối FTP ───
    const client = new ftp.Client();
    client.ftp.verbose = false; // Đặt true để debug chi tiết

    try {
        await connectWithRetry(client, serverInfo);

        // Lưu FTP root path (sửa lỗi: cd('/') có thể không đúng)
        const ftpRoot = await client.pwd();

        // 🛡️ LỚP GIÁP 2: KHÓA CHỦ QUYỀN (CHỐNG GHI ĐÈ NHẦM DỰ ÁN)
        let isFirstDeploy = false;
        try {
            await client.cd(targetDir);
            const lockFileLocal = '/tmp/.repo_lock';
            await client.downloadTo(lockFileLocal, '.repo_lock');
            const lockOwner = fs.readFileSync(lockFileLocal, 'utf8').trim();

            if (lockOwner !== process.env.GITHUB_REPO) {
                throw new Error(
                    `❌ CẢNH BÁO BẢO MẬT: Thư mục [${config.project_dir}] đang thuộc về dự án [${lockOwner}]. ` +
                    `Repo hiện tại: [${process.env.GITHUB_REPO}]. HỦY DEPLOY ĐỂ TRÁNH GHI ĐÈ!`
                );
            }
            console.log('✅ Khớp mã chủ quyền (.repo_lock) — an toàn.');
        } catch (err) {
            if (err.message.includes('CẢNH BÁO BẢO MẬT')) throw err;
            isFirstDeploy = true;
            console.log('ℹ️ Phát hiện deploy lần đầu — sẽ setup đầy đủ.');
        }

        // ════════════════════════════════════════
        // CHẾ ĐỘ 1: DEPLOY LẦN ĐẦU TIÊN
        // ════════════════════════════════════════
        if (isFirstDeploy) {
            console.log('');
            console.log('━━━ DEPLOY LẦN ĐẦU: Tạo cấu trúc & bảo mật ━━━');

            // Tạo thư mục đích
            await client.ensureDir(targetDir);

            // 1. Tạo file khóa chủ quyền
            console.log('🔒 Tạo .repo_lock...');
            fs.writeFileSync('/tmp/.repo_lock', process.env.GITHUB_REPO);
            await client.uploadFrom('/tmp/.repo_lock', `${targetDir}/.repo_lock`);

            // 2. Tạo .htpasswd (mật khẩu mã hóa)
            console.log('🔐 Tạo .htpasswd...');
            const hashedPass = crypt(config.basic_auth.password);
            fs.writeFileSync('/tmp/.htpasswd', `${config.basic_auth.username}:${hashedPass}`);
            await client.uploadFrom('/tmp/.htpasswd', `${targetDir}/.htpasswd`);

            // 3. Tạo .htaccess (bảo vệ truy cập)
            console.log('🔐 Tạo .htaccess...');
            const htaccessContent = [
                '<Files ~ "^\\.(htaccess|htpasswd)$">',
                'Deny from all',
                '</Files>',
                'AuthType Basic',
                'AuthName "Restricted Area"',
                `AuthUserFile ${serverInfo.root_path}/${config.project_dir}/.htpasswd`,
                'Require valid-user',
            ].join('\n');
            fs.writeFileSync('/tmp/.htaccess', htaccessContent);
            await client.uploadFrom('/tmp/.htaccess', `${targetDir}/.htaccess`);

            // 4. Upload toàn bộ source (đệ quy)
            console.log(`📤 Upload toàn bộ thư mục ${config.source_folder}/...`);
            await uploadDirectory(client, config.source_folder, targetDir);

            console.log('');
            console.log('✅ Hoàn thành Deploy lần đầu!');
        }

        // ════════════════════════════════════════
        // CHẾ ĐỘ 2: CẬP NHẬT (CHỈ ĐẨY FILE ĐỔI & XÓA FILE RÁC)
        // ════════════════════════════════════════
        else {
            console.log('');
            console.log('━━━ CẬP NHẬT: Chỉ đẩy file thay đổi ━━━');

            // Quay về FTP root trước khi thao tác tiếp
            await client.cd(ftpRoot);

            // Kiểm tra có đủ commit để diff không
            let diffOutput = '';
            try {
                const commitCount = execSync('git rev-list --count HEAD').toString().trim();
                if (parseInt(commitCount, 10) < 2) {
                    console.log('ℹ️ Chỉ có 1 commit — không có gì để so sánh.');
                    console.log('ℹ️ Chuyển sang upload toàn bộ source...');
                    await uploadDirectory(client, config.source_folder, targetDir);
                    console.log('✅ Hoàn thành!');
                    return;
                }
                diffOutput = execSync('git diff --name-status HEAD~1 HEAD').toString().trim();
            } catch (gitErr) {
                console.error(`⚠️ Git diff lỗi: ${gitErr.message}`);
                console.log('ℹ️ Fallback: Upload toàn bộ source...');
                await uploadDirectory(client, config.source_folder, targetDir);
                console.log('✅ Hoàn thành!');
                return;
            }

            if (!diffOutput) {
                console.log('ℹ️ Không có thay đổi nào trong commit mới nhất.');
                return;
            }

            // 🛡️ LỚP GIÁP 3: BẢO VỆ FILE HỆ THỐNG
            // Ngăn Dev vô tình xóa .htaccess, .htpasswd, .repo_lock dưới local
            const PROTECTED_FILES = ['.repo_lock', '.htaccess', '.htpasswd'];
            const lines = diffOutput.split('\n');
            let uploadCount = 0;
            let deleteCount = 0;
            let skipCount = 0;

            for (const line of lines) {
                // Xử lý cả Renamed files (R100 old_path new_path)
                const parts = line.split(/\t/);
                const status = parts[0].charAt(0); // Lấy ký tự đầu: A, M, D, R
                let filePath = '';

                if (status === 'R') {
                    // Renamed: xóa file cũ, upload file mới
                    const oldPath = parts[1];
                    const newPath = parts[2];

                    // Xóa file cũ nếu trong source_folder
                    if (oldPath.startsWith(`${config.source_folder}/`)) {
                        const oldRelative = oldPath.substring(config.source_folder.length + 1);
                        if (!PROTECTED_FILES.includes(oldRelative)) {
                            const oldFtpPath = `${targetDir}/${oldRelative}`;
                            try {
                                await client.remove(oldFtpPath);
                                console.log(`   🗑️ Đã xóa (renamed): ${oldRelative}`);
                                deleteCount++;
                            } catch (e) { /* file có thể không tồn tại */ }
                        }
                    }

                    filePath = newPath;
                } else {
                    filePath = parts[1];
                }

                if (!filePath) continue;

                // Chỉ xử lý file nằm trong source_folder
                if (!filePath.startsWith(`${config.source_folder}/`)) {
                    continue;
                }

                const relativePath = filePath.substring(config.source_folder.length + 1);

                // Bảo vệ file hệ thống
                if (PROTECTED_FILES.includes(relativePath)) {
                    console.log(`   🛡️ BẢO VỆ: Bỏ qua file hệ thống [${relativePath}]`);
                    skipCount++;
                    continue;
                }

                const ftpFilePath = `${targetDir}/${relativePath}`;

                if (status === 'D') {
                    // File bị xóa
                    try {
                        await client.remove(ftpFilePath);
                        console.log(`   🗑️ Đã xóa: ${relativePath}`);
                        deleteCount++;
                    } catch (e) {
                        // Bỏ qua nếu file không tồn tại trên server
                    }
                } else if (status === 'A' || status === 'M' || status === 'R') {
                    // File được thêm, sửa, hoặc renamed (file mới)
                    const remoteFileDir = path.posix.dirname(ftpFilePath);
                    await client.ensureDir(remoteFileDir);
                    await client.uploadFrom(filePath, ftpFilePath);
                    console.log(`   ⬆️ Đã cập nhật: ${relativePath}`);
                    uploadCount++;
                }
            }

            console.log('');
            console.log(`📊 Kết quả: ${uploadCount} upload, ${deleteCount} xóa, ${skipCount} bảo vệ.`);
            console.log('✅ Hoàn thành Cập nhật!');
        }
    } catch (error) {
        console.error('');
        console.error('╔══════════════════════════════════════╗');
        console.error('║         ❌ LỖI HỆ THỐNG             ║');
        console.error('╚══════════════════════════════════════╝');
        console.error(error.message);
        process.exit(1);
    } finally {
        client.close();
        console.log('');
        console.log('🔌 Đã ngắt kết nối FTP.');
    }
}

runDeploy();
