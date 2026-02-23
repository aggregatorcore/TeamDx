import 'package:flutter/material.dart';

/// Firebase Configuration Error Screen
/// 
/// Shows when Firebase is not properly configured
class FirebaseErrorScreen extends StatelessWidget {
  const FirebaseErrorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 64,
                color: Colors.red,
              ),
              const SizedBox(height: 24),
              Text(
                'Firebase Not Configured',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Firebase configuration is missing or invalid.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Please configure Firebase before running the app.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 32),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Setup Instructions:',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 12),
                      const Text('1. Install FlutterFire CLI:'),
                      const Text(
                        '   dart pub global activate flutterfire_cli',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text('2. Login to Firebase:'),
                      const Text(
                        '   firebase login',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text('3. Configure Firebase:'),
                      const Text(
                        '   flutterfire configure',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

