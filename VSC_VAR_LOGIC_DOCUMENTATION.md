# TÀI LIỆU TOÀN BỘ LOGIC HỆ THỐNG VSC VAR SCORE ENGINE

Hồ sơ đóng băng logic của hệ thống **Vietnam Slingshot Championship (VSC) Video Assistant Referee (VAR)**. Tài liệu này lưu trữ và bảo toàn các công thức hình học, thuật toán thị giác máy tính thuần (Pure JS/TS fallback) và quy trình chấm điểm chính xác cao để giải quyết tranh chấp trong các giải đấu Slingshot chuyên nghiệp tại Việt Nam.

---

## 1. QUY TẮC PHÂN TÍCH TRỌNG TÀI VSC (VSC VAR SCORING RULES)

Theo luật thi đấu chính thức của VSC:
- **Bia tiêu chuẩn**: Vòng điểm 10 (mười) thường có đường kính trong và ngoài được xác định (ví dụ vòng tâm 10 có kích thước vật lý cụ thể, ranh giới ngoài là 15.4mm).
- **Quy tắc VAR 3mm**: Sử dụng một vòng tròn hỗ trợ ảo có bán kính vật lý đúng bằng **1.5mm** (đường kính **3.0mm**) đặt tại tâm lỗ đạn.
- **Xác định Chạm Vạch (Touch Ring)**: 
  - Nếu khoảng cách từ tâm lỗ đạn đến tâm vòng điểm nhỏ hơn hoặc bằng tổng bán kính vòng điểm cộng với bán kính vòng tròn VAR ($1.5\text{ mm}$), đạn được coi là **chạm vạch** và ăn điểm của vòng đó.
  - Về mặt hình học: $d(\text{Bullet}, \text{Ring}) \le R_{\text{ring}} + 1.5\text{ mm}$.
  - Nếu có sự rách giấy (torn paper), trọng tài sử dụng công cụ **Đường cong 3 điểm (Spline Curve Finder)** để khôi phục ranh giới thực tế của vòng điểm bị biến dạng, sau đó tính khoảng cách vuông góc ngắn nhất từ tâm lỗ đạn tới đường cong.

---

## 2. HỆ THỐNG ĐỊNH CỠ TỶ LỆ VẬT LÝ (CALIBRATION ENGINE)

Định cỡ tỷ lệ chuyển đổi từ pixel sang milimét ($\text{pixels per millimeter - PPM}$) là cốt lõi của tính chính xác. Hệ thống hỗ trợ hai phương pháp:

### 2.1. Thước Caliper Tuyến Tính (Linear Caliper Span)
Sử dụng hai điểm neo $A(x_a, y_a)$ và $B(x_b, y_b)$ đặt cách nhau một khoảng cách vật lý xác định $L_{\text{mm}}$ (mặc định là $10\text{ mm}$):
$$PPM = \frac{\sqrt{(x_b - x_a)^2 + (y_b - y_a)^2}}{L_{\text{mm}}}$$

### 2.2. Vòng tròn Định cỡ Tiêu chuẩn (Standard Calibration Circle)
Sử dụng một vòng tròn định cỡ vật lý có bán kính thực tế đúng bằng $1.5\text{ mm}$ (đường kính $3.0\text{ mm}$). Khi người dùng điều chỉnh vòng tròn định cỡ khớp với vạch chia trên thước hoặc vòng tròn tham chiếu trên bia:
$$PPM = \frac{R_{\text{pixels}}}{1.5\text{ mm}}$$

---

## 3. THUẬT TOÁN THỊ GIÁC MÁY TÍNH THUẦN (PURE JS COMPUTER VISION ENGINE)

Hệ thống tích hợp bộ xử lý ảnh thuần bằng JavaScript (`cv_engine.ts`) hoạt động không phụ thuộc thư viện ngoài để tránh lỗi bảo mật hoặc bất tương thích môi trường di động:

### 3.1. Tìm Tâm Lỗ Đạn Tự Động (Auto Bullet Center Detection)
1. **Phân vùng Ảnh (ROI Extraction)**: Trích xuất ma trận pixel từ vùng được vẽ ($ROI$).
2. **Ngưỡng hóa thích nghi (Adaptive Thresholding)**: Tính toán mức xám trung bình của vùng để phân tách lõi lỗ đạn tối màu với giấy nền sáng màu:
   $$Gray(r, g, b) = 0.299R + 0.587G + 0.114B$$
3. **Phân tích nhãn liên thông (Connected Component Centroid)**:
   Quét các pixel tối màu ($Gray < \text{Threshold}$) để tìm cụm điểm loang lớn nhất đại diện cho lỗ đạn.
