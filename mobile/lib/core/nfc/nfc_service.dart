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

  String? _extractUid(NfcTag tag) {
    final data = tag.data;
    const keys = ['nfca', 'nfcb', 'nfcf', 'nfcv', 'mifare', 'iso7816', 'isodep'];
    for (final key in keys) {
      final section = data[key];
      if (section is Map && section['identifier'] != null) {
        return _toHex(section['identifier']);
      }
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
