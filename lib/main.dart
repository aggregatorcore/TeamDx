import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/firebase/firebase_options.dart';
import 'routing/app_router.dart';
import 'core/widgets/firebase_error_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    final options = DefaultFirebaseOptions.currentPlatform;
    
    // Check for placeholder values before initialization
    final hasPlaceholder = options.apiKey == 'YOUR_API_KEY' || 
                          options.projectId == 'YOUR_PROJECT_ID' ||
                          options.appId == 'YOUR_APP_ID';
    
    if (hasPlaceholder) {
      debugPrint('⚠️ Firebase is not configured. Please run: flutterfire configure');
      // Continue anyway - app will show error in UI
    }
    
    await Firebase.initializeApp(
      options: options,
    );
  } catch (e, stackTrace) {
    // Handle Firebase initialization errors
    debugPrint('❌ Firebase initialization error: $e');
    debugPrint('Stack trace: $stackTrace');
    // Continue - app will handle gracefully
  }
  
  runApp(
    const ProviderScope(
      child: MyDxApp(),
    ),
  );
}

class MyDxApp extends ConsumerWidget {
  const MyDxApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Check if Firebase is configured
    final options = DefaultFirebaseOptions.currentPlatform;
    final isFirebaseConfigured = options.apiKey != 'YOUR_API_KEY' && 
                                 options.projectId != 'YOUR_PROJECT_ID' &&
                                 options.appId != 'YOUR_APP_ID';
    
    // Show error screen if Firebase not configured
    if (!isFirebaseConfigured) {
      return MaterialApp(
        title: 'MY DX - Operations',
        debugShowCheckedModeBanner: false,
        home: const FirebaseErrorScreen(),
      );
    }
    
    final router = ref.watch(routerProvider);
    
    // Set router for static access
    AppRouter.setRouter(router);

    return MaterialApp.router(
      title: 'MY DX - Operations',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      routerConfig: router,
    );
  }
}
