# Roadmap

Mỗi mốc có tiêu chí nghiệm thu đo được. Đừng làm mốc sau khi mốc trước chưa đạt.
Ký hiệu: ✅ xong · 🟡 một phần · 🟠 code xong, chưa kiểm chứng trên thiết bị thật · 🔴 đang làm · ⬜ chưa làm.

## M0 — Nền tảng ✅ (2026-10-23)

Template từ phiếu thật, dò dấu góc, nắn phối cảnh, đọc 220 ô, cờ ô mờ/tô nhiều, CSV, giao diện
một màn hình.

Nghiệm thu đã đạt: 30 ảnh giả lập, 1560 đơn vị trả lời, 0 sai, 1 phiếu từ chối (3%), 38 ms/phiếu.

## M0+ — Quét tự động, lưu trữ, xuất file 🟠 (2026-10-23)

Làm sau M0 vì yêu cầu vận hành thật (treo điện thoại, quét liên tục, báo cáo Excel):

- **Quét tự động**: camera cố định, máy trạng thái `scan.ts` — nhận sau hai lần đọc khớp nhau,
  chỉ nhận lại khi phiếu đã nhấc ra. Banner lớn + bíp + rung.
- **IndexedDB** thay localStorage: 2 store (`sheets`, `thumbs`), index `studentId`, ghi xong mới
  báo "đã nhận".
- **Ảnh phiếu 900 px** mỗi bản ghi (~60 KB, 500 phiếu ≈ 30 MB) làm bằng chứng đối chiếu.
- **Xuất CSV / XLSX / JSON**; cột `trung` đánh dấu mã SV quét lại.
- **CI** GitHub Actions: tsc, test, build, template `--check`, mở file .xlsx bằng openpyxl.

Kiểm chứng: 11 test (pipeline, máy trạng thái, zip/xlsx), build 25 KB, chạy từng bước CI trên máy.
**Chưa chạy trên điện thoại thật** — không có trình duyệt trên máy phát triển.

## M1 — Đo trên phiếu thật 🔴 việc tiếp theo

Chụp 50 phiếu thật (đã tô, có đáp án chấm tay), chạy app, so từng ô.

Bước 0 (5 phút, trước khi chuẩn bị 50 phiếu): chạy thử trên điện thoại thật — mở https, cấp
quyền camera, đặt 3–5 phiếu, xác nhận bíp + banner xanh và việc nhấc phiếu ra mới nhận tiếp.
Nếu camera không mở được thì dùng "Chụp thủ công" cho M1 và ghi lại model điện thoại.

Cần:
- 50 phiếu + bảng đáp án tay.
- Ghi lại: số phiếu bị từ chối, số ô sai, số cờ, thời gian/phiếu, model điện thoại, điều kiện sáng.

Tiêu chí: **0 ô sai trên phiếu được nhận**, từ chối <5%, cờ <20%, <12 s/phiếu.
Nếu sai: dừng, chỉnh `classify()` theo dữ liệu thật, đo lại. Không chỉnh mù.

Đây là mốc duy nhất chặn việc dùng thật. Mọi con số hiện tại đến từ ảnh giả lập.

## M2 — Sửa tay trong app ⬜

Hiện cờ chỉ hiện ra, muốn sửa phải mở Excel. Với 10–20% phiếu có cờ thì đó là 50–100 dòng sửa
tay ngoài app, dễ sai.

Cần:
- Bấm vào một dòng → hiện ảnh đã nắn (thu nhỏ) cạnh danh sách đáp án.
- Sửa từng ô, lưu vào `SheetRecord`, đánh dấu `reviewed`.
- Chỉ những phiếu có cờ mới cần xem.

Tiêu chí: sửa xong một phiếu có 3 cờ trong <30 giây, không cần Excel.

Phụ thuộc: phải lưu được ảnh (M4) hoặc nắn lại từ ảnh gốc.

## M3 — Nắn theo từng khối ⬜

Hiện dùng một homography cho cả trang. Phiếu bị cong (gáy vở, mép bàn) sẽ lệch dần về phía xa.
19 dấu nhỏ đã có sẵn ở mỗi vùng — dùng chúng làm mốc cục bộ.

Cần: với mỗi khối, chọn 2–3 dấu gần nhất, fit lại phép biến đổi riêng cho khối đó.

Tiêu chí: ảnh chụp phiếu hơi cong (đặt trên mặt phẳng mềm) vẫn 0 sai. Chỉ làm khi M1 cho thấy
đây là nguyên nhân sai thật.

## M4 — Lưu ảnh + chống trùng 🟡 một phần

Đã có: ảnh nắn phẳng 900 px (~60 KB/phiếu, 500 phiếu ≈ 30 MB) trong IndexedDB; index `studentId`
và cột `trung` trong file xuất.

Còn lại:
- Hiện ảnh khi bấm vào một dòng (thuộc M2, chung một UI).
- **Chặn** trùng chứ không chỉ đánh dấu (hỏi lại người chấm: ghi đè hay bỏ qua).
- Xoá ảnh theo lô sau khi hết khiếu nại.

Tiêu chí: khiếu nại một phiếu bất kỳ, mở được ảnh trong <2 giây.

## M5 — Đáp án + tính điểm 🟡 một phần (2026-10-24)

Đã làm:

- Dán đáp án theo mã đề vào mục "Đáp án & điểm" (mỗi dòng 40 ký tự), lưu ở localStorage.
- Hai thang: phần I mỗi câu đúng = trọng số; phần II chia đều 6 ý **hoặc** đúng cả 6 ý mới có điểm.
- Cột `diem`, `dung_p1`, `dung_p2` trong CSV/XLSX; điểm TB trên dòng trạng thái.
- Điểm tính lại từ đáp án mỗi lần xem/xuất, không lưu vào bản ghi.

Còn thiếu: phổ điểm / thống kê theo lớp, và thang điểm lẻ kiểu Bộ (0.1/0.25/0.5/1.0 theo số ý
đúng) — hiện chỉ có chia đều hoặc tất cả. Làm khi có trường cần.

## M6 — Nhiều điện thoại / PWA offline ⬜

- Manifest + service worker để cài ra màn hình chính và chạy khi mất mạng.
- Nếu cần gộp nhiều điện thoại: một server nhỏ (FastAPI + SQLite, chạy trên laptop trong LAN)
  nhận `SheetRecord`. Không cần cho 500 phiếu một người.

## Không làm

Chấm tự luận, OCR chữ viết tay, nhận dạng phách, chống gian lận, dashboard, phân quyền,
mobile app native, OpenCV.js, học sâu.
