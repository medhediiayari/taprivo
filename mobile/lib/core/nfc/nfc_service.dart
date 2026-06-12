import 'dart:async';

import 'package:nfc_manager/nfc_manager.dart';

/// One-shot NFC tag read. Returns the tag's identifier as uppercase hex, which
/// the backend matches against a provisioned `nfc_devices.uid`.
///
/// Note (architecture §5.6): passive NDEF tags can't do challenge-response, so
/// v1 trusts the provisioned UID + server-side geofence. iOS only supports
/// foreground reading sessions through Flutter.
class NfcService {
  Future<bool> isAvailable() => NfcManager.instance.isAvailable();

  /// Stops any running session (best-effort) — call when leaving a screen that
  /// started a read.
  Future<void> stop() async {
    try {
      await NfcManager.instance.stopSession();
    } catch (_) {
      // no active session / unsupported — ignore
    }
  }

  Future<String?> readUid() async {
    if (!await NfcManager.instance.isAvailable()) return null;

    final completer = Completer<String?>();
    await NfcManager.instance.startSession(
      pollingOptions: {NfcPollingOption.iso14443, NfcPollingOption.iso15693},
      onDiscovered: (NfcTag tag) async {
        final uid = _extractUid(tag);
        await NfcManager.instance.stopSession();
        if (!completer.isCompleted) completer.complete(uid);
      },
    );
    return completer.future;
  }

  /// Continuous listening: the session stays open and [onUid] fires every time
  /// a tag enters the field (hands-free flow — the restaurant taps its badge
  /// against the customer's phone). Returns false when NFC is unavailable.
  /// Call [stop] when leaving the screen.
  Future<bool> startTapListener(Future<void> Function(String uid) onUid) async {
    if (!await NfcManager.instance.isAvailable()) return false;
    await NfcManager.instance.startSession(
      pollingOptions: {NfcPollingOption.iso14443, NfcPollingOption.iso15693},
      onDiscovered: (NfcTag tag) async {
        final uid = _extractUid(tag);
        if (uid != null) await onUid(uid);
      },
    );
    return true;
  }

  String? _extractUid(NfcTag tag) {
    final data = tag.data;
    // Different tag technologies surface the serial under different keys
    // (nfca, mifareultralight, isodep, ndef→nfca, …). Rather than guess a
    // fixed list, scan every section for an `identifier` byte array. Prefer
    // the low-level techs first so we get the raw hardware UID.
    const preferred = ['nfca', 'nfcb', 'nfcf', 'nfcv', 'isodep'];
    for (final key in preferred) {
      final hex = _identifierOf(data[key]);
      if (hex != null) return hex;
    }
    for (final section in data.values) {
      final hex = _identifierOf(section);
      if (hex != null) return hex;
    }
    return null;
  }

  String? _identifierOf(dynamic section) {
    if (section is Map && section['identifier'] != null) {
      final hex = _toHex(section['identifier']);
      if (hex.isNotEmpty) return hex;
    }
    return null;
  }

  String _toHex(dynamic identifier) {
    if (identifier is List) {
      return identifier
          .map((b) => (b as int).toRadixString(16).padLeft(2, '0'))
          .join()
          .toUpperCase();
    }
    return identifier.toString();
  }
}