4. **Công thức tính trọng tâm (Centroid Equations)**:
   $$X_{\text{center}} = \frac{\sum_{i=1}^{N} x_i}{N}, \quad Y_{\text{center}} = \frac{\sum_{i=1}^{N} y_i}{N}$$

### 3.2. Thuật toán Đa giác Thủ công (Manual Polygon Centroid)
Khi lỗ đạn bị rách nghiêm trọng, trọng tài nhấp thủ công $N$ điểm quanh viền lỗ đạn. Hệ thống tự động sắp xếp các điểm theo thứ tự góc quay quanh tâm ước lượng (Angular Sorting) và tính trọng tâm đa giác không tự cắt:
- **Diện tích đa giác có dấu (Signed Area $A$)**:
  $$A = \frac{1}{2} \sum_{i=0}^{N-1} (x_i y_{i+1} - x_{i+1} y_i)$$
- **Tọa độ tâm hình học (Centroid $C_x, C_y$)**:
  $$C_x = \frac{1}{6A} \sum_{i=0}^{N-1} (x_i + x_{i+1})(x_i y_{i+1} - x_{i+1} y_i)$$
  $$C_y = \frac{1}{6A} \sum_{i=0}^{N-1} (y_i + y_{i+1})(x_i y_{i+1} - x_{i+1} y_i)$$

---

## 4. KHÔI PHỤC RANH GIỚI ĐƯỜNG CONG 3 ĐIỂM (SPLINE CURVE FITTER)

Đối với các trường hợp vạch bia bị rách rách hoặc biến dạng, thuật toán khôi phục đường cong nội suy spline bậc hai (Quadratic Bezier Spline) được áp dụng qua 3 điểm kiểm soát $P_1$ (Bắt đầu), $P_2$ (Uốn cong), $P_3$ (Kết thúc):

### 4.1. Công thức Đường cong Bezier
Cho tham số $t \in [0, 1]$:
$$B(t) = (1-t)^2 P_1 + 2(1-t)t P_2 + t^2 P_3$$

Hệ thống chia nhỏ $t$ thành $M$ phân đoạn (mặc định $M = 100$) để tạo ra một tập hợp các điểm rời rạc cực mịn trên đường cong phục vụ tính toán khoảng cách.

### 4.2. Tìm Khoảng Cách Ngắn Nhất Từ Tâm Đạn Đến Đường Cong
Khoảng cách từ tâm đạn $C$ đến đường cong $B(t)$ là giá trị nhỏ nhất:
$$d_{\text{min}} = \min_{t \in [0, 1]} \sqrt{(C_x - B_x(t))^2 + (C_y - B_y(t))^2}$$

Giá trị vật lý thực tế:
$$d_{\text{physical}} = \frac{d_{\text{min}}}{PPM}$$

---

## 5. QUY TRÌNH QUYẾT ĐỊNH KẾT QUẢ VAR (DECISION MATRIX)

```
                       [ BẮT ĐẦU PHÂN TÍCH ]
                                 |
                     [ 1. ĐỊNH CỠ TỶ LỆ (PPM) ]
                     Khớp vòng định cỡ 1.5mm
                                 |
                     [ 2. XÁC ĐỊNH TÂM ĐẠN ]
                  (Tự động hoặc chấm đa giác)
                                 |
             +-------------------+-------------------+
             |                                       |
     [ KIỂU VÒNG ĐIỂM ]                      [ KIỂU ĐƯỜNG CONG ]
    (Dùng vòng tròn chuẩn)                (Dùng cho bia rách/mờ)
             |                                       |
      Xác định tâm Ring C                     Nội suy đường cong
     và Bán kính ngoài R_px                 spline Bezier bậc 2
             |                                       |
    Khoảng cách d = ||C_đạn - C||           Khoảng cách d = min(||C_đạn - P_i||)
             |                                       |
             +-------------------+-------------------+
                                 |
                     Khoảng cách vật lý (mm)
                       d_mm = d_px / PPM
                                 |
                     [ 3. PHÁN QUYẾT VAR ]
                                 |
         +-----------------------+-----------------------+
         |                                               |
  d_mm <= R_ring + 1.5mm                          d_mm > R_ring + 1.5mm
         |                                               |
  [ KHẲNG ĐỊNH: CHẠM VẠCH ]                       [ KHẲNG ĐỊNH: KHÔNG CHẠM ]
     (ĂN ĐIỂM - TOUCH)                               (TRƯỢT ĐIỂM - MISS)
```

---

## 6. ĐỒNG BỘ GIAO DIỆN VÀ TRẢI NGHIỆM DI ĐỘNG (MOBILE WEB COMPATIBILITY)

