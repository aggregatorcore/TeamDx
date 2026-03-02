import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/storage.dart';
import '../utils/constants.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final data = await _api.getMe();
      if (data['user'] != null && mounted) {
        setState(() {
          _user = data['user'] as Map<String, dynamic>;
          _loading = false;
        });
      } else if (mounted) {
        setState(() => _loading = false);
      }
    } catch (_) {
      final stored = Storage.getString(StorageKeys.user);
      if (stored != null) {
        try {
          final decoded = json.decode(stored) as Map<String, dynamic>;
          if (mounted) setState(() {
            _user = decoded;
            _loading = false;
          });
        } catch (_) {
          if (mounted) setState(() => _loading = false);
        }
      } else if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  String _getInitials() {
    final s = _user!['firstName']?.toString() ?? '';
    if (s.isNotEmpty) return s.substring(0, 1).toUpperCase();
    final e = _user!['email']?.toString() ?? '';
    if (e.isNotEmpty) return e.substring(0, 1).toUpperCase();
    return '?';
  }

  Future<void> _logout() async {
    await _api.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  if (_user != null) ...[
                    CircleAvatar(
                      radius: 48,
                      child: Text(
                        _getInitials(),
                        style: const TextStyle(fontSize: 36),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '${_user!['firstName'] ?? ''} ${_user!['lastName'] ?? ''}'.trim(),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(_user!['email']?.toString() ?? ''),
                    if (_user!['role'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Chip(label: Text(_user!['role']['name']?.toString() ?? '')),
                      ),
                  ],
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _logout,
                      icon: const Icon(Icons.logout),
                      label: const Text('Logout'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
