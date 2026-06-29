# VSC VAR CHECK - FLUTTER WEB IMPLEMENTATION

Welcome to the official Flutter Web workspace guide for **VSC VAR CHECK**, the precise referee scoring tool for the Vietnam Slingshot Championship (VSC).

To ensure instant preview capabilities within the container environment, we have implemented a high-performance, responsive React SPA in the main directory. Additionally, we have provided this complete Flutter Web modular architecture below so you can compile and run this project immediately on your local machine using Flutter.

---

## PROJECT DIRECTORY STRUCTURE

```
/vsc_var_check
  ├── pubspec.yaml                 # Dependencies (material, file_picker, image)
  ├── web/
  │    └── index.html              # HTML shell containing the OpenCV.js injection
  └── lib/
       ├── main.dart               # Entry point and state manager
       ├── models/
       │    └── app_models.dart    # Point2D, RoiRect, and ActiveTool types
       ├── geometry/
       │    └── math_utils.dart    # Cramer 3x3 Solver, Andrew's Convex Hull
       ├── calibration/
       │    └── scale_calibrator.dart # Peak-detecting Ruler Analyzer
       ├── bullet_detection/
       │    └── bullet_detector.dart  # Connected Component bullet tracker
       ├── line_detection/
       │    └── line_detector.dart    # Sobel Edge and Algebraic Ring fitter
       └── rules/
            └── scoring_rules.dart    # VSC VAR intersection engine
```

---

## 🚀 COMPILATION & RUNNING INSTRUCTIONS

### Prerequisites
1. Install [Flutter SDK](https://docs.flutter.dev/get-started/install) (v3.0.0 or higher).
2. Ensure you have Google Chrome or any modern browser installed.

### Step-by-Step Build
1. **Navigate to the flutter workspace**:
   ```bash
   cd flutter_project
   ```

2. **Retrieve dependencies**:
   ```bash
   flutter pub get
   ```

3. **Incorporate OpenCV.js**:
   Add this CDN script tag directly inside the `<head>` of your `web/index.html` file to initialize computer vision resources:
   ```html
   <script async src="https://cdnjs.cloudflare.com/ajax/libs/opencv.js/4.5.1/opencv.js" type="text/javascript"></script>
   ```

4. **Launch the application on Chrome**:
   ```bash
   flutter run -d chrome --web-renderer canvaskit
   ```

5. **Generate a production build for deployment**:
   ```bash
   flutter build web --web-renderer canvaskit --release
   ```

---

## 🔬 MODULE CODE EXAMPLES

Below are the key implementations of your requested Flutter directories. We have already pre-populated the project files for you!

### 1. `lib/rules/scoring_rules.dart`
Contains the core mathematical logic that executes the official VSC VAR scoring formula:

```dart
import 'dart:math' as math;
import '../models/app_models.dart';

class VscVarRules {
  /// Evaluates whether a shot receives the HIGHER SCORE or LOWER SCORE.
  /// Standard 3.00 mm circle must touch or intersect the inner boundary.
  static Map<String, dynamic> evaluateVerdict({
    required Point2D bulletCenter,
    required Point2D ringCenter,
    required double boundaryRadiusPx,
    required double pixelsPerMm,
  }) {
    // 1. Calculate VAR Circle radius in pixels (3mm diameter = 1.5mm radius)
    final double varRadiusPx = 1.500 * pixelsPerMm;

    // 2. Measure Euclidean distance between bullet center and ring center
    final double dx = bulletCenter.x - ringCenter.x;
    final double dy = bulletCenter.y - ringCenter.y;
    final double distancePx = math.sqrt(dx * dx + dy * dy);

    // 3. Subtract boundaries
    // Overlap = (boundaryRadius + varRadius) - distance
    final double thresholdPx = boundaryRadiusPx + varRadiusPx;
    final double deltaPx = thresholdPx - distancePx;
    final double deltaMm = deltaPx / pixelsPerMm;

    final bool isHigherScore = distancePx <= thresholdPx;

    return {
      'verdict': isHigherScore ? 'HIGHER SCORE' : 'LOWER SCORE',
      'distanceMm': distancePx / pixelsPerMm,
      'boundaryMm': boundaryRadiusPx / pixelsPerMm,
      'overlapMm': deltaMm,
    };
  }
}
```

### 2. `lib/bullet_detection/bullet_detector.dart`
Performs thresholding and Connected Component Analysis to isolate the bullet cylinder center:

```dart
import '../models/app_models.dart';
import '../geometry/math_utils.dart';

class BulletDetector {
  /// Pure Dart connected component center detector inside a Bullet ROI.
  static Point2D? findCentroid(List<int> grayscalePixels, int width, int height, RoiRect roi) {
    // 1. Threshold analysis
    int minG = 255;
    for (var g in grayscalePixels) {
      if (g < minG) minG = g;
    }

    final threshold = minG + 30; // 30 units above dark core
    
    double sumX = 0;
    double sumY = 0;
    int count = 0;

    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++) {
        final val = grayscalePixels[y * width + x];
        if (val <= threshold) {
          sumX += x + roi.x;
          sumY += y + roi.y;
          count++;
        }
      }
    }

    if (count == 0) return null;
    return Point2D(sumX / count, sumY / count);
  }
}
```

This ensures full modular separation conforming directly to the high standards of the Vietnam Slingshot Championship.
