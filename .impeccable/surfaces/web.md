---
version: 1
slug: "web"
primary_target: "web"
related_targets: []
---

# web — chấm phiếu

Scope: toàn bộ app một trang (`web/index.html`, `web/src/styles.css`, markup trong `web/src/main.ts`).
Visitor mode: **Operate**.

## Audience và việc phải làm

Giáo viên đứng cạnh bàn, điện thoại treo trên giá, tay nhấc phiếu. Việc duy nhất trên màn hình này:
biết ngay phiếu vừa đặt đã được nhận hay chưa, và còn bao nhiêu phiếu. Xuất file và xem lại danh
sách là việc của cuối buổi, không phải việc đang làm.

## Direction đã chọn

Máy đo, không phải trang web. Trạng thái đọc chiếm cả màn hình: một dải màu chạy hết bề ngang và
viền màn hình đổi theo trạng thái, đọc được từ một mét. Số phiếu đã nhận là số duy nhất to trên
màn hình, chữ số đều cột. Không có tiêu đề lớn, không có thẻ (card) nào — dữ liệu là hàng có đường
kẻ 1 px.

Điểm nhớ: màn hình **đổi màu cả khung** khi nhận phiếu, kèm một nhịp đếm của con số.

Phụ: hai theme sáng/tối, người dùng tự chọn, mặc định theo hệ thống. Nền tối không dùng đen tuyệt đối.

## Chưa quyết

- Có nên ẩn danh sách phiếu sau một nút "Xem lại" thay vì cuộn xuống dưới? (hiện để dưới, cuộn.)
- Chưa có phiếu thật để đo độ tương phản của ảnh camera trên nền tối.

## Direction contract

THESIS: Điện thoại là một máy đo đang chạy, không phải một trang web có form. Trạng thái đọc sở hữu
toàn màn hình; mọi thứ khác rút về một đường ray mảnh. Từ chối cách xếp "tiêu đề → banner → danh
sách thẻ" nơi trạng thái chỉ là một khối ngang hàng với các khối khác.

OWN-WORLD: Nền trung tính lệch lục-xám, mực gần đen pha lục, một màu bão hoà cho mỗi trạng thái
(nhận: lục, từ chối: đỏ) tràn viền và dải; đường kẻ 1 px; số kiểu tabular; bo góc 14 px cho nút,
0 cho hàng dữ liệu; chữ hệ thống, không tải font ngoài (app phải chạy khi không có mạng).

STORY: Người chấm liếc một cái, thấy "ĐÃ NHẬN", nhấc phiếu, đặt phiếu tiếp. Không đọc chữ nào khác.

FIRST VIEWPORT: (390×844) ray trên 56 px: tên app bên trái, `47 phiếu` bên phải, nút theme 40 px;
khung camera chiếm phần còn lại, viền trong 3 px mang màu trạng thái; dải trạng thái 92 px ngay dưới
khung, chữ 26 px đậm, nền chuyển theo trạng thái; dưới là hai nút 52 px (Quét tự động / Chụp thủ
công); cuối là một hàng chữ nhỏ 40 px cho CSV · Excel · JSON · Xoá. Danh sách nằm dưới màn hình đầu.

FORM: code-led (Operate), tham chiếu là mặt máy đo công nghiệp; không comp, không phương án hình ảnh.
SEED REFERENCE: seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
