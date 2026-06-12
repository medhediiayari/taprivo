import 'dart:async';

import 'package:nfc_manager/nfc_manager.dart';

/// Result of a single tag discovery, with diagnostics so the UI can show
/// exactly what was read (or why no UID came out).
class NfcReadResult {
  NfcReadResult({required this.uid, required this.techs, required this.raw});

  /// Hardware serial as uppercase hex, or null when no identifier was found.
  final String? uid;

  /// Comma-joined top-level technology keys exposed by the platform tag
  /// (e.g. "nfca,mifareultralight,ndef") — useful for diagnosis.
  final String techs;

  /// Short stringified dump of the raw tag map (truncated).
  final String raw;
}

/// NFC tag reading. Returns the tag's identifier as uppercase hex, which the
/// backend matches against a provisioned `nfc_devices.uid`.
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

  /// Continuous listening: the session stays open and [onRead] fires every time
  /// a tag enters the field (hands-free flow — the restaurant taps its badge
  /// against the customer's phone). Returns false when NFC is unavailable.
  /// Call [stop] when leaving the screen.
  Future<bool> startTapListener(
    Future<void> Function(NfcReadResult result) onRead,
  ) async {
    if (!await NfcManager.instance.isAvailable()) return false;
    await NfcManager.instance.startSession(
      pollingOptions: {
        NfcPollingOption.iso14443,
        NfcPollingOption.iso15693,
        NfcPollingOption.iso18092,
      },
      onDiscovered: (NfcTag tag) async {
        final data = tag.data;
        final raw = data.toString();
        await onRead(NfcReadResult(
          uid: _extractUid(tag),
          techs: data.keys.join(','),
          raw: raw.length > 240 ? '${raw.substring(0, 240)}…' : raw,
        ));
      },
    );
    return true;
  }

  String? _extractUid(NfcTag tag) {
    // Recursively scan the whole tag map for an `identifier` byte array — tag
    // techs nest it under different keys (nfca, mifareultralight, isodep, …)
    // and the exact shape varies by device/plugin version.
    return _findIdentifier(tag.data);
  }

  String? _findIdentifier(dynamic node) {
    if (node is Map) {
      final id = node['identifier'] ?? node['id'] ?? node['uid'];
      final hex = _toHex(id);
      if (hex != null && hex.isNotEmpty) return hex;
      for (final v in node.values) {
        final found = _findIdentifier(v);
        if (found != null) return found;
      }
    } else if (node is List && node.isNotEmpty && node.first is Map) {
      for (final v in node) {
        final found = _findIdentifier(v);
        if (found != null) return found;
      }
    }
    return null;
  }

  String? _toHex(dynamic identifier) {
    if (identifier is List &&
        identifier.isNotEmpty &&
        identifier.first is int) {
      return identifier
          .map((b) => (b as int).toRadixString(16).padLeft(2, '0'))
          .join()
          .toUpperCase();
    }
    return null;
  }
}