Giao diện tương tác (`WorkspaceCanvas.tsx`) hỗ trợ tối đa các thao tác cảm ứng trên thiết bị di động thông qua xử lý sự kiện Touch:
- **Chạm đơn (Single Touch)**: Thay thế hoàn toàn chuột để kéo thả các điểm neo của thước Caliper, di chuyển tâm vòng tròn, dịch chuyển tâm lỗ đạn, định vị đa giác hoặc uốn nắn đường cong spline. Khi chạm giữ và di chuyển điểm ở THƯỚC định cỡ và VÒNG ranh giới ngoài, kính lúp (Loupe) phóng đại 3x sẽ xuất hiện trực quan ngay trên ngón tay để trọng tài căn chỉnh chính xác từng pixel.
- **Chạm kép (Double Touch / Pinch to Zoom)**: Tính toán khoảng cách thay đổi giữa hai ngón tay để thực hiện thu phóng (Zoom) và di chuyển (Pan) mượt mà xung quanh ảnh nền nhờ thuộc tính `touch-none`.

---

## 7. CẤU TRÚC MOBILE NATIVE APP & QUY TRÌNH TẠO FILE APK

Để đáp ứng nhu cầu sử dụng thực địa không cần internet, hệ thống đã được tích hợp bộ khung **Capacitor Mobile Native** chính thức, cho phép đóng gói toàn bộ giao diện web SPA React thành một ứng dụng Android chạy offline hoàn toàn độc lập, có hiệu năng kết xuất đồ họa cực cao qua Android WebView.

### 7.1. Cấu trúc Thư mục Android App (`/android`)
Thư mục `/android` ở thư mục gốc của dự án là một dự án **Android Studio / Gradle** hoàn chỉnh và tiêu chuẩn:
- `android/app/src/main/assets/public`: Chứa toàn bộ mã nguồn HTML/JS/CSS đã biên dịch tối ưu (production-ready) của ứng dụng React.
- `android/app/src/main/java`: Chứa mã nguồn khởi tạo nền tảng Android và cầu nối Capacitor Bridge để quản lý WebView.
- `android/app/src/main/AndroidManifest.xml`: Định nghĩa cấu hình ứng dụng, quyền truy cập camera/bộ nhớ và chế độ hiển thị xoay màn hình (orientation).
- `android/gradlew` & `android/build.gradle`: Các tập lệnh Gradle tự động tải dependencies và lắp ráp file APK.

### 7.2. Hướng dẫn Biên dịch APK bằng Android Studio (Từng Bước Chi Tiết)
Người dùng có thể xuất mã nguồn thành file ZIP từ menu Settings của AI Studio, giải nén và thực hiện các bước sau để tạo ứng dụng Android (.APK):

1. **Cài đặt Môi trường**:
   - Tải và cài đặt [Android Studio](https://developer.android.com/studio) bản mới nhất.
   - Đảm bảo đã cài đặt Android SDK và máy ảo/thiết bị thật để test.

2. **Mở Dự án trong Android Studio**:
   - Khởi động Android Studio, chọn **Open** (Mở dự án).
   - Duyệt đến thư mục dự án vừa giải nén, chọn thư mục con `/android` rồi nhấn **OK**.
   - Android Studio sẽ tự động nhận diện dự án Gradle và tiến hành đồng bộ hóa (Gradle Sync) các tài nguyên trong vài phút.

3. **Đồng bộ hóa Mã nguồn mới nhất (Nếu có thay đổi web)**:
   - Nếu bạn tự chỉnh sửa thêm giao diện web ở thư mục gốc, chỉ cần chạy lệnh sau trên máy tính để cập nhật mã nguồn vào thư mục Android:
     ```bash
     npx cap sync
     ```

4. **Biên dịch File APK để Cài đặt**:
   - Trên thanh menu của Android Studio, chọn **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
   - Android Studio sẽ chạy tập lệnh biên dịch. Khi hoàn thành, một thông báo pop-up sẽ xuất hiện ở góc dưới bên phải.
   - Nhấp vào chữ **locate** trong thông báo đó để mở thư mục chứa file APK đã hoàn chỉnh (thường nằm tại `android/app/build/outputs/apk/debug/app-debug.apk`).
   - Copy file `.apk` này vào điện thoại Android của bạn để cài đặt và sử dụng ngay lập tức!

5. **Tạo Bản phát hành Ký số (Release APK / AAB)**:
   - Chọn **Build** -> **Generate Signed Bundle / APK...** để tạo file APK đã ký số, sẵn sàng đưa lên cửa hàng ứng dụng Google Play Store.

---
*Tài liệu đóng băng logic chính thức của VSC VAR Scoring System - Bảo lưu mọi quyền hình học.*
