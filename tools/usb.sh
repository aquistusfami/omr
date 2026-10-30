#!/usr/bin/env bash
# Điện thoại Android nối với máy tính bằng cáp USB, không qua wifi.
# Camera vẫn chạy vì "localhost" là secure context, và không có chứng chỉ tự ký
# nào để bấm qua.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8443}"

command -v adb >/dev/null || {
  echo "Thiếu adb. Cài Android platform-tools:"
  echo "  NixOS:  nix-shell -p android-tools"
  echo "  Ubuntu: sudo apt install android-tools-adb"
  exit 1
}
if ! adb get-state >/dev/null 2>&1; then
  echo "Chưa thấy điện thoại. Bật: Cài đặt → Giới thiệu điện thoại → 7 lần vào 'Số bản dựng'"
  echo "→ Tuỳ chọn nhà phát triển → Gỡ lỗi USB, rồi cắm cáp và bấm 'Cho phép' trên máy."
  exit 1
fi

[ -f "$ROOT/web/dist/index.html" ] || (cd "$ROOT/web" && npm run build)

node "$ROOT/web/tools/hub.mjs" --http --local --port "$PORT" &
HUB=$!
trap 'kill "$HUB" 2>/dev/null || true' EXIT
sleep 1.5

adb reverse "tcp:$PORT" "tcp:$PORT" >/dev/null
TOKEN="$(cat "$ROOT/data/omr/.token")"

echo
echo "  Mở trên điện thoại:  http://localhost:$PORT/?t=$TOKEN"
echo "  Qua cáp USB — không cần wifi, không cảnh báo chứng chỉ."
echo "  Ctrl+C để dừng."
echo
wait "$HUB"
