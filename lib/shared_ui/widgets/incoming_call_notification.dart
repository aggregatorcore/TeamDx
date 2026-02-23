import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/call_model.dart';
import '../../services/providers/call_providers.dart';
import '../../services/providers/service_providers.dart';
import '../../services/lead_service.dart';
import '../../core/models/lead_model.dart';

/// Incoming Call Notification Widget
/// 
/// Shows a notification banner when an incoming call is detected
class IncomingCallNotification extends ConsumerWidget {
  const IncomingCallNotification({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final incomingCalls = ref.watch(incomingCallsProvider).valueOrNull ?? [];

    if (incomingCalls.isEmpty) {
      return const SizedBox.shrink();
    }

    // Show notification for the most recent incoming call
    final latestCall = incomingCalls.first;

    return _buildNotification(context, ref, latestCall);
  }

  Widget _buildNotification(
    BuildContext context,
    WidgetRef ref,
    CallModel call,
  ) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        border: Border.all(color: Colors.blue.shade300, width: 2),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.call_received,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Incoming Call',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      call.phoneNumber,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () {
                  // Dismiss notification (call will still be tracked)
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          FutureBuilder<LeadModel?>(
            future: _getLeadForPhone(ref, call.phoneNumber),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const SizedBox(
                  height: 20,
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                );
              }

              final lead = snapshot.data;

              if (lead != null) {
                return _buildLeadInfo(context, lead);
              } else {
                return _buildNewLeadOption(context, ref, call);
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildLeadInfo(BuildContext context, LeadModel lead) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.person, color: Colors.blue),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lead.name ?? 'Unknown',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                if (lead.email != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    lead.email!,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Chip(
            label: Text(
              lead.status.displayName,
              style: const TextStyle(fontSize: 10),
            ),
            backgroundColor: Colors.blue.shade100,
          ),
        ],
      ),
    );
  }

  Widget _buildNewLeadOption(BuildContext context, WidgetRef ref, CallModel call) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            icon: const Icon(Icons.person_add),
            label: const Text('Create Lead'),
            onPressed: () {
              _showCreateLeadDialog(context, ref, call.phoneNumber);
            },
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: FilledButton.icon(
            icon: const Icon(Icons.phone),
            label: const Text('Answer'),
            onPressed: () {
              // Call is already being answered by Android app
              // This is just for UI feedback
            },
          ),
        ),
      ],
    );
  }

  Future<LeadModel?> _getLeadForPhone(WidgetRef ref, String phoneNumber) async {
    try {
      final leadService = ref.read(leadServiceProvider);
      return await leadService.getLeadByPhoneNumber(phoneNumber);
    } catch (e) {
      return null;
    }
  }

  void _showCreateLeadDialog(
    BuildContext context,
    WidgetRef ref,
    String phoneNumber,
  ) {
    final nameController = TextEditingController();
    final emailController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Create Lead'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(
                labelText: 'Name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: emailController,
              decoration: const InputDecoration(
                labelText: 'Email (Optional)',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 8),
            Text(
              'Phone: $phoneNumber',
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              try {
                final leadService = ref.read(leadServiceProvider);
                await leadService.createLead(
                  phoneNumber: phoneNumber,
                  name: nameController.text.isNotEmpty
                      ? nameController.text
                      : null,
                  email: emailController.text.isNotEmpty
                      ? emailController.text
                      : null,
                );

                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Lead created successfully'),
                      backgroundColor: Colors.green,
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Failed to create lead: $e'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }
}


