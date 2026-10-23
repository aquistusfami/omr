# Chấm phiếu trắc nghiệm bằng điện thoại

Chấm phiếu trả lời trắc nghiệm in sẵn bằng điện thoại. Không cần máy scan, không cần thiết bị
chuyên dụng, không cần mạng, không cần cài app: mở trang web bằng điện thoại.

Hai cách dùng:

- **Quét tự động**: gắn điện thoại cố định trên giá, đặt phiếu vào khung. Máy tự đọc, bíp và hiện
  banner xanh khi đã lưu xong — nhấc phiếu ra, đặt phiếu tiếp theo. ~4 giây/phiếu.
- **Chụp thủ công**: chụp từng phiếu như chụp ảnh thường. Dùng khi không mở được camera.

Giao diện là một bảng đọc: trạng thái chiếm cả bề ngang và đổi màu cả khung ngắm, bộ đếm phiếu ở
góc trên, có theme sáng/tối. Mọi thứ khác nằm dưới màn hình đầu. Xem [DESIGN.md](DESIGN.md).

Kết quả lưu trong IndexedDB của điện thoại (kèm ảnh phiếu đã nắn phẳng để đối chiếu), xuất được
**CSV**, **Excel (.xlsx)** và **JSON** — có sẵn cột **điểm**.

**Đáp án & điểm**: mở mục "Đáp án & điểm" ngay trên danh sách, dán đáp án theo mã đề (mỗi dòng một
mã). Thang mặc định: **2 điểm/câu, đúng 100% mới có điểm** (phần II tính cả 6 ý), tổng 30 điểm.
Điểm được tính lại mỗi lần xem/xuất, không lưu vào từng phiếu — sửa đáp án là toàn bộ kết quả đổi
theo.

Dùng cho phiếu 15 câu hiện có (`fixtures/blank-form.png`): 240 ô tô, 9 chữ số mã sinh viên,
3 chữ số mã đề, PHẦN I 10 câu A–D, PHẦN II 5 câu × 6 ý Đúng/Sai.

## Chạy thử

```bash
cd web
npm install
npm run dev          # in ra địa chỉ LAN dạng https, mở bằng điện thoại
```

Camera trình duyệt yêu cầu **https**. Chứng chỉ dev là tự ký: điện thoại cảnh báo một lần, bấm
"Nâng cao" → "Vẫn tiếp tục". Chỉ xem giao diện bằng máy tính thì dùng `HTTP=1 npm run dev`.

### Mở trên điện thoại

**Cùng mạng wifi**: dùng địa chỉ `https://<ip-lan>:5173` mà `npm run dev` in ra. Chứng chỉ tự ký
nên điện thoại cảnh báo một lần.

**Không cùng mạng, hoặc dùng lâu dài**: bản build tự động đưa lên GitHub Pages —
https://aquistusfami.github.io/omr/ (https thật, không cảnh báo chứng chỉ).

Bật một lần trong repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Sau đó mỗi lần push `master`, job `deploy` trong `.github/workflows/ci.yml` build và xuất bản.

> Kết quả chấm nằm trong IndexedDB **của từng địa chỉ web**. Đổi từ `https://<ip-lan>:5173` sang
> `https://aquistusfami.github.io/omr/` là thấy danh sách trống — dữ liệu cũ vẫn còn ở địa chỉ cũ.
> Chọn một địa chỉ rồi dùng suốt buổi chấm, và xuất file trước khi đổi.

Chọn ảnh có sẵn để thử nhanh:

```bash
python3 tools/make_fixtures.py --count 3
# rồi mở web, chọn web/tests/fixtures/sheet-0.pgm  (trình duyệt không đọc PGM;
# muốn thử bằng ảnh thì chụp phiếu thật, hoặc convert: python3 -c "from PIL import Image; Image.open('sheet-0.pgm').save('sheet-0.png')")
```

## Tiến độ

Cập nhật 2026-10-24. Chi tiết và tiêu chí nghiệm thu: [docs/06-roadmap.md](docs/06-roadmap.md).

| Phần | Trạng thái |
|---|---|
| Template từ phiếu thật, dò 4 dấu góc, nắn phối cảnh | ✅ |
| Đọc 220 ô trả lời, cờ ô mờ / tô nhiều / ô trống | ✅ |
| Đọc được **bản scan thật** (57 tờ, A4 dọc, giấy tối dần) | ✅ 57/57, xem bên dưới |
| Quét tự động trên giá cố định, chống nhận trùng một phiếu | ✅ code + test, **chưa chạy trên điện thoại thật** |
| Chụp thủ công (input file) khi không có camera | ✅ |
| Lưu IndexedDB: kết quả + ảnh phiếu 900 px | ✅ |
| Xuất CSV / Excel (.xlsx) / JSON | ✅ |
| Thiết kế lại giao diện (máy đo, 2 theme, dải trạng thái) | ✅ đã dựng ở 360/390 px, cả 2 theme |
| CI: type check, test, build, template, mở file xlsx | ✅ |
| Deploy GitHub Pages (https cho camera) | 🟠 chờ bật Pages trong Settings |
| **M1 — đo độ chính xác trên 50 phiếu chấm tay** | 🔴 **việc tiếp theo** |
| M2 — sửa ô ngay trong app | ⬜ |
| M3 — nắn theo từng khối (phiếu cong) | ⬜ |
| M4 — chặn trùng, xoá ảnh theo lô | 🟡 đã đánh dấu trùng, chưa chặn |
| M5 — nhập đáp án, tính điểm, phổ điểm | 🟡 2đ/câu, đúng 100% mới có điểm (tổng 30); chưa có phổ điểm |
| M6 — PWA offline, gộp nhiều điện thoại | ⬜ |

