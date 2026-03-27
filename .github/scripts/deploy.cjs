const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const { execSync } = require('child_process');
const crypt = require('apache-crypt');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

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
async function uploadDirectory(client, localDir, remoteDir, ftpRoot) {
    const files = walkDir(localDir);
    let uploadCount = 0;

    for (const relPath of files) {
        const localFilePath = path.join(localDir, relPath);
        const remoteFilePath = `${remoteDir}/${relPath}`;

        // Ensure remote directory exists
        const remoteFileDir = path.posix.dirname(remoteFilePath);
        await client.ensureDir(remoteFileDir);
        await client.cd(ftpRoot); // Reset CWD sau ensureDir

        await client.uploadFrom(localFilePath, remoteFilePath);
        uploadCount++;
        console.log(`   ⬆️ ${relPath}`);
    }

    console.log(`   📊 Tổng cộng: ${uploadCount} file đã upload.`);
}

// ─────────────────────────────────────────────
// ZIP Upload + PHP Extraction (Fast bulk deploy)
// ─────────────────────────────────────────────

/**
 * Tạo ZIP từ thư mục local, upload lên FTP, dùng PHP giải nén trên server.
 * Nhanh hơn ×10-50 lần so với upload từng file qua FTP.
 * Tự động fallback về uploadDirectory nếu thất bại.
 */
async function uploadViaZip(client, localDir, remoteDir, ftpRoot, config, serverInfo) {
    const zipPath = '/tmp/_deploy_bundle.zip';
    const token = crypto.randomBytes(16).toString('hex');
    const phpFilename = `_extract_${token.substring(0, 8)}.php`;
    const phpRemotePath = `${remoteDir}/${phpFilename}`;

    try {
        // 1. Tạo ZIP file
        console.log('📦 Đang nén source thành ZIP...');
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
        execSync(`cd "${localDir}" && zip -r "${zipPath}" . -x '.*'`, { stdio: 'pipe' });
        const zipSize = fs.statSync(zipPath).size;
        console.log(`   📦 ZIP size: ${(zipSize / 1024 / 1024).toFixed(2)} MB`);

        // 2. Upload ZIP
        console.log('⬆️ Đang upload ZIP lên server...');
        await client.uploadFrom(zipPath, `${remoteDir}/_deploy_bundle.zip`);
        console.log('   ✅ Upload ZIP hoàn tất.');

        // 3. Tạo và upload PHP extractor (tự xóa sau khi chạy)
        const phpContent = `<?php
// Auto-generated deploy extractor — self-destructs after use
header('Content-Type: application/json');

if (!isset($_GET['token']) || $_GET['token'] !== '${token}') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Invalid token']);
    exit;
}

$zip = new ZipArchive;
$zipFile = __DIR__ . '/_deploy_bundle.zip';

if (!file_exists($zipFile)) {
    echo json_encode(['ok' => false, 'error' => 'ZIP not found']);
    exit;
}

if ($zip->open($zipFile) === TRUE) {
    $zip->extractTo(__DIR__);
    $count = $zip->numFiles;
    $zip->close();
    unlink($zipFile);
    unlink(__FILE__);
    echo json_encode(['ok' => true, 'files' => $count]);
} else {
    echo json_encode(['ok' => false, 'error' => 'Extract failed']);
}
?>`;
        fs.writeFileSync('/tmp/_extractor.php', phpContent);
        await client.uploadFrom('/tmp/_extractor.php', phpRemotePath);
        console.log('   ✅ PHP extractor đã upload.');

        // 4. Gọi PHP qua HTTP để giải nén
        // Tự derive URL từ config có sẵn (không cần thêm site_url)
        // host: "ftp.example.com" → domain: "example.com"
        // root_path: "/home/user/public_html/client/deploy" → web path: "/client/deploy"
        const domain = serverInfo.host.replace(/^ftp\./i, '');
        const webPath = serverInfo.root_path.replace(/^.*?\/public_html\/?/, '/');
        const siteUrl = `https://${domain}${webPath}`;
        const extractUrl = `${siteUrl}/${config.project_dir}/${phpFilename}?token=${token}`;
        console.log(`🔗 Gọi PHP extractor: ${domain}${webPath}/${config.project_dir}/${phpFilename}`);

        const result = await httpGet(extractUrl, config.basic_auth);
        const parsed = JSON.parse(result);

        if (parsed.ok) {
            console.log(`   ✅ Giải nén thành công: ${parsed.files} files.`);
        } else {
            throw new Error(`PHP extraction lỗi: ${parsed.error}`);
        }

    } catch (err) {
        console.warn(`⚠️ ZIP deploy thất bại: ${err.message}`);
        console.log('ℹ️ Fallback: Upload từng file...');

        // Cleanup ZIP + PHP trên server
        try { await client.remove(`${remoteDir}/_deploy_bundle.zip`); } catch { /* ignore */ }
        try { await client.remove(phpRemotePath); } catch { /* ignore */ }

        // Fallback
        await uploadDirectory(client, localDir, remoteDir, ftpRoot);
    } finally {
        // Cleanup local
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
        try { fs.unlinkSync('/tmp/_extractor.php'); } catch { /* ignore */ }
    }
}

