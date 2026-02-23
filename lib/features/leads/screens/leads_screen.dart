import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../shared_ui/widgets/call_button.dart';
import '../../../services/providers/service_providers.dart';
import '../../../services/providers/lead_providers.dart';
import '../../../core/models/lead_model.dart';
import '../../../auth/providers/auth_provider.dart';

/// Leads Screen
/// 
/// Lead management with call functionality
class LeadsScreen extends ConsumerStatefulWidget {
  const LeadsScreen({super.key});

  @override
  ConsumerState<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends ConsumerState<LeadsScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = ref.watch(currentUserProvider);
    final leadsAsync = ref.watch(leadsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leads'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Add Lead',
            onPressed: () => _showAddLeadDialog(context, ref),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search by phone number or name...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onChanged: (value) {
                setState(() => _searchQuery = value);
              },
            ),
          ),

          // Leads list
          Expanded(
            child: leadsAsync.when(
              data: (leads) {
                final filteredLeads = _filterLeads(leads, _searchQuery);
                
                if (filteredLeads.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _searchQuery.isNotEmpty ? Icons.search_off : Icons.people_outline,
                          size: 64,
                          color: Colors.grey,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _searchQuery.isNotEmpty
                              ? 'No leads found'
                              : 'No leads yet',
                          style: const TextStyle(
                            fontSize: 18,
                            color: Colors.grey,
                          ),
                        ),
                        if (_searchQuery.isEmpty) ...[
                          const SizedBox(height: 8),
                          FilledButton.icon(
                            icon: const Icon(Icons.add),
                            label: const Text('Add First Lead'),
                            onPressed: () => _showAddLeadDialog(context, ref),
                          ),
                        ],
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: filteredLeads.length,
                  itemBuilder: (context, index) {
                    final lead = filteredLeads[index];
                    return _buildLeadCard(context, ref, lead);
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, stack) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 64, color: Colors.red),
                    const SizedBox(height: 16),
                    Text('Error loading leads: $error'),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => ref.invalidate(leadsProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLeadCard(BuildContext context, WidgetRef ref, LeadModel lead) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _getStatusColor(lead.status),
          child: Text(
            lead.name?.isNotEmpty == true
                ? lead.name![0].toUpperCase()
                : lead.phoneNumber[0],
            style: const TextStyle(color: Colors.white),
          ),
        ),
        title: Text(
          lead.name ?? 'Unknown',
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
                  lead.phoneNumber,
                  style: const TextStyle(fontSize: 14),
                ),
              ],
            ),
            if (lead.email != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.email, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(
                    lead.email!,
                    style: const TextStyle(fontSize: 14),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 4),
            Chip(
              label: Text(
                lead.status.displayName,
                style: const TextStyle(fontSize: 10),
              ),
              backgroundColor: _getStatusColor(lead.status).withOpacity(0.2),
              padding: EdgeInsets.zero,
            ),
          ],
        ),
        trailing: CallButton(
          phoneNumber: lead.phoneNumber,
          leadId: lead.leadId,
          isCompact: true,
          color: Colors.green,
        ),
        isThreeLine: true,
        onTap: () => _showLeadDetails(context, ref, lead),
      ),
    );
  }

  Color _getStatusColor(LeadStatus status) {
    switch (status) {
      case LeadStatus.newLead:
        return Colors.blue;
      case LeadStatus.contacted:
        return Colors.orange;
      case LeadStatus.qualified:
        return Colors.purple;
      case LeadStatus.converted:
        return Colors.green;
      case LeadStatus.lost:
        return Colors.red;
    }
  }

  List<LeadModel> _filterLeads(List<LeadModel> leads, String query) {
    if (query.isEmpty) return leads;
    
    final lowerQuery = query.toLowerCase();
    return leads.where((lead) {
      return lead.phoneNumber.toLowerCase().contains(lowerQuery) ||
          (lead.name?.toLowerCase().contains(lowerQuery) ?? false) ||
          (lead.email?.toLowerCase().contains(lowerQuery) ?? false);
    }).toList();
  }

  void _showAddLeadDialog(BuildContext context, WidgetRef ref) {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final emailController = TextEditingController();
    final notesController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add New Lead'),
        content: SingleChildScrollView(
          child: Column(
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
                controller: phoneController,
                decoration: const InputDecoration(
                  labelText: 'Phone Number *',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.phone,
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
              const SizedBox(height: 16),
              TextField(
                controller: notesController,
                decoration: const InputDecoration(
                  labelText: 'Notes (Optional)',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              if (phoneController.text.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Phone number is required'),
                    backgroundColor: Colors.red,
                  ),
                );
                return;
              }

              try {
                final leadService = ref.read(leadServiceProvider);
                final currentUser = ref.read(currentUserProvider);
                
                await leadService.createLead(
                  phoneNumber: phoneController.text.trim(),
                  name: nameController.text.isNotEmpty
                      ? nameController.text.trim()
                      : null,
                  email: emailController.text.isNotEmpty
                      ? emailController.text.trim()
                      : null,
                  assignedTo: currentUser?.userId,
                  notes: notesController.text.isNotEmpty
                      ? notesController.text.trim()
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

  void _showLeadDetails(BuildContext context, WidgetRef ref, LeadModel lead) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(lead.name ?? 'Lead Details'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDetailRow('Phone', lead.phoneNumber),
              if (lead.email != null) _buildDetailRow('Email', lead.email!),
              _buildDetailRow('Status', lead.status.displayName),
              if (lead.notes != null) _buildDetailRow('Notes', lead.notes!),
              _buildDetailRow('Created', _formatDate(lead.createdAt)),
              if (lead.lastContacted != null)
                _buildDetailRow('Last Contacted', _formatDate(lead.lastContacted!)),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          FilledButton.icon(
            icon: const Icon(Icons.phone),
            label: const Text('Call'),
            onPressed: () {
              Navigator.pop(context);
              // Call button will handle the call
            },
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              '$label:',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.grey,
              ),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}

