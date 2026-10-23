# AGENTS.md

Hướng dẫn cho người/agent tiếp tục làm việc trên repo này. Đọc hết file này trước khi sửa code.

## Đây là gì

Web app một trang, không framework, chấm **phiếu trả lời trắc nghiệm** in sẵn từ ảnh chụp bằng
điện thoại. Mục tiêu: 500 phiếu/buổi thi, chỉ có điện thoại, không máy scan, không thiết bị
chuyên dụng. Toàn bộ xử lý chạy trên máy (không server, không cloud); kết quả lưu **IndexedDB**
(kèm ảnh phiếu), xuất **CSV / XLSX / JSON**.

Hai chế độ: **quét tự động** (camera gắn cố định, tự nhận phiếu, bíp khi đã lưu) và **chụp thủ
công** (input file, dùng khi không có https hoặc không cấp quyền camera).

Phiếu mẫu: `fixtures/blank-form.png` (ảnh phẳng của phiếu trống). Hình học đã trích xuất thành
`fixtures/template.json` — 240 ô, 21 dấu góc.

## Trạng thái (2026-10-23)

Đã chạy được: tách template, dò dấu góc + homography, đọc ô, quét tự động, IndexedDB, xuất
CSV/XLSX/JSON, CI trên GitHub Actions. Giao diện đã thiết kế lại (một màn hình, hai theme) nhưng
**chưa được nhìn trên trình duyệt nào** — máy phát triển không có trình duyệt.

**Chưa từng chạy trên điện thoại thật.** Toàn bộ phần camera (quyền, autoplay, https tự ký, độ
trễ) mới chỉ được kiểm tra bằng type check. Đó là việc đầu tiên trước M1.
Đo trên 30 ảnh giả lập: 1560 đơn vị trả lời, **0 sai**, 1 phiếu bị từ chối (fit xấu). 38 ms/phiếu
trong Node ở 1400 px; trên điện thoại dự kiến vài trăm ms.

Chưa có: sửa tay trong app, nhập đáp án + tính điểm, PWA offline. Chống trùng mới ở mức đánh dấu
cột `trung`, chưa chặn.
Xem `docs/06-roadmap.md`.

## Quy tắc làm việc

- Sau **mỗi lần làm việc**, cập nhật `README.md` (bảng Tiến độ, Việc tiếp theo) và tài liệu liên
  quan trong `docs/` **trong cùng commit** với code. Việc còn dở thì ghi rõ là còn dở.
- Giao diện: đọc `DESIGN.md` trước khi sửa `web/src/styles.css`; token nằm ở đó và trong file CSS.
  Bố cục là "máy đo": trạng thái đọc chiếm màn hình, không thêm card, không icon emoji, không
  gradient chữ. Bộ đọc tự động `impeccable` đã cài trong `.opencode/`.
- Sản phẩm/danh tính: `PRODUCT.md` (do `impeccable` ghi). Đừng thêm tuyên bố chưa kiểm chứng.

## Lệnh

