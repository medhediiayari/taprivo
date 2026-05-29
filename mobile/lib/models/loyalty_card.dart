/// Flattened loyalty card as returned by `GET /cards` (card joined with merchant).
class LoyaltyCard {
  final String id;
  final int stampsCount;
  final int totalStampsEarned;
  final int stampsRequired;
  final int pendingRewards;
  final String merchantId;
  final String merchantName;
  final String? address;
  final double? lat;
  final double? lng;
  final String rewardDescription;
  final String? logoUrl;
  final String brandColorBg;
  final String brandColorFg;
  final String brandAccent;

  const LoyaltyCard({
    required this.id,
    required this.stampsCount,
    required this.totalStampsEarned,
    required this.stampsRequired,
    required this.pendingRewards,
    required this.merchantId,
    required this.merchantName,
    required this.address,
    required this.lat,
    required this.lng,
    required this.rewardDescription,
    required this.logoUrl,
    required this.brandColorBg,
    required this.brandColorFg,
    required this.brandAccent,
  });

  double get progress =>
      stampsRequired == 0 ? 0 : (stampsCount / stampsRequired).clamp(0, 1).toDouble();

  static int _int(dynamic v) =>
      v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? 0}') ?? 0);

  static double? _double(dynamic v) =>
      v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));

  factory LoyaltyCard.fromJson(Map<String, dynamic> json) => LoyaltyCard(
        id: json['id'] as String,
        stampsCount: _int(json['stamps_count']),
        totalStampsEarned: _int(json['total_stamps_earned']),
        stampsRequired: _int(json['stamps_required']),
        pendingRewards: _int(json['pending_rewards']),
        merchantId: json['merchant_id'] as String,
        merchantName: json['merchant_name'] as String? ?? '',
        address: json['address'] as String?,
        lat: _double(json['lat']),
        lng: _double(json['lng']),
        rewardDescription: json['reward_description'] as String? ?? '',
        logoUrl: json['logo_url'] as String?,
        brandColorBg: json['brand_color_bg'] as String? ?? '#04342C',
        brandColorFg: json['brand_color_fg'] as String? ?? '#F4EBD9',
        brandAccent: json['brand_accent'] as String? ?? '#D85A30',
      );
}