/**
 * HTTP GET request với Basic Auth + follow redirects.
 */
function httpGet(url, basicAuth, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            return reject(new Error('Too many redirects'));
        }

        const urlObj = new URL(url);
        const mod = urlObj.protocol === 'https:' ? https : http;
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {},
            // Chấp nhận self-signed cert (staging server)
            rejectUnauthorized: false,
        };

        if (basicAuth) {
            const creds = Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
            options.headers['Authorization'] = `Basic ${creds}`;
        }

        const req = mod.request(options, (res) => {
            // Follow redirects (301, 302, 307, 308)
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, url).toString();
                console.log(`   ↪️ Redirect → ${redirectUrl}`);
                return httpGet(redirectUrl, basicAuth, maxRedirects - 1).then(resolve, reject);
            }

            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('HTTP request timeout (60s)'));
        });
        req.end();
    });
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
                secure: true,
                secureOptions: { rejectUnauthorized: false },
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

    // 🛡️ Validate source_folder không chứa path traversal
    if (/\.\.\/|\.\.\\/.test(config.source_folder)) {
        console.error(`❌ LỖI: source_folder "${config.source_folder}" chứa path traversal!`);
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
            await client.cd(ftpRoot); // Reset CWD sau ensureDir

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
                '<Files ~ "^\\.">',
                'Deny from all',
                '</Files>',
                'AuthType Basic',
                'AuthName "Restricted Area"',
                `AuthUserFile ${serverInfo.root_path}/${config.project_dir}/.htpasswd`,
                'Require valid-user',
            ].join('\n');
            fs.writeFileSync('/tmp/.htaccess', htaccessContent);
            await client.uploadFrom('/tmp/.htaccess', `${targetDir}/.htaccess`);

            // 4. Upload toàn bộ source (ZIP nhanh hoặc file-by-file fallback)
            console.log(`📤 Upload toàn bộ thư mục ${config.source_folder}/...`);
            await uploadViaZip(client, config.source_folder, targetDir, ftpRoot, config, serverInfo);

            // 5. Lưu SHA commit đã deploy
            const currentSha = execSync('git rev-parse HEAD').toString().trim();
            fs.writeFileSync('/tmp/.deploy_sha', currentSha);
            await client.uploadFrom('/tmp/.deploy_sha', `${targetDir}/.deploy_sha`);
            console.log(`📌 Đã lưu SHA deploy: ${currentSha.substring(0, 8)}`);

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

            // 🔄 Re-sync .htpasswd & .htaccess (đồng bộ khi dev đổi credentials)
            console.log('🔐 Đồng bộ .htpasswd & .htaccess...');
            const hashedPass = crypt(config.basic_auth.password);
            fs.writeFileSync('/tmp/.htpasswd', `${config.basic_auth.username}:${hashedPass}`);
            await client.uploadFrom('/tmp/.htpasswd', `${targetDir}/.htpasswd`);

            const htaccessContent = [
                '<Files ~ "^\\.">',
                'Deny from all',
                '</Files>',
                'AuthType Basic',
                'AuthName "Restricted Area"',
                `AuthUserFile ${serverInfo.root_path}/${config.project_dir}/.htpasswd`,
                'Require valid-user',
            ].join('\n');
            fs.writeFileSync('/tmp/.htaccess', htaccessContent);
            await client.uploadFrom('/tmp/.htaccess', `${targetDir}/.htaccess`);
            console.log('✅ .htpasswd & .htaccess đã đồng bộ.');

            // 📌 Đọc SHA deploy lần trước từ server
            let lastDeployedSha = '';
            try {
                await client.downloadTo('/tmp/.deploy_sha', `${targetDir}/.deploy_sha`);
                const rawSha = fs.readFileSync('/tmp/.deploy_sha', 'utf8').trim();
                // 🛡️ Validate SHA là hex thuần (chống shell injection)
                if (/^[0-9a-f]{40}$/i.test(rawSha)) {
                    lastDeployedSha = rawSha;
                    console.log(`📌 SHA deploy trước: ${lastDeployedSha.substring(0, 8)}`);
                } else {
                    console.warn('⚠️ .deploy_sha chứa giá trị không hợp lệ — bỏ qua.');
                }
            } catch (e) {
                console.log('ℹ️ Không tìm thấy .deploy_sha — sẽ upload toàn bộ.');
            }

            const currentSha = execSync('git rev-parse HEAD').toString().trim();
            console.log(`📌 SHA hiện tại:      ${currentSha.substring(0, 8)}`);

            // Nếu SHA giống nhau → không có gì thay đổi
            if (lastDeployedSha === currentSha) {
                console.log('ℹ️ SHA trùng khớp — không có gì cần cập nhật.');
                return;
            }

            // Tìm diff giữa SHA cũ và HEAD
            let diffOutput = '';
            let needFullUpload = false;

            if (!lastDeployedSha) {
                // Không có SHA cũ → upload toàn bộ
                needFullUpload = true;
            } else {
                try {
                    // Kiểm tra SHA cũ còn tồn tại trong lịch sử (phòng force push / rebase)
                    execSync(`git cat-file -t ${lastDeployedSha}`, { stdio: 'pipe' });
                    diffOutput = execSync(`git diff --name-status ${lastDeployedSha} HEAD`).toString().trim();
                } catch (gitErr) {
                    console.warn(`⚠️ SHA cũ [${lastDeployedSha.substring(0, 8)}] không còn trong lịch sử (force push?).`);
                    needFullUpload = true;
                }
            }

            if (needFullUpload) {
                console.log('ℹ️ Chuyển sang upload toàn bộ source...');
                await uploadViaZip(client, config.source_folder, targetDir, ftpRoot, config, serverInfo);

                // Lưu SHA mới
                fs.writeFileSync('/tmp/.deploy_sha', currentSha);
                await client.uploadFrom('/tmp/.deploy_sha', `${targetDir}/.deploy_sha`);
                console.log(`📌 Đã cập nhật SHA deploy: ${currentSha.substring(0, 8)}`);
                console.log('✅ Hoàn thành!');
                return;
            }

            if (!diffOutput) {
                console.log('ℹ️ Không có thay đổi nào giữa 2 SHA.');

                // Vẫn cập nhật SHA để đồng bộ
                fs.writeFileSync('/tmp/.deploy_sha', currentSha);
                await client.uploadFrom('/tmp/.deploy_sha', `${targetDir}/.deploy_sha`);
                return;
            }

            // 🛡️ LỚP GIÁP 3: BẢO VỆ FILE HỆ THỐNG
            // Ngăn Dev vô tình xóa .htaccess, .htpasswd, .repo_lock dưới local
            const PROTECTED_FILES = ['.repo_lock', '.htaccess', '.htpasswd', '.deploy_sha'];
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
                    await client.cd(ftpRoot); // Reset CWD sau ensureDir
                    await client.uploadFrom(filePath, ftpFilePath);
                    console.log(`   ⬆️ Đã cập nhật: ${relativePath}`);
                    uploadCount++;
                }
            }

            // Lưu SHA mới sau khi deploy thành công
            fs.writeFileSync('/tmp/.deploy_sha', currentSha);
            await client.uploadFrom('/tmp/.deploy_sha', `${targetDir}/.deploy_sha`);
            console.log(`📌 Đã cập nhật SHA deploy: ${currentSha.substring(0, 8)}`);

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
