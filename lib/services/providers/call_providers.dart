import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/call_model.dart';
import '../../core/models/call_signal_model.dart';
import '../call_service.dart';
import '../call_signal_service.dart';
import '../providers/service_providers.dart';
import '../../auth/providers/auth_provider.dart';

/// Active calls for current user
final activeCallsProvider = StreamProvider<List<CallModel>>((ref) {
  final currentUser = ref.watch(currentUserProvider);
  
  if (currentUser == null) {
    return Stream.value([]);
  }

  final callService = ref.watch(callServiceProvider);
  return callService.getActiveCalls(currentUser.userId);
});

/// Call history for current user
final callHistoryProvider = StreamProvider<List<CallModel>>((ref) {
  final currentUser = ref.watch(currentUserProvider);
  
  if (currentUser == null) {
    return Stream.value([]);
  }

  final callService = ref.watch(callServiceProvider);
  return callService.getCallHistory(currentUser.userId);
});

/// Incoming calls for current user (for notifications)
final incomingCallsProvider = StreamProvider<List<CallModel>>((ref) {
  final currentUser = ref.watch(currentUserProvider);
  
  if (currentUser == null) {
    return Stream.value([]);
  }

  final callService = ref.watch(callServiceProvider);
  return callService.getIncomingCalls(currentUser.userId);
});

/// Call signals for current user
final userCallSignalsProvider = StreamProvider<List<CallSignalModel>>((ref) {
  final currentUser = ref.watch(currentUserProvider);
  
  if (currentUser == null) {
    return Stream.value([]);
  }

  final callSignalService = ref.watch(callSignalServiceProvider);
  return callSignalService.getUserCallSignals(currentUser.userId);
});


