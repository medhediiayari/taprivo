import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// Brand-styled text field with an optional show/hide toggle for passwords.
class AuthField extends StatefulWidget {
  const AuthField({
    super.key,
    required this.controller,
    required this.label,
    required this.icon,
    this.obscure = false,
    this.keyboardType,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final bool obscure;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onSubmitted;

  @override
  State<AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<AuthField> {
  late bool _hidden = widget.obscure;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      obscureText: _hidden,
      keyboardType: widget.keyboardType,
      autocorrect: false,
      onSubmitted: widget.onSubmitted,
      decoration: InputDecoration(
        labelText: widget.label,
        prefixIcon: Icon(widget.icon, color: TaprivoBrand.textSecondary),
        suffixIcon: widget.obscure
            ? IconButton(
                icon: Icon(_hidden ? Icons.visibility_off : Icons.visibility,
                    color: TaprivoBrand.textSecondary),
                onPressed: () => setState(() => _hidden = !_hidden),
              )
            : null,
        filled: true,
        fillColor: TaprivoBrand.card,
        border: _border(TaprivoBrand.border),
        enabledBorder: _border(TaprivoBrand.border),
        focusedBorder: _border(TaprivoBrand.green, 1.6),
      ),
    );
  }

  OutlineInputBorder _border(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: c, width: w),
      );
}

/// "── ou ──" divider.
class OrDivider extends StatelessWidget {
  const OrDivider({super.key, this.label = 'ou'});
  final String label;

  @override
  Widget build(BuildContext context) {
    final line = Expanded(child: Container(height: 1, color: TaprivoBrand.border));
    return Row(
      children: [
        line,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(label,
              style: const TextStyle(color: TaprivoBrand.textSecondary, fontSize: 13)),
        ),
        line,
      ],
    );
  }
}

/// White, bordered "Continuer avec Google" button.
class GoogleButton extends StatelessWidget {
  const GoogleButton({super.key, this.onPressed, this.loading = false});

  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 54,
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: loading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.white,
          side: const BorderSide(color: TaprivoBrand.border, width: 1.4),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        icon: loading
            ? const SizedBox(
                width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.g_mobiledata, color: Color(0xFF4285F4), size: 30),
        label: const Text(
          'Continuer avec Google',
          style: TextStyle(color: TaprivoBrand.brown, fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
    );
  }
}
