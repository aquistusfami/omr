# AGENTS.md

Hướng dẫn cho người/agent tiếp tục làm việc trên repo này. Đọc hết file này trước khi sửa code.

## Đây là gì

Web app một trang, không framework, chấm **phiếu trả lời trắc nghiệm** in sẵn từ ảnh chụp bằng
điện thoại. Mục tiêu: 500 phiếu/buổi thi, chỉ có điện thoại, không máy scan, không thiết bị
chuyên dụng. Toàn bộ xử lý chạy trên máy (không server, không cloud); kết quả lưu
`localStorage`, xuất CSV.

Phiếu mẫu: `fixtures/blank-form.png` (ảnh phẳng của phiếu trống). Hình học đã trích xuất thành
`fixtures/template.json` — 240 ô, 21 dấu góc.

## Trạng thái (2026-10-23)

Đã chạy được: tách template, dò dấu góc + homography, đọc ô, xuất CSV, giao diện cơ bản.
Đo trên 30 ảnh giả lập: 1560 đơn vị trả lời, **0 sai**, 1 phiếu bị từ chối (fit xấu). 38 ms/phiếu
trong Node ở 1400 px; trên điện thoại dự kiến vài trăm ms.

Chưa có: sửa tay trong app, nhập đáp án + tính điểm, lưu ảnh gốc, chống trùng phiếu, PWA offline.
Xem `docs/06-roadmap.md`.

## Lệnh

```bash
# web app (điện thoại mở http://<ip-lan>:5173)
cd web && npm install && npm run dev

cd web && npm test        # 3 ảnh giả lập trong web/tests/fixtures
cd web && npm run build   # tsc --noEmit + vite build

# công cụ python (numpy, scipy, pillow — không cần opencv)
python3 tools/build_template.py          # tạo lại template.json + ảnh overlay
python3 tools/build_template.py --check  # CI: template có khớp phiếu mẫu không
python3 tools/make_fixtures.py --count 3 # sinh ảnh phiếu đã tô để test
python3 tools/make_fixtures.py --count 30 --out /tmp/sheets   # để đo độ chính xác
```

## Bản đồ repo

| Đường dẫn | Nội dung |
|---|---|
| `fixtures/blank-form.png` | ảnh phiếu trống, nguồn sự thật về hình học |
| `fixtures/template.json` | **sinh tự động**, đừng sửa tay |
| `fixtures/template-overlay.png` | ảnh kiểm tra: vòng xanh phải trùng khít từng ô |
| `tools/build_template.py` | dò dấu + ô, fit lưới, xuất template |
| `tools/make_fixtures.py` | sinh ảnh phiếu đã tô (perspective, sáng lệch, nhiễu) |
| `web/src/geometry.ts` | homography 8 ẩn, biến đổi điểm |
| `web/src/image.ts` | xám hoá, downscale, warp bilinear, lấy mẫu đĩa, Otsu, đọc PGM |
| `web/src/anchors.ts` | tìm dấu góc, fit canvas → ảnh, kiểm tra chất lượng |
| `web/src/grade.ts` | pipeline hoàn chỉnh + phân loại ô |
| `web/src/store.ts` | localStorage |
| `web/src/export.ts` | CSV |
| `web/src/main.ts` | UI (một màn hình) |
| `docs/` | kiến trúc, định dạng template, thuật toán, vận hành, roadmap |

## Bất biến — đừng phá

1. **`fixtures/template.json` là file sinh ra.** Sửa `tools/build_template.py` rồi chạy lại.
   Nếu `--check` báo STALE thì template và phiếu mẫu đã lệch nhau.
2. **Hệ toạ độ canvas**: 4 dấu cực trị của phiếu ánh xạ vào `(0,0)-(1000,0)-(1000,H)-(0,H)`.
   Nhờ vậy tỉ lệ in, lề, khổ giấy không ảnh hưởng — chỉ tỉ lệ khung in là quan trọng.
   Đổi quy ước này là phải sinh lại template và sửa docs/02.
3. **Không thêm dependency** nếu <50 dòng code tự viết là đủ. Hiện tại bundle 14 KB, không
   OpenCV.js, không framework. Đó là lý do app chạy được trên điện thoại yếu và offline.
4. **Ngưỡng phân loại nằm một chỗ**: `classify()` trong `web/src/grade.ts`. Đừng rải magic
   number ra chỗ khác.
5. **Thà từ chối phiếu còn hơn đọc sai**: mọi thay đổi làm tăng tỉ lệ nhận phiếu phải kèm bằng
   chứng là không tăng sai. Xem mục kiểm tra.
6. Chữ trong UI là tiếng Việt; comment và tên biến là tiếng Anh.

## Cách kiểm tra một thay đổi

```bash
cd web && npm test && npx tsc --noEmit
python3 tools/build_template.py --check
```

Muốn biết thay đổi có làm hỏng độ chính xác không:

```bash
python3 tools/make_fixtures.py --count 30 --out /tmp/sheets
# copy tests/grade.test.ts thành tests/_acc.test.ts trỏ vào /tmp/sheets, in ra
# "sheets / rejected / wrong cells", chạy xong thì xoá file tạm
```

Chấp nhận: 0 đơn vị sai trên các phiếu được nhận; tỉ lệ từ chối <5% với ảnh giả lập.

## Việc tiếp theo

Theo thứ tự trong `docs/06-roadmap.md`. Việc gấp nhất là **M1: chạy trên 50 phiếu thật** —
mọi con số độ chính xác hiện tại đều đến từ ảnh giả lập, chưa có ảnh chụp thật nào.
