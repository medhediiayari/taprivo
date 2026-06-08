# Image assets

Drop the onboarding hero illustration here as:

    onboarding_cards.png

(the fanned green/sage/terracotta/gold loyalty cards over leaves)

It's referenced by `lib/features/onboarding/widgets/onboarding_card_stack.dart`
via `Image.asset('assets/images/onboarding_cards.png')`. Until the file exists,
the app falls back to a vector-drawn version of the same illustration, so the
build keeps working either way.

A transparent-background PNG around 1000×1000 px looks best.
