import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/lead_model.dart';
import '../lead_service.dart';
import 'service_providers.dart';
import '../../auth/providers/auth_provider.dart';

/// Leads Provider for current user
final leadsProvider = StreamProvider<List<LeadModel>>((ref) {
  final currentUser = ref.watch(currentUserProvider);
  
  if (currentUser == null) {
    return Stream.value([]);
  }

  final leadService = ref.watch(leadServiceProvider);
  return leadService.getLeadsByUser(currentUser.userId);
});

/// All Leads Provider (for admins)
final allLeadsProvider = StreamProvider<List<LeadModel>>((ref) {
  final leadService = ref.watch(leadServiceProvider);
  return leadService.getAllLeads();
});

/// Lead by ID Provider
final leadByIdProvider = StreamProvider.family<LeadModel?, String>((ref, leadId) async* {
  final leadService = ref.watch(leadServiceProvider);
  yield await leadService.getLead(leadId);
});

/// Lead by Phone Number Provider
final leadByPhoneProvider = FutureProvider.family<LeadModel?, String>((ref, phoneNumber) async {
  final leadService = ref.watch(leadServiceProvider);
  return await leadService.getLeadByPhoneNumber(phoneNumber);
});


