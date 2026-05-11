#!/bin/sh
set -eu

escape_json_string() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

api_url="${TASKARA_API_URL:-${VITE_TASKARA_API_URL:-}}"
cdn_upload_url="${TASKARA_CDN_UPLOAD_URL:-${VITE_TASKARA_CDN_UPLOAD_URL:-}}"
cdn_media_base_url="${TASKARA_CDN_MEDIA_BASE_URL:-${VITE_TASKARA_CDN_MEDIA_BASE_URL:-}}"
cdn_app="${TASKARA_CDN_APP:-${VITE_TASKARA_CDN_APP:-taskara}}"

escaped_api_url="$(escape_json_string "$api_url")"
escaped_cdn_upload_url="$(escape_json_string "$cdn_upload_url")"
escaped_cdn_media_base_url="$(escape_json_string "$cdn_media_base_url")"
escaped_cdn_app="$(escape_json_string "$cdn_app")"

cat > /usr/share/nginx/html/env.js <<EOF
window.__TASKARA_CONFIG__ = {
  TASKARA_API_URL: "$escaped_api_url",
  TASKARA_CDN_UPLOAD_URL: "$escaped_cdn_upload_url",
  TASKARA_CDN_MEDIA_BASE_URL: "$escaped_cdn_media_base_url",
  TASKARA_CDN_APP: "$escaped_cdn_app"
};
EOF
