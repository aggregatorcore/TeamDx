import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../auth/services/auth_service.dart';
import '../../../shared_ui/widgets/dashboard_card.dart';
import '../../../shared_ui/widgets/incoming_call_notification.dart';
import '../../../shared_ui/widgets/call_status_widget.dart';
import '../../../services/providers/device_providers.dart';

/// Dashboard Screen
/// 
/// Main operations dashboard with navigation to different features
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(currentUserProvider);
    final authService = ref.read(authServiceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('MY DX Operations'),
        actions: [
          // User Info
          if (currentUser != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Center(
                child: Row(
                  children: [
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          currentUser.name,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        Text(
                          currentUser.role.displayName,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Colors.grey[600],
                              ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 8),
                    CircleAvatar(
                      child: Text(
                        currentUser.name.isNotEmpty
                            ? currentUser.name[0].toUpperCase()
                            : 'U',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          // Logout Button
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
            onPressed: () async {
              await authService.signOut();
              if (context.mounted) {
                context.go('/login');
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Incoming call notification
          const IncomingCallNotification(),
          
          // Call status widget
          const CallStatusWidget(),
          
          // Main dashboard content
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome, ${currentUser?.name ?? 'User'}',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Operations Dashboard',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.grey[600],
                        ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Device binding quick access
                  _buildDeviceStatusCard(context, ref),
                  
                  const SizedBox(height: 24),

                  // Feature Cards
                  Expanded(
                    child: GridView.count(
                      crossAxisCount: _getCrossAxisCount(context),
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                      childAspectRatio: 1.2,
                      children: [
                        DashboardCard(
                          title: 'My Task',
                          icon: Icons.task_alt,
                          color: Colors.blue,
                          onTap: () => context.go('/my-task'),
                        ),
                        DashboardCard(
                          title: 'Buckets',
                          icon: Icons.inbox,
                          color: Colors.green,
                          onTap: () => context.go('/buckets'),
                        ),
                        DashboardCard(
                          title: 'Leads',
                          icon: Icons.people,
                          color: Colors.orange,
                          onTap: () => context.go('/leads'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceStatusCard(BuildContext context, WidgetRef ref) {
    final device = ref.watch(userDeviceProvider).valueOrNull;

    return Card(
      color: device == null
          ? Colors.orange.shade50
          : (device.isOnline ? Colors.green.shade50 : Colors.grey.shade200),
      child: InkWell(
        onTap: () => context.go('/device-binding'),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              Icon(
                device == null
                    ? Icons.phone_android_outlined
                    : (device.isOnline ? Icons.phone_android : Icons.phone_disabled),
                color: device == null
                    ? Colors.orange
                    : (device.isOnline ? Colors.green : Colors.grey),
                size: 32,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      device == null
                          ? 'No Device Bound'
                          : device.deviceName,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      device == null
                          ? 'Tap to bind your Android device for calling'
                          : (device.isOnline
                              ? 'Device is online and ready'
                              : 'Device is offline'),
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios,
                size: 16,
                color: Colors.grey[600],
              ),
            ],
          ),
        ),
      ),
    );
  }

  int _getCrossAxisCount(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width > 1200) return 4;
    if (width > 800) return 3;
    if (width > 600) return 2;
    return 1;
  }
}
