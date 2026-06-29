import 'dart:math' as math;
import '../models/app_models.dart';

class MathUtils {
  /// Checks whether two points on a 2D plane are within a given distance.
  static bool areIntersecting(Point2D p1, Point2D p2, double threshold) {
    final dx = p1.x - p2.x;
    final dy = p1.y - p2.y;
    final distance = math.sqrt(dx * dx + dy * dy);
    return distance <= threshold;
  }

  /// Calculates Andrew's Monotone Chain Convex Hull algorithm on 2D points.
  static List<Point2D> computeConvexHull(List<Point2D> points) {
    if (points.length <= 1) return points;

    // Sort points lexicographically by x, then y
    final sorted = List<Point2D>.from(points)
      ..sort((a, b) => a.x != b.x ? a.x.compareTo(b.x) : a.y.compareTo(b.y));

    final lower = <Point2D>[];
    for (final p in sorted) {
      while (lower.length >= 2 &&
          _crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.removeLast();
      }
      lower.add(p);
    }

    final upper = <Point2D>[];
    for (var i = sorted.length - 1; i >= 0; i--) {
      final p = sorted[i];
      while (upper.length >= 2 &&
          _crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.removeLast();
      }
      upper.add(p);
    }

    upper.removeLast();
    lower.removeLast();
    return lower + upper;
  }

  static double _crossProduct(Point2D o, Point2D a, Point2D b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  /// Cramer's Least-Squares circle fitting for printed circular target rings.
  /// Solves: x^2 + y^2 + B*x + C*y + D = 0
  static Map<String, dynamic>? fitCircleAlgebraic(List<Point2D> points) {
    final n = points.length;
    if (n < 3) return null;

    double sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
    double sumXXX = 0, sumYYY = 0, sumXYY = 0, sumXXY = 0;

    for (final p in points) {
      sumX += p.x;
      sumY += p.y;
      sumXX += p.x * p.x;
      sumYY += p.y * p.y;
      sumXY += p.x * p.y;
      sumXXX += p.x * p.x * p.x;
      sumYYY += p.y * p.y * p.y;
      sumXYY += p.x * p.y * p.y;
      sumXXY += p.x * p.x * p.y;
    }

    final a11 = sumXX, a12 = sumXY, a13 = sumX;
    final a21 = sumXY, a22 = sumYY, a23 = sumY;
    final a31 = sumX,  a32 = sumY,  a33 = n.toDouble();

    final b1 = -(sumXXX + sumXYY);
    final b2 = -(sumXXY + sumYYY);
    final b3 = -(sumXX + sumYY);

    // Solve 3x3 system using determinants (Cramer's Rule)
    final det = a11 * (a22 * a33 - a23 * a32) -
        a12 * (a21 * a33 - a23 * a31) +
        a13 * (a21 * a32 - a22 * a31);

    if (det.abs() < 1e-5) return null;

    final detB = b1 * (a22 * a33 - a23 * a32) -
        a12 * (b2 * a33 - a23 * b3) +
        a13 * (b2 * a32 - a22 * b3);

    final detC = a11 * (b2 * a33 - a23 * b3) -
        b1 * (a21 * a33 - a23 * a31) +
        a13 * (a21 * b3 - b2 * a31);

    final detD = a11 * (a22 * b3 - b2 * a32) -
        a12 * (a21 * b3 - b2 * a31) +
        b1 * (a21 * a32 - a22 * a31);

    final B = detB / det;
    final C = detC / det;
    final D = detD / det;

    final cx = -B / 2;
    final cy = -C / 2;
    final rSquare = (B * B + C * C) / 4 - D;

    if (rSquare <= 0) return null;

    final radius = math.sqrt(rSquare);
    return {'center': Point2D(cx, cy), 'radius': radius};
  }
}