**Đã đọc được phiếu thật.** Bộ 57 tờ scan A4 (ảnh 150 dpi, 1240×1754): 57/57 nhận, dùng 15–21
dấu góc, residual ≤ 2.7 canvas unit, 37 ms/tờ trong Node, 0 ô mã sinh viên/mã đề bị trống.
Cờ còn lại: 158/2109 đơn vị (7.5%), trong đó 157 là `blank` — học sinh thật sự bỏ trống câu, đã
đối chiếu ảnh. Bốn mã sinh viên đối chiếu tay (p-01, p-04, p-08, p-19) đều khớp.

Ảnh giả lập vẫn dùng cho test tự động: 3 phiếu thường + 1 phiếu A4 dọc có khung dấu ngoài phiếu,
gradient trên–dưới và nét bút chì nhạt (đúng ba thứ đã làm hỏng lần đọc thật đầu tiên).

Độ chính xác đáp án A–D **chưa** đo được: cần bảng chấm tay của chính 57 tờ đó.

## Việc tiếp theo

1. **Bật Pages** (Settings → Pages → Source: GitHub Actions) rồi chạy lại job `deploy` — 1 phút.
2. **Chạy thử trên điện thoại thật** (~5 phút): mở https, cấp quyền camera, đặt 3–5 phiếu đã tô,
   kiểm tra bíp + banner xanh + nhấc phiếu ra mới nhận phiếu tiếp. Bố cục đã dựng bằng trình
   duyệt headless; phần chưa kiểm chứng là camera và quyền truy cập trên máy thật.
3. **Nhập đáp án** trước khi chấm (mục "Đáp án & điểm"): mỗi mã đề một dòng 40 ký tự. Không có
   đáp án thì phiếu vẫn được đọc và xuất, chỉ trống cột điểm.
4. **M1**: chấm tay 50 trong 57 tờ đã có (hoặc chụp thêm), so từng ô, đo 4 con số (ô sai, tỉ lệ
   từ chối, tỉ lệ cờ, giây/phiếu). Không đạt thì chỉnh ngưỡng trong `classify()` / `classifyColumn()`
   rồi đo lại.
5. Đạt M1 mới chấm 500 phiếu thật; sau đó mới làm M2 (sửa tay trong app) — nó là khoảng trống
   giữa "có file Excel" và "quy trình khép kín".

## Điều kiện để chấm đúng

1. In đúng **100% scale**, cùng một máy in cho cả 500 phiếu. In "fit to page" là lệch template.
2. Điện thoại **song song mặt phiếu**, cách 30–40 cm, đủ sáng, không bóng tay.
   Giá đỡ 50–100k (hoặc chặn sách) là đủ — xem [docs/05-operations.md](docs/05-operations.md).
   Quét tự động bắt buộc điện thoại phải cố định.
3. Ảnh phải thấy **đủ 4 dấu góc đen** của phiếu.

## Tài liệu

| File | Nội dung |
|---|---|
| [AGENTS.md](AGENTS.md) | quy ước repo, lệnh, bất biến — đọc trước khi sửa code |
| [docs/01-architecture.md](docs/01-architecture.md) | vì sao chạy trên máy, luồng dữ liệu, phạm vi |
| [docs/02-template-format.md](docs/02-template-format.md) | hợp đồng toạ độ, cấu trúc `template.json` |
| [docs/03-pipeline.md](docs/03-pipeline.md) | thuật toán và từng ngưỡng, cách chỉnh |
| [docs/04-sheet-layout.md](docs/04-sheet-layout.md) | bố cục phiếu, số ô, dấu góc, yêu cầu in |
| [docs/05-operations.md](docs/05-operations.md) | quy trình chấm 500 phiếu trong buổi thi |
| [docs/06-roadmap.md](docs/06-roadmap.md) | các mốc tiếp theo và tiêu chí nghiệm thu |

## Công cụ

`tools/` chỉ cần Python 3 + numpy/scipy/Pillow (máy này đã có). Không dùng OpenCV.

- `build_template.py` — sinh `template.json` và ảnh overlay kiểm tra từ ảnh phiếu trống.
- `make_fixtures.py` — sinh ảnh phiếu đã tô (nắn phối cảnh, sáng lệch, nhiễu) để test và đo độ chính xác.
