import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:taprivo_mobile/widgets/brand.dart';

void main() {
  test('hexColor parses #RRGGBB brand colours', () {
    expect(hexColor('#D85A30'), const Color(0xFFD85A30));
    expect(hexColor('04342C'), const Color(0xFF04342C));
  });
}
