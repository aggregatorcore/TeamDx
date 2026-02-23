import 'package:flutter/material.dart';
import '../models/lead.dart';
import '../models/call_event.dart';

class NewLeadDialog extends StatefulWidget {
  final String phoneNumber;
  final CallEvent? callEvent;
  final Lead? existingLead;
  final AssignedUser? assignedToOther;
  final Function(Map<String, dynamic>) onCreateLead;
  final Function()? onSkip;

  const NewLeadDialog({
    Key? key,
    required this.phoneNumber,
    this.callEvent,
    this.existingLead,
    this.assignedToOther,
    required this.onCreateLead,
    this.onSkip,
  }) : super(key: key);

  @override
  State<NewLeadDialog> createState() => _NewLeadDialogState();
}

class _NewLeadDialogState extends State<NewLeadDialog> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _countryController = TextEditingController();
  final _visaTypeController = TextEditingController();
  final _notesController = TextEditingController();
  
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    // Pre-fill phone number if available
    if (widget.existingLead != null) {
      _firstNameController.text = widget.existingLead!.firstName;
      _lastNameController.text = widget.existingLead!.lastName;
      _emailController.text = widget.existingLead!.email ?? '';
      _countryController.text = widget.existingLead!.country ?? '';
      _visaTypeController.text = widget.existingLead!.visaType ?? '';
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _countryController.dispose();
    _visaTypeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _handleSubmit() {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      final leadData = {
        'firstName': _firstNameController.text.trim(),
        'lastName': _lastNameController.text.trim(),
        'email': _emailController.text.trim().isNotEmpty 
            ? _emailController.text.trim() 
            : '',
        'phone': widget.phoneNumber,
        'country': _countryController.text.trim().isNotEmpty 
            ? _countryController.text.trim() 
            : null,
        'visaType': _visaTypeController.text.trim().isNotEmpty 
            ? _visaTypeController.text.trim() 
            : null,
        'status': 'new',
        'source': widget.callEvent?.type == CallType.incoming 
            ? 'incoming_call' 
            : 'outgoing_call',
        'notes': _notesController.text.trim().isNotEmpty 
            ? _notesController.text.trim() 
            : null,
      };

      widget.onCreateLead(leadData);
      
      // Dialog will be closed by parent
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasExistingLead = widget.existingLead != null;
    final isAssignedToOther = widget.assignedToOther != null;

    return AlertDialog(
      title: Row(
        children: [
          Icon(
            hasExistingLead ? Icons.warning_amber_rounded : Icons.person_add,
            color: hasExistingLead ? Colors.orange : Colors.blue,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              hasExistingLead 
                  ? 'Lead Already Exists' 
                  : 'Create New Lead',
              style: const TextStyle(fontSize: 20),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Warning if lead assigned to other user
              if (isAssignedToOther) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.orange.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.info_outline, 
                               color: Colors.orange.shade700, 
                               size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'This number is already assigned',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.orange.shade900,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (widget.assignedToOther!.role != null)
                        Text(
                          'Role: ${widget.assignedToOther!.role!.name}',
                          style: TextStyle(color: Colors.orange.shade800),
                        ),
                      Text(
                        'Assigned to: ${widget.assignedToOther!.fullName}',
                        style: TextStyle(color: Colors.orange.shade800),
                      ),
                      if (widget.assignedToOther!.employeeCode != null)
                        Text(
                          'Employee Code: ${widget.assignedToOther!.employeeCode}',
                          style: TextStyle(color: Colors.orange.shade800),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Phone number (read-only)
              TextFormField(
                enabled: false,
                initialValue: widget.phoneNumber,
                decoration: const InputDecoration(
                  labelText: 'Phone Number',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.phone),
                ),
              ),
              const SizedBox(height: 16),

              // First Name
              TextFormField(
                controller: _firstNameController,
                decoration: const InputDecoration(
                  labelText: 'First Name *',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.person),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'First name is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Last Name
              TextFormField(
                controller: _lastNameController,
                decoration: const InputDecoration(
                  labelText: 'Last Name *',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Last name is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Email
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email (Optional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email),
                ),
                validator: (value) {
                  if (value != null && value.trim().isNotEmpty) {
                    final emailRegex = RegExp(
                      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
                    );
                    if (!emailRegex.hasMatch(value.trim())) {
                      return 'Please enter a valid email';
                    }
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Country
              TextFormField(
                controller: _countryController,
                decoration: const InputDecoration(
                  labelText: 'Country (Optional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.flag),
                ),
              ),
              const SizedBox(height: 16),

              // Visa Type
              TextFormField(
                controller: _visaTypeController,
                decoration: const InputDecoration(
                  labelText: 'Visa Type (Optional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.assignment),
                ),
              ),
              const SizedBox(height: 16),

              // Notes
              TextFormField(
                controller: _notesController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Notes (Optional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.note),
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        if (widget.onSkip != null)
          TextButton(
            onPressed: _isLoading ? null : () {
              widget.onSkip!();
              Navigator.of(context).pop();
            },
            child: const Text('Skip'),
          ),
        TextButton(
          onPressed: _isLoading ? null : () {
            Navigator.of(context).pop();
          },
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _isLoading ? null : _handleSubmit,
          child: _isLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(hasExistingLead ? 'Update Lead' : 'Create Lead'),
        ),
      ],
    );
  }
}




