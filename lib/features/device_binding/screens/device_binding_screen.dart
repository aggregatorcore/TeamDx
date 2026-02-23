import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../services/providers/device_providers.dart';
import '../../../services/providers/service_providers.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../core/models/device_model.dart';

/// Device Binding Screen
/// 
/// Allows users to bind their Android device for calling
class DeviceBindingScreen extends ConsumerStatefulWidget {
  const DeviceBindingScreen({super.key});

  @override
  ConsumerState<DeviceBindingScreen> createState() => _DeviceBindingScreenState();
}

class _DeviceBindingScreenState extends ConsumerState<DeviceBindingScreen> {
  final _deviceIdController = TextEditingController();
  final _deviceNameController = TextEditingController();
  final _phoneNumberController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _deviceIdController.dispose();
    _deviceNameController.dispose();
    _phoneNumberController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final device = ref.watch(userDeviceProvider).valueOrNull;
    final currentUser = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Device Binding'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Current device status
            if (device != null) _buildCurrentDeviceCard(device),
            
            const SizedBox(height: 24),
            
            // Binding form
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      device == null ? 'Bind Your Android Device' : 'Update Device',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Enter your Android device information to enable calling from the web app.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey[600],
                          ),
                    ),
                    const SizedBox(height: 24),
                    
                    // Device ID field
                    TextField(
                      controller: _deviceIdController,
                      decoration: InputDecoration(
                        labelText: 'Device ID',
                        hintText: 'Enter device ID (from Android app)',
                        prefixIcon: const Icon(Icons.phone_android),
                        border: const OutlineInputBorder(),
                        helperText: 'Get this from your Android app settings',
                      ),
                      enabled: !_isLoading,
                    ),
                    const SizedBox(height: 16),
                    
                    // Device Name field
                    TextField(
                      controller: _deviceNameController,
                      decoration: InputDecoration(
                        labelText: 'Device Name',
                        hintText: 'e.g., Samsung Galaxy S21',
                        prefixIcon: const Icon(Icons.devices),
                        border: const OutlineInputBorder(),
                      ),
                      enabled: !_isLoading,
                    ),
                    const SizedBox(height: 16),
                    
                    // Phone Number field
                    TextField(
                      controller: _phoneNumberController,
                      decoration: InputDecoration(
                        labelText: 'Phone Number',
                        hintText: '+1234567890',
                        prefixIcon: const Icon(Icons.phone),
                        border: const OutlineInputBorder(),
                        helperText: 'SIM phone number for this device',
                      ),
                      keyboardType: TextInputType.phone,
                      enabled: !_isLoading,
                    ),
                    const SizedBox(height: 24),
                    
                    // Bind/Update button
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _isLoading ? null : () => _handleBinding(context, ref),
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(device == null ? 'Bind Device' : 'Update Device'),
                      ),
                    ),
                    
                    // Unbind button (if device exists)
                    if (device != null) ...[
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: _isLoading ? null : () => _handleUnbinding(context, ref),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                          child: const Text('Unbind Device'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Instructions
            Card(
              color: Colors.blue.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.info_outline, color: Colors.blue.shade700),
                        const SizedBox(width: 8),
                        Text(
                          'How to Get Device ID',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.blue.shade700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '1. Open the Android app on your device\n'
                      '2. Go to Settings or Device Info\n'
                      '3. Copy the Device ID shown there\n'
                      '4. Paste it in the form above\n'
                      '5. Enter your device name and phone number\n'
                      '6. Click "Bind Device"',
                      style: TextStyle(color: Colors.blue.shade900),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentDeviceCard(DeviceModel device) {
    return Card(
      color: device.isOnline ? Colors.green.shade50 : Colors.grey.shade200,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  device.isOnline ? Icons.phone_android : Icons.phone_disabled,
                  color: device.isOnline ? Colors.green : Colors.grey,
                ),
                const SizedBox(width: 8),
                Text(
                  'Current Device',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: device.isOnline ? Colors.green.shade900 : Colors.grey.shade700,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: device.isOnline ? Colors.green : Colors.grey,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    device.isOnline ? 'Online' : 'Offline',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildInfoRow('Device Name', device.deviceName),
            _buildInfoRow('Phone Number', device.phoneNumber),
            _buildInfoRow('Device ID', device.deviceId),
            _buildInfoRow('Last Seen', _formatDateTime(device.lastSeen)),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              '$label:',
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.grey,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes} minutes ago';
    } else if (difference.inDays < 1) {
      return '${difference.inHours} hours ago';
    } else {
      return '${difference.inDays} days ago';
    }
  }

  Future<void> _handleBinding(BuildContext context, WidgetRef ref) async {
    if (_deviceIdController.text.isEmpty) {
      _showError(context, 'Please enter Device ID');
      return;
    }

    if (_deviceNameController.text.isEmpty) {
      _showError(context, 'Please enter Device Name');
      return;
    }

    if (_phoneNumberController.text.isEmpty) {
      _showError(context, 'Please enter Phone Number');
      return;
    }

    setState(() => _isLoading = true);

    try {
      final currentUser = ref.read(currentUserProvider);
      if (currentUser == null) {
        throw Exception('User not logged in');
      }

      final deviceService = ref.read(deviceServiceProvider);
      await deviceService.bindDevice(
        deviceId: _deviceIdController.text.trim(),
        userId: currentUser.userId,
        deviceName: _deviceNameController.text.trim(),
        phoneNumber: _phoneNumberController.text.trim(),
      );

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Device bound successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        context.go('/dashboard');
      }
    } catch (e) {
      if (context.mounted) {
        _showError(context, 'Failed to bind device: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleUnbinding(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Unbind Device?'),
        content: const Text(
          'Are you sure you want to unbind this device? '
          'You will need to bind it again to make calls.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Unbind'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isLoading = true);

    try {
      final device = ref.read(userDeviceProvider).valueOrNull;
      if (device == null) {
        throw Exception('No device to unbind');
      }

      final deviceService = ref.read(deviceServiceProvider);
      await deviceService.unbindDevice(device.deviceId);

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Device unbound successfully'),
            backgroundColor: Colors.green,
          ),
        );
        context.go('/dashboard');
      }
    } catch (e) {
      if (context.mounted) {
        _showError(context, 'Failed to unbind device: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showError(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }
}


