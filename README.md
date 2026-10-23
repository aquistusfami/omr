# Chấm phiếu trắc nghiệm bằng điện thoại

Chấm phiếu trả lời trắc nghiệm in sẵn từ ảnh chụp điện thoại. Không cần máy scan, không cần
thiết bị chuyên dụng, không cần mạng, không cần cài app: mở trang web bằng điện thoại, chụp
từng phiếu, đọc kết quả ngay, xuất CSV.

Dùng cho phiếu 15 câu hiện có (`fixtures/blank-form.png`): 240 ô tô, 9 chữ số mã sinh viên,
3 chữ số mã đề, PHẦN I 10 câu A–D, PHẦN II 5 câu × 6 ý Đúng/Sai.

## Chạy thử

```bash
cd web
npm install
npm run dev          # in ra địa chỉ LAN, mở bằng điện thoại
```

Chọn ảnh có sẵn để thử nhanh:

```bash
python3 tools/make_fixtures.py --count 3
# rồi mở web, chọn web/tests/fixtures/sheet-0.pgm  (trình duyệt không đọc PGM;
# muốn thử bằng ảnh thì chụp phiếu thật, hoặc convert: python3 -c "from PIL import Image; Image.open('sheet-0.pgm').save('sheet-0.png')")
```

## Trạng thái

- Đã có: dò dấu góc, nắn phối cảnh, đọc 220 ô trả lời, đánh dấu ô mờ/tô nhiều, xuất CSV.
- Đo trên 30 ảnh giả lập: 0 đáp án sai, 1 phiếu bị từ chối vì fit xấu.
- Chưa có: sửa tay trong app, nhập đáp án và tính điểm, lưu ảnh gốc, chống trùng phiếu.
  Xem [docs/06-roadmap.md](docs/06-roadmap.md).

## Điều kiện để chấm đúng

1. In đúng **100% scale**, cùng một máy in cho cả 500 phiếu. In "fit to page" là lệch template.
2. Điện thoại **song song mặt phiếu**, cách 30–40 cm, đủ sáng, không bóng tay.
   Giá đỡ 50–100k (hoặc chặn sách) là đủ — xem [docs/05-operations.md](docs/05-operations.md).
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
