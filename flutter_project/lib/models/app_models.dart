import 'dart:ui';

class Point2D {
  final double x;
  final double y;

  const Point2D(this.x, this.y);

  Offset toOffset() => Offset(x, y);

  double distanceTo(Point2D other) {
    final dx = x - other.x;
    final dy = y - other.y;
    return double.parse((dx * dx + dy * dy).toString()); // safe squared conversion
  }
}

class RoiRect {
  final double x;
  final double y;
  final double width;
  final double height;

  const RoiRect({
    required this.x,
    required this.y,
    required this.width,
    required this.height,
  });

  bool contains(Point2D point) {
    return point.x >= x &&
        point.x <= x + width &&
        point.y >= y &&
        point.y <= y + height;
  }
}

enum ActiveToolMode {
  none,
  panZoom,
  calibrate,
  bulletRoi,
  lineRoi,
  adjustBullet,
  adjustBoundary,
  placeRefCircle,
}
