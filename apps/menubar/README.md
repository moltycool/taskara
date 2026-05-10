# Taskara Menubar

اپ سبک macOS برای نمایش و مدیریت تسک‌های شخصی Taskara داخل منوبار.

## Setup

در فایل `.env` ریشه پروژه مقدارهای زیر را ست کن:

```env
TASKARA_API_URL="http://localhost:4000"
WEB_ORIGIN="http://localhost:3005"
TASKARA_AUTH_TOKEN="<token from web auth session>"
```

منوبار فقط با توکن سشن وب کار می‌کند. `TASKARA_WORKSPACE_SLUG` اختیاری است؛ اگر ست نشود از `/workspaces` به‌صورت خودکار انتخاب می‌شود.

اختیاری:

```env
TASKARA_MENUBAR_REFRESH_MS="60000"
TASKARA_WEB_URL="http://localhost:3005"
```

## Run

از ریشه پروژه:

```bash
bun run dev:menubar
```

آیتم `TA <count>` در منوبار ساخته می‌شود.

- کلیک چپ: باز شدن پنل کوچک (نسخه مینی وب)
- کلیک راست: منوی سریع
- نمایش شمارنده `Active/Done/Total`
- نمایش جزئیات هر تسک: `key`, عنوان، وضعیت، اولویت، پروژه، ددلاین، زمان آخرین بروزرسانی، بخشی از توضیحات
- تغییر مستقیم وضعیت و اولویت هر تسک
- دکمه سریع `Done` برای بستن تسک
- گزینه `اجرا خودکار بعد از Login` داخل پنل (macOS)

## Build (Local)

از ریشه پروژه:

```bash
bun run build:menubar
```

خروجی داخل `apps/menubar/release` ساخته می‌شود (فایل‌های `dmg` و `zip`).

## Config In Packaged App

در نسخه نصب‌شده، منوبار فایل تنظیمات را به‌ترتیب از این مسیرها می‌خواند:

1. مسیر `TASKARA_ENV_PATH` اگر ست شده باشد
2. فایل `.env` در مسیر `~/Library/Application Support/@taskara/menubar/.env` (مسیر پیش‌فرض فعلی Electron برای این اپ)
3. فایل `.env` در مسیر `~/Library/Application Support/Taskara Menubar/.env` (مسیر قدیمی/سازگار)
4. فایل `.env` ریشه پروژه (برای حالت توسعه)
5. مسیر اجرای فعلی برنامه
6. فایل `.env` کنار `Resources` اپ

برای نسخه ریلیز، یکی از مسیرهای زیر را بساز:

```bash
mkdir -p "$HOME/Library/Application Support/Taskara Menubar"
cp .env "$HOME/Library/Application Support/Taskara Menubar/.env"
```

یا:

```bash
mkdir -p "$HOME/Library/Application Support/@taskara/menubar"
cp .env "$HOME/Library/Application Support/@taskara/menubar/.env"
```

## GitHub Release

یک workflow در `.github/workflows/release-menubar.yml` اضافه شده که با push شدن تگ `menubar-v*` اجرا می‌شود و artifact ریلیز را به GitHub Release همان تگ attach می‌کند.

نمونه:

```bash
git tag menubar-v0.1.0
git push origin menubar-v0.1.0
```
