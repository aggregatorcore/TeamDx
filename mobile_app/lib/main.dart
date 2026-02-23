import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'utils/storage.dart';
import 'utils/app_config.dart';

void main() async {
  print('🚀 [MOBILE APP] main() started - ${DateTime.now().toIso8601String()}');
  
  // Initialize Flutter binding first (non-blocking)
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize storage (necessary, but fast)
  await Storage.init();
  print('✅ [MOBILE APP] Storage initialized');
  
  // Print app configuration
  AppConfig.printConfig();
  
  // Start app immediately
  print('🎬 [MOBILE APP] Running app...');
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TVF DX Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final token = Storage.getString('auth_token');
    final hasToken = token != null && token.isNotEmpty;

    if (hasToken) {
      return const HomeScreen();
    } else {
      return const LoginScreen();
    }
  }
}
