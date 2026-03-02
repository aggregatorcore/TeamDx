import 'package:flutter/material.dart';
import '../services/api_service.dart';

class LeadDetailScreen extends StatefulWidget {
  final String leadId;

  const LeadDetailScreen({Key? key, required this.leadId}) : super(key: key);

  @override
  State<LeadDetailScreen> createState() => _LeadDetailScreenState();
}

class _LeadDetailScreenState extends State<LeadDetailScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _lead;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadLead();
  }

  Future<void> _loadLead() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _api.getLead(widget.leadId);
      if (mounted) {
        setState(() {
          _lead = data;
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
      appBar: AppBar(title: const Text('Lead Detail')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : _lead == null
                  ? const Center(child: Text('Not found'))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _row('Name', '${_lead!['firstName'] ?? ''} ${_lead!['lastName'] ?? ''}'),
                          _row('Phone', _lead!['phone']?.toString() ?? ''),
                          _row('Email', _lead!['email']?.toString() ?? ''),
                          _row('Status', _lead!['status']?.toString() ?? ''),
                          _row('Priority', _lead!['priority']?.toString() ?? ''),
                          if (_lead!['notes'] != null && _lead!['notes'].toString().isNotEmpty)
                            _row('Notes', _lead!['notes'].toString()),
                        ],
                      ),
                    ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          const SizedBox(height: 2),
          Text(value.isEmpty ? '-' : value, style: const TextStyle(fontSize: 16)),
        ],
      ),
    );
  }
}
