import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../services/api_service.dart';
import '../services/device_service.dart';
import '../services/websocket_service.dart';
import '../utils/storage.dart';
import '../models/device_info.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  final ApiService _apiService = ApiService();
  final DeviceService _deviceService = DeviceService();
  final WebSocketService _wsService = WebSocketService();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Login
      await _apiService.login(
        _emailController.text.trim(),
        _passwordController.text,
      );

      // Navigate to home screen immediately (don't wait for device registration)
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }

      // Device registration in background (non-blocking, fire and forget)
      // This runs after navigation so login is not blocked
      _registerDeviceInBackground().catchError((error) {
        print('Device registration background error (non-critical): $error');
        // For Future<void>, catchError handler should return void (implicit)
        return;
      });
    } catch (e) {
      // Only show error if login itself failed
      // Don't show device registration errors
      if (mounted) {
        setState(() {
          final errorMsg = e.toString().replaceAll('Exception: ', '');
          // Check if it's a login error (not device registration error)
          if (errorMsg.contains('login') || errorMsg.contains('authentication') || errorMsg.contains('credentials')) {
            _errorMessage = errorMsg;
          } else {
            // For other errors, just log and navigate anyway
            print('Error during login process: $errorMsg');
            // Check if token exists (login was successful)
            final token = Storage.getString('auth_token');
            if (token != null) {
              // Login was successful, navigate anyway
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const HomeScreen()),
              );
              return;
            }
            _errorMessage = errorMsg;
          }
          _isLoading = false;
        });
      }
    }
  }

  // Device registration in background (non-blocking)
  Future<void> _registerDeviceInBackground() async {
    try {
      final deviceId = await _deviceService.getDeviceId().timeout(
        const Duration(seconds: 5),
        onTimeout: () => 'device-${DateTime.now().millisecondsSinceEpoch}',
      );
      final deviceName = await _deviceService.getDeviceName().timeout(
        const Duration(seconds: 5),
        onTimeout: () => 'Unknown Device',
      );
      final phoneNumber = await _deviceService.getPhoneNumber().timeout(
        const Duration(seconds: 5),
        onTimeout: () => null,
      );

      final deviceInfo = DeviceInfo(
        deviceId: deviceId,
        deviceName: deviceName,
        phoneNumber: phoneNumber,
      );

      print('📱 [DEBUG] Attempting device registration (background)...');
      try {
        await _apiService.registerDevice(deviceInfo).timeout(
          const Duration(seconds: 10),
        );
        print('✅ [DEBUG] Device registration successful');
        await Storage.setString('device_id', deviceId);

        // Connect WebSocket (only if device registered successfully)
        _wsService.connect(deviceId);
      } catch (regError) {
        print('❌ [DEBUG] Device registration failed: $regError');
      }
    } catch (deviceError) {
      // Device registration failed, but don't block login
      print('Device registration background error: $deviceError');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('TVF DX Login'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.phone_android,
                size: 80,
                color: Colors.blue,
              ),
              const SizedBox(height: 32),
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your email';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _passwordController,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your password';
                  }
                  return null;
                },
              ),
              if (_errorMessage != null) ...[
                const SizedBox(height: 16),
                Text(
                  _errorMessage!,
                  style: const TextStyle(color: Colors.red),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  child: _isLoading
                      ? const CircularProgressIndicator()
                      : const Text('Login'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

