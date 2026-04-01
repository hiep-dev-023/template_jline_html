# TAI - Advanced Static Architecture (HTML/PHP)

🌍 **[English](#english)** | **[日本語](#日本語)** | **[Tiếng Việt](#tiếng-việt)**

---

<h2 id="english">🇬🇧 English</h2>

A battle-tested, high-performance static site generator built on top of Node.js. Designed for cross-platform compatibility (Windows, macOS, Linux), it features a blazing-fast build pipeline parsing **EJS**, **SCSS**, and Vanilla **JS** into a pristine, production-ready `public/` directory within milliseconds.

### ✨ Core Features

- **Dual Output Modes**: Compile to `.html` or `.php`. Fully automated `<?php include ?>` extraction for components.
- **Deep Component Nesting**: Support for infinitely nested component structures (`components/headers/main.ejs` -> `public/components/headers/main.php`).
- **Frontmatter Routing**: Define Layouts, Headers, Footers, Meta tags, and Vendor CSS/JS directly within your EJS file's Frontmatter data.
- **AST-Aware Auto Formatting**: A state-of-the-art 2-Phase formatting pipeline. Uses `js-beautify` to strictly align the HTML DOM structure, and `Prettier` (PHP Plugin) to securely format internal PHP AST logic. The output code is pixel-perfect and highly readable.
- **Next-Gen Image Optimization**: Auto-converts `.jpg` and `.png` to optimized `.webp` formats during build via Sharp.
- **100% OS-Agnostic**: Implements native Node.js FS APIs instead of bash commands, eliminating cross-platform path configuration issues.
- **Hot Reloading**: Lightning-fast `browser-sync` live reloading seamlessly proxied over local environments (MAMP, XAMPP, Laragon, Valet).

### 🚀 Quick Start

#### 1. Requirements
- **Node.js**: `v16.0.0` or higher.

#### 2. Installation
Clone the repository and install the dependencies:
```bash
npm install
```

#### 3. Environment Setup
Rename or copy `.env.example` to `.env` at the root of the project to customize the build outputs:
```env
OUTPUT_EXT=.php             # Output extension: .php or .html
USE_PHP_INCLUDE=true        # Set true to use native PHP component inclusions
SERVER_TYPE=mamp            # (Optional) Auto-proxy BrowserSync. Options: mamp, xampp, laragon, valet
PROXY_URL=                  # (Optional) Override exact local proxy URL if needed
```

#### 4. Available Commands
```bash
npm run dev    # Start the development server with live reloading
npm run build  # Run a full production build
npm run clean  # Clean the public/ output directory
```

### 📂 Project Architecture

```text
├── .env                # Core build configurations
├── scripts/            # Node.js build pipeline scripts
├── public/             # 📦 Production build output (Auto-generated)
└── src/                # 🛠️ Source files
    ├── components/     # Reusable UI partials (header, footer, sidebar, etc.)
    ├── layouts/        # Global layout wrappers (e.g. _default.ejs)
    └── pages/          # EJS Pages and Assets
        ├── assets/     # scss/, js/, images/, vendor/
        ├── index.ejs   # Maps to -> public/index.php
        └── about/      # Maps to -> public/about/index.php
```

### 🛠️ Usage Guide

#### 1. Creating Pages & Frontmatter
Pages must be placed directly inside the `src/pages/` directory. Use YAML frontmatter at the top of the file to declare the layout and assets.

```ejs
---
layout: _default
title: About Us Homepage
description: This is an inner about page.
css: ['common', 'about']
js: ['common']
header: 'headers/header_01'
footer: 'footers/footer_01'
---
<main class="p-about">
    <h1>Hello World</h1>
    
    <!-- Include a component dynamically from anywhere inside the body! -->
    <%- includeComponent('sidebar') %>
</main>
```

#### 2. Creating Components
Place your reusable UI components inside `src/components/`. All component files **must start with an underscore `_`** (e.g., `_sidebar.ejs`, `headers/_header_01.ejs`).

The build pipeline will automatically recursively transpile these into `public/components/*` and map all paths mathematically based on directory depth.

#### 3. Assets Management (SCSS, JS, Images)
Place your raw assets inside `src/pages/assets/`.
- **SCSS**: Files not prefixed with an underscore (e.g., `common.scss`) will compile into `public/assets/css/common.css`.
- **Images**: `.jpg` and `.png` will be compressed into `.webp` automatically. Place them in `src/pages/assets/images/`.

In your HTML/PHP files, always use the relative `assetsDir` variable to ensure deeply nested pages locate the assets correctly:
```html
<img src="<%= assetsDir %>assets/images/common/logo.webp" alt="Logo">
```

### ⚙️ How Formatting Works
This template resolves the notorious "broken indentation" problem associated with compiling `<% %>` EJS templating logic mixing HTML and PHP.
1. Our customized `<% ... -%>` compiler strips invisible logical blank lines gracefully.
2. The final build string passes through **js-beautify**, reconstructing the DOM elements mathematically.
3. If compiling to `.php`, the code routes into **Prettier**, which fine-tunes the indentation inside the `<?php ... ?>` blocks to match the exact depth of the HTML element they are nested inside.

If you don't need PHP formatting overhead, simply set `OUTPUT_EXT=.html` and `USE_PHP_INCLUDE=false` in the `.env` file!

*Built with ❤️ for High-Performance Architectures.*

<br><br>

---

<h2 id="日本語">🇯🇵 日本語</h2>

Node.js上で構築された高速かつ堅牢な静的サイトジェネレーターです。クロスプラットフォーム（Windows、macOS、Linux）対応で設計されており、**EJS**、**SCSS**（Dart Sass）、および**Vanilla JS**をミリ秒単位でビルドし、プロダクションレディな`public/`ディレクトリを出力します。

### ✨ 主な機能

- **デュアル出力モード**: `.html`または`.php`に出力可能。コンポーネント用の`<?php include ?>`抽出を完全に自動化しています。
- **深いコンポーネントの入れ子**: コンポーネント構造の深いネスト（例: `components/headers/main.ejs` -> `public/components/headers/main.php`）を無限にサポートします。
- **Frontmatter（フロントマター）ルーティング**: EJSファイルのFrontmatterデータ内でレイアウト、ヘッダー、フッター、メタタグ、およびベンダーCSS/JSを直接定義します。
- **AST対応フォーマッタ**: 最先端の2段階フォーマットパイプラインを搭載。`js-beautify`を使用してHTMLのDOM構造を厳密に揃え、`Prettier`（PHPプラグイン）で内部のPHP ASTロジックを安全にフォーマットします。出力コードはピクセルパーフェクトで高可読性を保ちます。
- **次世代の画像最適化**: ビルド時にSharpライブラリを通じて`.jpg`および`.png`を最適化された`.webp`形式に自動変換します。
- **100% OS非依存**: Bashコマンドの代わりにネイティブなNode.js API（fs）を実装することで、クロスプラットフォームにおけるパス解決の競合問題を排除しています。
- **ホットリロード**: ローカル環境（MAMP、XAMPP、Laragon、Valet）上でプロキシを介して高速な`browser-sync`ライブリロードを実現。

### 🚀 クイックスタート

#### 1. 必須要件
- **Node.js**: `v16.0.0` 以上

#### 2. インストール
リポジトリをクローンし、依存関係をインストールします。
```bash
npm install
```

#### 3. 環境設定
出力内容をカスタマイズするには、プロジェクトのルートディレクトリで`.env.example`を`.env`にリネームして以下の設定を行います。
```env
OUTPUT_EXT=php             # 出力ファイルの拡張子: .php または .html
USE_PHP_INCLUDE=true       # trueの場合、コンポーネントのインクルードに <?php include ?> を使用します
SERVER_TYPE=mamp           # ローカルサーバーの種類（mamp, xampp, laragon, valet）
WEB_ROOT=                  # Webルートの絶対パス（例: D:\laragon\www）
PROXY_URL=                 # 固定プロキシURLが存在する場合に設定
```

#### 4. コマンド一覧
```bash
npm run dev    # ライブリロード付きの開発サーバーを起動します
npm run build  # 本番用のクリーンビルドを実行します
npm run clean  # public/ フォルダを一掃します
```

### 📂 プロジェクト構成

```text
├── .env                # コアのビルド設定
├── scripts/            # Node.jsビルドパイプラインのスクリプト群
├── public/             # 📦 プロダクション用ビルド出力（自動生成）
└── src/                # 🛠️ ソースファイル
    ├── components/     # 再利用可能なUIパーツ（ヘッダー、フッターなど）
    ├── layouts/        # グローバルレイアウトのラッパー（例: _default.ejs）
    └── pages/          # EJSページおよびアセット
        ├── assets/     # scss/, js/, images/, vendor/
        ├── index.ejs   # -> public/index.php
        └── about/      # -> public/about/index.php
```

### 🛠️ 開発ガイド

#### 1. ページとFrontmatterの作成
ページは必ず`src/pages/`ディレクトリの直下に配置してください。ファイルの先頭にYAMLのFrontmatterを使用して、レイアウトとアセットを宣言します。

```ejs
---
layout: _default
title: About Us ホームページ
description: 会社案内ページです。
css: ['common', 'about']
js: ['common']
header: 'headers/header_01'
footer: 'footers/footer_01'
---
<main class="p-about">
    <h1>Hello World</h1>
    
    <!-- ここから任意のコンポーネントを動的にインクルードできます -->
    <%- includeComponent('sidebar') %>
</main>
```

#### 2. コンポーネントの作成
再利用可能なUIコンポーネントは`src/components/`に配置します。すべてのコンポーネントファイル名は**アンダースコア（`_`）で始まる必要があります**（例: `_sidebar.ejs`、`headers/_header_01.ejs`）。

#### 3. アセット管理（SCSS, JS, Images）
未コンパイルのアセットを`src/pages/assets/`に配置してください。
- **SCSS**: アンダースコア（`_`）で始まらないファイル（例: `common.scss`）は、独立したファイルとして`public/assets/css/`ディレクトリに出力されます。
- **画像**: `.jpg`および`.png`は不可逆の`.webp`形式に自動圧縮されます。

HTML/PHPファイル内で画像を呼び出す際は、相対パスを自動解決するため、必ず`assetsDir`変数を使用してください。
```html
<img src="<%= assetsDir %>assets/images/common/logo.webp" alt="Logo">
```

### ⚙️ 自動フォーマッタの仕組み
このテンプレートは、EJS等のロジックブロック（`<% %>`）によってHTMLとPHPが混在することで発生する「不正なインデント」問題を解決します。
1. カスタムEJSコンパイラー（`<%- ... -%>`タグ）が、不要な論理空行をエレガントに取り除きます。
2. その後、ビルドされた文字列は`js-beautify`を通過し、DOM要素が数学的に正しい構造に修正されます。
3. `php`への出力が有効な場合は、最後にそのファイルが`Prettier`にルーティングされ、`<?php ... ?>`ブロック内のインデントが、外側のHTML要素の深さと正確に一致するように微調整されます。

*高性能なアーキテクチャのために❤️を込めて構築されています。*

<br><br>

---

<h2 id="tiếng-việt">🇻🇳 Tiếng Việt</h2>

Hệ thống Website Tĩnh siêu tốc được xây dựng trên Node.js. Được thiết kế tối ưu trên mọi nền tảng (Windows, macOS, Linux). Nó cung cấp một luồng Build chớp nhoáng, chuyển hóa **EJS**, **SCSS**, và **JS** (Vanilla) thành các file hoàn hảo sẵn sàng trên thư mục `public/` chỉ trong vài mili-giây.

### ✨ Tính Năng Cốt Lõi

- **Chế Độ Xuất Kép**: Biên dịch ra chuẩn `.html` hoặc `.php`. Cấu trúc nhúng Component thông qua `<?php include ?>` được tự động trích xuất.
- **Component Đa Tầng**: Hỗ trợ gọi Component từ mọi độ sâu thư mục (`components/headers/main.ejs` -> `public/components/headers/main.php`).
- **Định Tuyến Frontmatter**: Khai báo Layout, Cấu hình Thẻ Meta, và Danh sách JS/CSS trực tiếp trên phần đầu (Head) của mỗi file EJS.
- **Auto Format Hiểu DOM (AST)**: Xử lý kiến trúc Code 2 Lớp tân tiến. Dùng `js-beautify` để căn chỉnh lại chính xác kết cấu thẻ DOM, và plugin PHP của `Prettier` nắn chỉnh các thẻ PHP nương theo khối lùi dòng của HTML bên ngoài. HTML/PHP xuất ra sạch bong như in máy.
- **Tối Ưu Ảnh Thông Minh**: Tự động convert đuôi ảnh `.jpg` / `.png` thành định dạng nhẹ `.webp` bằng thư viện Sharp.
- **Tương Thích Mọi OS (100% OS-Agnostic)**: Hệ thống sử dụng Node.js FS API gốc để thao tác File thay cho các lệnh Bash, loại bỏ hoàn toàn các lỗi xung đột đường dẫn trên Windows.
- **Hot Reload Siêu Tốc**: Live reload đỉnh cao tự động proxy web thông qua môi trường dev của riêng bạn (MAMP, XAMPP, Laragon, Valet).

### 🚀 Hướng Dẫn Nhanh

#### 1. Yêu Cầu
- **Node.js**: Phiên bản `v16.0.0` trở lên.

#### 2. Cài Đặt
Copy Source về và chạy cài đặt thư viện:
```bash
npm install
```

#### 3. Cấu Hình Môi Trường
Đổi tên file `.env.example` thành `.env` nằm ở gốc dự án để setup theo ý bạn:
```env
OUTPUT_EXT=php             # Đuôi file xuất ra: php hoặc html
USE_PHP_INCLUDE=true       # Đặt true để dùng <?php include ?> gọi file component
SERVER_TYPE=mamp           # Server ảo hóa tích hợp: mamp, xampp, laragon, valet
WEB_ROOT=                  # Nơi chứa webroot của bạn (VD: D:\laragon\www)
PROXY_URL=                 # Có thể điền cụ thể localhost URL để Server proxy theo
```

#### 4. Lệnh Command
```bash
npm run dev    # Chạy Watcher mượt mà với Auto-Reload
npm run build  # Xóa sạch và Build mới 100% lên Production
npm run clean  # Clean Source code public/
```

### 📂 Hiểu Về Cấu Trúc File

```text
├── .env                # Setting chung
├── scripts/            # Khối thần kinh Build System (Đã Optimize)
├── public/             # 📦 Thư mục Output cuối cùng (Auto-gen)
└── src/                # 🛠️ Nơi diễn ra hoạt động Code
    ├── components/     # Chứa các mảnh UI vụn (header, footer, sidebar...)
    ├── layouts/        # Chứa Layout sườn (VD: _default.ejs)
    └── pages/          # Chứa các trang EJS và Assets
        ├── assets/     # scss/, js/, images/, vendor/
        ├── index.ejs   # Export -> public/index.php
        └── about/      # Export -> public/about/index.php
```

### 🛠️ Hướng Dẫn Sử Dụng Chi Tiết

#### 1. Khởi Tạo Trang và Frontmatter
Mỗi khi tạo một trang mới tạo trực tiếp trong `src/pages/`. Sử dụng hệ thống YAML Frontmatter ở trên đỉnh dòng 1 để khai báo Layout, Script, và Meta Data.

```ejs
---
layout: _default
title: Trang About
description: Trang mô tả công ty
css: ['common', 'about']
js: ['common']
header: 'headers/header_01'
footer: 'footers/footer_01'
---
<main class="p-about">
    <h1>Hello World</h1>
    
    <!-- Lệnh nhúng một Component thần thánh không lo sai Paths -->
    <%- includeComponent('sidebar') %>
</main>
```

#### 2. Quản Lý Component
Chỉ đặt Component ở thư mục `src/components/`. Bắt buộc phải thêm **dấu gạch dưới `_` ở đầu file** (Ví dụ: `_sidebar.ejs`, `headers/_header_01.ejs`).

Bộ Build sẽ tự động tìm kiếm sâu vào tận trong các folder con, dịch chúng thành mã PHP và xuất riêng biệt ra `public/components/*`.

#### 3. Quản Lý Tệp (Assets)
Tất cả tài nguyên tĩnh bỏ hết vào `src/pages/assets/`.
- **SCSS**: Nếu file scss không bắt đầu bằng dấu ngắt `_`, nó sẽ tự nhận đó là File chính cấp 1 và build tự động ra `public/assets/css/`.
- **Images**: Ảnh đuôi JPG/PNG sẽ bị bắt convert gắt gao sang dạng WebP siêu nhẹ.

Quan trọng: Khi code bên trong HTML, hãy luôn thêm biến `<%= assetsDir %>` để đường dẫn luôn trỏ về gốc dự án chuẩn xác, bất chấp độ sâu của Folder chứa trang:
```html
<img src="<%= assetsDir %>assets/images/common/logo.webp" alt="Logo">
```

### ⚙️ Cơ Chế Làm Sạch Mã Nguồn (Auto-Formatter)
Dự án được kết hợp Thuật toán xử lý lùi dòng tiên tiến giúp ngăn chặn hệ quả phình trướng lề trống của EJS.
1. Bộ biên dịch chèn thẻ ngầm `<% ... -%>` dọn sạch rác tàn dư ngắt dòng của JS logic.
2. Mã thô sau đó được **js-beautify** kéo nắn lại cấu trúc ngang dọc DOM theo hệ toán học.
3. Cuối cùng, nếu xuất PHP, **Prettier** sẽ chui vào sâu từng hàm `<?php include ?>` để vi chỉnh lại lề của nó khít với thẻ div cha bao quanh nó ở ngoài cùng.

*Được thiết kế với ❤️ dành riêng cho những Developer Tối Giản, Hiện Đại.*
