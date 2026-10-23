# Roadmap

Mỗi mốc có tiêu chí nghiệm thu đo được. Đừng làm mốc sau khi mốc trước chưa đạt.

## M0 — Nền tảng ✅ (2026-10-23)

Template từ phiếu thật, dò dấu góc, nắn phối cảnh, đọc 220 ô, cờ ô mờ/tô nhiều, CSV, giao diện
một màn hình.

Nghiệm thu đã đạt: 30 ảnh giả lập, 1560 đơn vị trả lời, 0 sai, 1 phiếu từ chối (3%), 38 ms/phiếu.

## M1 — Đo trên phiếu thật 🔴 việc tiếp theo

Chụp 50 phiếu thật (đã tô, có đáp án chấm tay), chạy app, so từng ô.

Cần:
- 50 phiếu + bảng đáp án tay.
- Ghi lại: số phiếu bị từ chối, số ô sai, số cờ, thời gian/phiếu, model điện thoại, điều kiện sáng.

Tiêu chí: **0 ô sai trên phiếu được nhận**, từ chối <5%, cờ <20%, <12 s/phiếu.
Nếu sai: dừng, chỉnh `classify()` theo dữ liệu thật, đo lại. Không chỉnh mù.

Đây là mốc duy nhất chặn việc dùng thật. Mọi con số hiện tại đến từ ảnh giả lập.

## M2 — Sửa tay trong app

Hiện cờ chỉ hiện ra, muốn sửa phải mở Excel. Với 10–20% phiếu có cờ thì đó là 50–100 dòng sửa
tay ngoài app, dễ sai.

Cần:
- Bấm vào một dòng → hiện ảnh đã nắn (thu nhỏ) cạnh danh sách đáp án.
- Sửa từng ô, lưu vào `SheetRecord`, đánh dấu `reviewed`.
- Chỉ những phiếu có cờ mới cần xem.

Tiêu chí: sửa xong một phiếu có 3 cờ trong <30 giây, không cần Excel.

Phụ thuộc: phải lưu được ảnh (M4) hoặc nắn lại từ ảnh gốc.

## M3 — Nắn theo từng khối

Hiện dùng một homography cho cả trang. Phiếu bị cong (gáy vở, mép bàn) sẽ lệch dần về phía xa.
19 dấu nhỏ đã có sẵn ở mỗi vùng — dùng chúng làm mốc cục bộ.

Cần: với mỗi khối, chọn 2–3 dấu gần nhất, fit lại phép biến đổi riêng cho khối đó.

Tiêu chí: ảnh chụp phiếu hơi cong (đặt trên mặt phẳng mềm) vẫn 0 sai. Chỉ làm khi M1 cho thấy
đây là nguyên nhân sai thật.

## M4 — Lưu ảnh gốc + chống trùng

- Lưu ảnh đã thu nhỏ (~150 KB/phiếu, 500 phiếu ≈ 75 MB) trong IndexedDB, không phải localStorage.
- Cảnh báo khi mã sinh viên đã có trong danh sách (chụp trùng).
- Xoá ảnh theo lô sau khi hết khiếu nại.

Tiêu chí: khiếu nại một phiếu bất kỳ, mở được ảnh trong <2 giây.

## M5 — Đáp án + tính điểm

- Nhập đáp án một lần cho mỗi mã đề.
- Tính điểm theo thang cấu hình được (PHẦN I: mỗi câu đúng; PHẦN II: số ý đúng → điểm, theo
  thang 0.1/0.25/0.5/1.0 hoặc thang riêng của trường).
- Xuất thêm cột điểm và bảng phổ điểm.

Chưa làm vì chưa biết thang điểm của môn này. Đừng đoán — hỏi người ra đề.

## M6 — Nhiều điện thoại / PWA offline

- Manifest + service worker để cài ra màn hình chính và chạy khi mất mạng.
- Nếu cần gộp nhiều điện thoại: một server nhỏ (FastAPI + SQLite, chạy trên laptop trong LAN)
  nhận `SheetRecord`. Không cần cho 500 phiếu một người.

## Không làm

Chấm tự luận, OCR chữ viết tay, nhận dạng phách, chống gian lận, dashboard, phân quyền,
mobile app native, OpenCV.js, học sâu.
