/// Reward as returned by `GET /rewards`.
class Reward {
  final String id;
  final String couponCode;
  final bool redeemed;
  final DateTime? redeemedAt;
  final DateTime expiresAt;
  final String merchantId;
  final String merchantName;
  final String rewardDescription;
  final String brandColorBg;
  final String brandAccent;
  final String? logoUrl;

  const Reward({
    required this.id,
    required this.couponCode,
    required this.redeemed,
    required this.redeemedAt,
    required this.expiresAt,
    required this.merchantId,
    required this.merchantName,
    required this.rewardDescription,
    required this.brandColorBg,
    required this.brandAccent,
    required this.logoUrl,
  });

  bool get expired => DateTime.now().isAfter(expiresAt);

  static DateTime? _date(dynamic v) =>
      v == null ? null : DateTime.tryParse('$v');

  factory Reward.fromJson(Map<String, dynamic> json) => Reward(
        id: json['id'] as String,
        couponCode: json['coupon_code'] as String? ?? '',
        redeemed: json['redeemed'] as bool? ?? false,
        redeemedAt: _date(json['redeemed_at']),
        expiresAt: _date(json['expires_at']) ?? DateTime.now(),
        merchantId: json['merchant_id'] as String,
        merchantName: json['merchant_name'] as String? ?? '',
        rewardDescription: json['reward_description'] as String? ?? '',
        brandColorBg: json['brand_color_bg'] as String? ?? '#04342C',
        brandAccent: json['brand_accent'] as String? ?? '#D85A30',
        logoUrl: json['logo_url'] as String?,
      );
}
