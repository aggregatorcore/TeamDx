import 'dart:convert';
import '../models/call_event.dart';
import '../utils/storage.dart';

class OfflineQueue {
  static const String _queueKey = 'offline_call_queue';
  static const int maxSize = 100;

  Future<List<CallEvent>> getQueue() async {
    final queueJson = Storage.getString(_queueKey);
    if (queueJson == null) return [];

    try {
      final List<dynamic> queueList = json.decode(queueJson);
      return queueList.map((item) => CallEvent.fromJson(item)).toList();
    } catch (e) {
      print('Error parsing offline queue: $e');
      return [];
    }
  }

  Future<void> addToQueue(CallEvent event) async {
    final queue = await getQueue();
    
    // Prevent duplicates
    if (queue.any((e) => 
      e.phoneNumber == event.phoneNumber && 
      e.timestamp == event.timestamp
    )) {
      return;
    }

    queue.add(event);

    // Limit queue size
    if (queue.length > maxSize) {
      queue.removeAt(0);
    }

    await _saveQueue(queue);
  }

  Future<void> removeFromQueue(CallEvent event) async {
    final queue = await getQueue();
    queue.removeWhere((e) => 
      e.phoneNumber == event.phoneNumber && 
      e.timestamp == event.timestamp
    );
    await _saveQueue(queue);
  }

  Future<void> clearQueue() async {
    await Storage.remove(_queueKey);
  }

  Future<void> _saveQueue(List<CallEvent> queue) async {
    final queueJson = json.encode(
      queue.map((e) => e.toJson()).toList()
    );
    await Storage.setString(_queueKey, queueJson);
  }
}

