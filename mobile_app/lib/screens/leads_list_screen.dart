import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'lead_detail_screen.dart';

class LeadsListScreen extends StatefulWidget {
  const LeadsListScreen({Key? key}) : super(key: key);

  @override
  State<LeadsListScreen> createState() => _LeadsListScreenState();
}

class _LeadsListScreenState extends State<LeadsListScreen> {
  final ApiService _api = ApiService();
  List<dynamic> _leads = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadLeads();
  }

  Future<void> _loadLeads() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _api.getLeads();
      if (mounted) {
        setState(() {
          _leads = list;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Leads'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _loadLeads,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadLeads, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _leads.isEmpty
                  ? const Center(child: Text('No leads assigned'))
                  : RefreshIndicator(
                      onRefresh: _loadLeads,
                      child: ListView.builder(
                        itemCount: _leads.length,
                        itemBuilder: (context, i) {
                          final lead = _leads[i] as Map<String, dynamic>;
                          final name = '${lead['firstName'] ?? ''} ${lead['lastName'] ?? ''}'.trim();
                          final phone = lead['phone'] ?? '';
                          final id = lead['id'] as String?;
                          return ListTile(
                            leading: const CircleAvatar(child: Icon(Icons.person)),
                            title: Text(name.isEmpty ? phone : name),
                            subtitle: Text(phone),
                            onTap: id != null
                                ? () => Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => LeadDetailScreen(leadId: id),
                                      ),
                                    )
                                : null,
                          );
                        },
                      ),
                    ),
    );
  }
}
