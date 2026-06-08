class Merchant {
  final String id;
  final String name;
  final String slug;
  final String address;
  final double? lat;
  final double? lng;
  final int stampsRequired;
  final String rewardDescription;
  final String? logoUrl;
  final String brandColorBg;
  final String brandColorFg;
  final String brandAccent;

  const Merchant({
    required this.id,
    required this.name,
    required this.slug,
    required this.address,
    required this.lat,
    required this.lng,
    required this.stampsRequired,
    required this.rewardDescription,
    required this.logoUrl,
    required this.brandColorBg,
    required this.brandColorFg,
    required this.brandAccent,
  });

  factory Merchant.fromJson(Map<String, dynamic> json) => Merchant(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
        address: json['address'] as String? ?? '',
        lat: (json['lat'] as num?)?.toDouble(),
        lng: (json['lng'] as num?)?.toDouble(),
        stampsRequired: (json['stamps_required'] as num?)?.toInt() ?? 10,
        rewardDescription: json['reward_description'] as String? ?? '',
        logoUrl: json['logo_url'] as String?,
        brandColorBg: json['brand_color_bg'] as String? ?? '#1F3A2D',
        brandColorFg: json['brand_color_fg'] as String? ?? '#FFF9F0',
        brandAccent: json['brand_accent'] as String? ?? '#B95035',
      );
}
