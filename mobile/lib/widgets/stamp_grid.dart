import 'package:flutter/material.dart';

/// Mirrors the web StampGrid: filled slots show a check, empty slots show their
/// number, and the last slot is the reward (gift). Parametric on surface colours
/// so it reads on both the dark brand cards and the light detail page.
///
/// - filled circle  = [foreground], its glyph = [background]
/// - empty circle   = outlined in [foreground], number in [foreground]
/// - reward reached = [accent] circle with a gift glyph
class StampGrid extends StatelessWidget {
  const StampGrid({
    super.key,
    required this.filled,
    required this.total,
    required this.accent,
    required this.foreground,
    required this.background,
    this.popIndex,
    this.maxCell = 46,
    this.spacing = 10,
  });

  final int filled;
  final int total;
  final Color accent;
  final Color foreground;
  final Color background;

  /// Index of a freshly earned stamp: that cell plays a springy pop-in.
  final int? popIndex;
  final double maxCell;
  final double spacing;

  int get _cols => total > 10
      ? 5
      : total > 5
          ? (total / 2).ceil()
          : total;

  @override
  Widget build(BuildContext context) {
    final cols = _cols < 1 ? 1 : _cols;
    return LayoutBuilder(
      builder: (context, constraints) {
        final avail = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : maxCell * cols + spacing * (cols - 1);
        var cell = (avail - spacing * (cols - 1)) / cols;
        if (cell > maxCell) cell = maxCell;
        if (cell < 16) cell = 16;

        final rows = <Widget>[];
        for (var r = 0; r * cols < total; r++) {
          final cells = <Widget>[];
          for (var ci = 0; ci < cols; ci++) {
            final i = r * cols + ci;
            if (i >= total) break;
            if (ci > 0) cells.add(SizedBox(width: spacing));
            cells.add(_Cell(
              index: i,
              total: total,
              filled: filled,
              size: cell,
              accent: accent,
              foreground: foreground,
              background: background,
              pop: i == popIndex,
            ));
          }
          if (r > 0) rows.add(SizedBox(height: spacing));
          rows.add(Row(mainAxisSize: MainAxisSize.min, children: cells));
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: rows,
        );
      },
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.index,
    required this.total,
    required this.filled,
    required this.size,
    required this.accent,
    required this.foreground,
    required this.background,
    this.pop = false,
  });

  final int index;
  final int total;
  final int filled;
  final double size;
  final Color accent;
  final Color foreground;
  final Color background;
  final bool pop;

  @override
  Widget build(BuildContext context) {
    final isReward = index == total - 1;
    final isFilled = index < filled;
    final isRewardReached = isReward && filled >= total;

    Color circle;
    Color content;
    Border? border;

    if (isRewardReached) {
      circle = accent;
      content = background;
    } else if (isFilled) {
      circle = foreground;
      content = background;
    } else {
      circle = Colors.transparent;
      content = foreground.withValues(alpha: 0.5);
      border = Border.all(color: foreground.withValues(alpha: 0.28));
    }

    Widget child;
    if (isReward) {
      child = Icon(
        Icons.card_giftcard,
        size: size * 0.5,
        color: isRewardReached ? content : foreground.withValues(alpha: 0.5),
      );
    } else if (isFilled) {
      child = Icon(Icons.check, size: size * 0.56, color: content);
    } else {
      child = Text(
        '${index + 1}',
        style: TextStyle(
          fontSize: size * 0.34,
          fontWeight: FontWeight.w600,
          color: content,
        ),
      );
    }

    final cell = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: circle,
        shape: BoxShape.circle,
        border: border,
      ),
      child: child,
    );

    if (!pop) return cell;
    // Springy pop-in for the stamp that was just earned (NFC tap).
    return TweenAnimationBuilder<double>(
      key: ValueKey('pop-$index-$filled'),
      tween: Tween(begin: 0.2, end: 1),
      duration: const Duration(milliseconds: 650),
      curve: Curves.elasticOut,
      builder: (_, scale, c) => Transform.scale(scale: scale, child: c),
      child: cell,
    );
  }
}
