import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/call_model.dart';
import '../../services/providers/call_providers.dart';

/// Call Status Widget
/// 
/// Shows active call status in a compact format
class CallStatusWidget extends ConsumerWidget {
  const CallStatusWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeCalls = ref.watch(activeCallsProvider).valueOrNull ?? [];

    if (activeCalls.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Row(
        children: [
          const Icon(Icons.phone, color: Colors.blue, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: activeCalls.map((call) => Padding(
                    padding: const EdgeInsets.only(bottom: 4.0),
                    child: Row(
                      children: [
                        Icon(
                          call.type == CallType.inbound
                              ? Icons.call_received
                              : Icons.call_made,
                          size: 16,
                          color: Colors.blue,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            call.phoneNumber,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        _buildStatusChip(call.status),
                      ],
                    ),
                  )).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusChip(CallStatus status) {
    Color color;
    String label;

    switch (status) {
      case CallStatus.ringing:
        color = Colors.orange;
        label = 'Ringing';
        break;
      case CallStatus.connected:
        color = Colors.green;
        label = 'Connected';
        break;
      case CallStatus.ended:
        color = Colors.grey;
        label = 'Ended';
        break;
      case CallStatus.missed:
        color = Colors.red;
        label = 'Missed';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}