```bash
# web app — mặc định https (camera cần secure context)
cd web && npm install && npm run dev
HTTP=1 npm run dev     # http, chỉ để xem giao diện trên máy tính

cd web && npm test        # grade + state machine + xlsx
cd web && npm run build   # tsc --noEmit + vite build
# CI chạy đúng các lệnh trên, cộng thêm build_template.py --check và mở file .xlsx
# bằng openpyxl: .github/workflows/ci.yml
# Push master ⇒ job deploy xuất bản web/dist lên GitHub Pages (cần bật Pages một lần
# trong Settings, Source: GitHub Actions). Vite dùng base "./" để chạy được ở /omr/.

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
| `web/src/scan.ts` | máy trạng thái quét tự động (thuần, có test) |
| `web/src/capture.ts` | getUserMedia, lấy khung hình, ảnh thu nhỏ |
| `web/src/store.ts` | IndexedDB: `sheets` + `thumbs` (ảnh tách riêng) |
| `web/src/export.ts` | bảng dùng chung cho CSV/XLSX, JSON |
| `web/src/xlsx.ts` | ghi .xlsx tối giản (zip không nén), không dependency |
| `web/src/main.ts` | UI: hai chế độ, banner, bíp, danh sách, xuất file |
| `docs/` | kiến trúc, định dạng template, thuật toán, vận hành, roadmap |

## Bất biến — đừng phá

1. **`fixtures/template.json` là file sinh ra.** Sửa `tools/build_template.py` rồi chạy lại.
   Nếu `--check` báo STALE thì template và phiếu mẫu đã lệch nhau.
2. **Hệ toạ độ canvas**: 4 dấu cực trị của phiếu ánh xạ vào `(0,0)-(1000,0)-(1000,H)-(0,H)`.
   Nhờ vậy tỉ lệ in, lề, khổ giấy không ảnh hưởng — chỉ tỉ lệ khung in là quan trọng.
   Đổi quy ước này là phải sinh lại template và sửa docs/02.
3. **Không thêm dependency** nếu <50 dòng code tự viết là đủ. Bundle hiện 25 KB (gzip 10 KB),
   không OpenCV.js, không framework. Đó là lý do app chạy được trên điện thoại yếu và offline.
   `@vitejs/plugin-basic-ssl` là devDependency duy nhất thêm vào, chỉ dùng cho server dev.
4. **Ngưỡng phân loại nằm một chỗ**: `classify()` trong `web/src/grade.ts`. Đừng rải magic
   number ra chỗ khác.
5. **Thà từ chối phiếu còn hơn đọc sai**: mọi thay đổi làm tăng tỉ lệ nhận phiếu phải kèm bằng
   chứng là không tăng sai. Xem mục kiểm tra.
6. Chữ trong UI là tiếng Việt; comment và tên biến là tiếng Anh.
7. **Mỗi phiếu chỉ được ghi một lần.** `Scanner` chỉ nhận sau hai lần đọc khớp nhau và chỉ nhận
   lại khi phiếu đã được nhấc ra. Đừng bỏ cơ chế này — nó là thứ chặn 1 phiếu thành 20 dòng.
8. **"Đã nhận" nghĩa là đã ghi xong**: `store.add()` chỉ resolve sau khi transaction commit.
   Đừng đổi thành ghi rồi trả về ngay, người dùng sẽ nhấc phiếu khi dữ liệu chưa xuống đĩa.

## Cách kiểm tra một thay đổi

```bash
cd web && npm test && npx tsc --noEmit
python3 tools/build_template.py --check
```

Sửa `scan.ts` thì sửa test trước — hành vi "nhận một lần, nhấc ra mới nhận tiếp" là hợp đồng.
Chạm vào `xlsx.ts` thì kiểm tra file thật:

```bash
cd web && npx vitest run tests/xlsx.test.ts   # ghi omr-test.xlsx vào thư mục tmp
uv run --with openpyxl python3 -c "import os,tempfile,openpyxl; print(openpyxl.load_workbook(os.path.join(tempfile.gettempdir(),'omr-test.xlsx')).active.dimensions)"
```

Muốn biết thay đổi có làm hỏng độ chính xác không:

```bash
python3 tools/make_fixtures.py --count 30 --out /tmp/sheets
# copy tests/grade.test.ts thành tests/_acc.test.ts trỏ vào /tmp/sheets, in ra
# "sheets / rejected / wrong cells", chạy xong thì xoá file tạm
```

Chấp nhận: 0 đơn vị sai trên các phiếu được nhận; tỉ lệ từ chối <5% với ảnh giả lập.

## Việc tiếp theo

1. Chạy thử trên điện thoại thật (https, camera, bíp, chống nhận trùng).
2. **M1: chạy trên 50 phiếu thật** — mọi con số độ chính xác hiện tại đều đến từ ảnh giả lập.
3. Đạt M1 rồi mới làm M2 (sửa tay trong app), sau đó M5 (đáp án + điểm).

Tiến độ đầy đủ: `README.md` mục "Tiến độ" và `docs/06-roadmap.md`.
