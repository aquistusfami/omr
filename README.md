# Chấm phiếu trắc nghiệm bằng điện thoại

Chấm phiếu trả lời trắc nghiệm in sẵn bằng điện thoại. Không cần máy scan, không cần thiết bị
chuyên dụng, không cần mạng, không cần cài app: mở trang web bằng điện thoại.

Hai cách dùng:

- **Quét tự động**: gắn điện thoại cố định trên giá, đặt phiếu vào khung. Máy tự đọc, bíp và hiện
  banner xanh khi đã lưu xong — nhấc phiếu ra, đặt phiếu tiếp theo. ~4 giây/phiếu.
- **Chụp thủ công**: chụp từng phiếu như chụp ảnh thường. Dùng khi không mở được camera.

Kết quả lưu trong IndexedDB của điện thoại (kèm ảnh phiếu đã nắn phẳng để đối chiếu), xuất được
**CSV**, **Excel (.xlsx)** và **JSON**.

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

Chọn ảnh có sẵn để thử nhanh:

```bash
python3 tools/make_fixtures.py --count 3
# rồi mở web, chọn web/tests/fixtures/sheet-0.pgm  (trình duyệt không đọc PGM;
# muốn thử bằng ảnh thì chụp phiếu thật, hoặc convert: python3 -c "from PIL import Image; Image.open('sheet-0.pgm').save('sheet-0.png')")
```

## Trạng thái

- Đã có: dò dấu góc, nắn phối cảnh, đọc 220 ô trả lời, đánh dấu ô mờ/tô nhiều.
- Đã có: quét tự động bằng camera gắn cố định, lưu IndexedDB, ảnh phiếu 900 px, phát hiện trùng
  mã sinh viên, xuất CSV / Excel / JSON.
- Đo trên 30 ảnh giả lập: 0 đáp án sai, 1 phiếu bị từ chối vì fit xấu.
- Chưa có: sửa tay trong app, nhập đáp án và tính điểm, PWA offline.
  Xem [docs/06-roadmap.md](docs/06-roadmap.md).

## Điều kiện để chấm đúng

1. In đúng **100% scale**, cùng một máy in cho cả 500 phiếu. In "fit to page" là lệch template.
2. Điện thoại **song song mặt phiếu**, cách 30–40 cm, đủ sáng, không bóng tay.
   Giá đỡ 50–100k (hoặc chặn sách) là đủ — xem [docs/05-operations.md](docs/05-operations.md).
   Quét tự động bắt buộc điện thoại phải cố định."
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
