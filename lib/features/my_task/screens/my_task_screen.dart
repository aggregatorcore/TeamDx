import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../shared_ui/widgets/call_button.dart';
import '../../../services/providers/call_providers.dart';
import '../../../services/providers/device_providers.dart';
import '../../../core/models/call_model.dart';

/// My Task Screen
/// 
/// Task management with call functionality
class MyTaskScreen extends ConsumerWidget {
  const MyTaskScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final device = ref.watch(userDeviceProvider).valueOrNull;
    final activeCalls = ref.watch(activeCallsProvider).valueOrNull ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Task'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
        actions: [
          // Device status indicator
          if (device != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                children: [
                  Icon(
                    device.isOnline ? Icons.phone_android : Icons.phone_disabled,
                    color: device.isOnline ? Colors.green : Colors.grey,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    device.isOnline ? 'Device Online' : 'Device Offline',
                    style: TextStyle(
                      color: device.isOnline ? Colors.green : Colors.grey,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // Active calls banner
          if (activeCalls.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.blue.shade50,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.phone, color: Colors.blue),
                      const SizedBox(width: 8),
                      Text(
                        'Active Call${activeCalls.length > 1 ? 's' : ''}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ...activeCalls.map((call) => Padding(
                        padding: const EdgeInsets.only(top: 8.0),
                        child: Row(
                          children: [
                            Icon(
                              call.type == CallType.inbound
                                  ? Icons.call_received
                                  : Icons.call_made,
                              size: 16,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${call.phoneNumber} - ${call.status.toString()}',
                                style: const TextStyle(fontSize: 14),
                              ),
                            ),
                          ],
                        ),
                      )),
                ],
              ),
            ),

          // Main content
          Expanded(
            child: _buildTaskList(context, ref),
          ),
        ],
      ),
    );
  }

  Widget _buildTaskList(BuildContext context, WidgetRef ref) {
    // Placeholder task list - will be replaced with actual tasks later
    final sampleTasks = [
      {
        'title': 'Follow up with John Doe',
        'phone': '+1234567890',
        'status': 'pending',
      },
      {
        'title': 'Call Sarah Smith',
        'phone': '+0987654321',
        'status': 'in-progress',
      },
      {
        'title': 'Contact Mike Johnson',
        'phone': '+1122334455',
        'status': 'pending',
      },
    ];

    if (sampleTasks.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.task_alt,
              size: 64,
              color: Colors.grey,
            ),
            SizedBox(height: 16),
            Text(
              'No tasks yet',
              style: TextStyle(
                fontSize: 18,
                color: Colors.grey,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Tasks will appear here',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: sampleTasks.length,
      itemBuilder: (context, index) {
        final task = sampleTasks[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: _getStatusColor(task['status'] as String),
              child: const Icon(Icons.person, color: Colors.white),
            ),
            title: Text(
              task['title'] as String,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.phone, size: 16, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(
                      task['phone'] as String,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Chip(
                  label: Text(
                    (task['status'] as String).toUpperCase(),
                    style: const TextStyle(fontSize: 10),
                  ),
                  backgroundColor: _getStatusColor(task['status'] as String)
                      .withOpacity(0.2),
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
            trailing: CallButton(
              phoneNumber: task['phone'] as String,
              isCompact: true,
              color: Colors.green,
            ),
            isThreeLine: true,
          ),
        );
      },
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending':
        return Colors.orange;
      case 'in-progress':
        return Colors.blue;
      case 'completed':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }
}
