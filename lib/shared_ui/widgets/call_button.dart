import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/providers/service_providers.dart';
import '../../services/providers/device_providers.dart';
import '../../services/providers/call_providers.dart';
import '../../auth/providers/auth_provider.dart';

/// Call Button Widget
/// 
/// Initiates an outbound call from Web App to Android device
class CallButton extends ConsumerWidget {
  final String phoneNumber;
  final String? leadId;
  final IconData? icon;
  final String? label;
  final Color? color;
  final bool isCompact;

  const CallButton({
    super.key,
    required this.phoneNumber,
    this.leadId,
    this.icon,
    this.label,
    this.color,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final device = ref.watch(userDeviceProvider).valueOrNull;
    final currentUser = ref.watch(currentUserProvider);
    final callSignalService = ref.watch(callSignalServiceProvider);

    final isDeviceOnline = device?.isOnline ?? false;
    final canMakeCall = currentUser != null && isDeviceOnline;

    return _buildButton(
      context: context,
      ref: ref,
      canMakeCall: canMakeCall,
      device: device,
      callSignalService: callSignalService,
    );
  }

  Widget _buildButton({
    required BuildContext context,
    required WidgetRef ref,
    required bool canMakeCall,
    device,
    required callSignalService,
  }) {
    if (isCompact) {
      return IconButton(
        icon: Icon(icon ?? Icons.phone),
        color: canMakeCall ? (color ?? Colors.green) : Colors.grey,
        tooltip: canMakeCall
            ? 'Call $phoneNumber'
            : 'Device not connected',
        onPressed: canMakeCall
            ? () => _handleCall(context, ref, callSignalService)
            : null,
      );
    }

    return FilledButton.icon(
      onPressed: canMakeCall
          ? () => _handleCall(context, ref, callSignalService)
          : null,
      icon: Icon(icon ?? Icons.phone),
      label: Text(label ?? 'Call'),
      style: FilledButton.styleFrom(
        backgroundColor: canMakeCall ? (color ?? Colors.green) : Colors.grey,
        foregroundColor: Colors.white,
      ),
    );
  }

  Future<void> _handleCall(
    BuildContext context,
    WidgetRef ref,
    callSignalService,
  ) async {
    final currentUser = ref.read(currentUserProvider);
    final device = ref.read(userDeviceProvider).valueOrNull;

    if (currentUser == null) {
      _showError(context, 'Please login to make calls');
      return;
    }

    if (device == null) {
      _showError(context, 'No device connected. Please bind your Android device first.');
      return;
    }

    if (!device.isOnline) {
      _showError(context, 'Device is offline. Please check your Android app connection.');
      return;
    }

    try {
      // Show loading
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 16),
                Text('Initiating call to $phoneNumber...'),
              ],
            ),
            duration: const Duration(seconds: 2),
          ),
        );
      }

      // Create call signal
      await callSignalService.createCallSignal(
        userId: currentUser.userId,
        deviceId: device.deviceId,
        phoneNumber: phoneNumber,
        leadId: leadId,
      );

      // Success message
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Call signal sent to device. Opening dialer...'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      _showError(context, 'Failed to initiate call: $e');
    }
  }

  void _showError(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }
}


