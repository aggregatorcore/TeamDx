import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

/// Firebase Initialization Service
/// 
/// Handles Firebase initialization with proper error handling.
/// Keeps Firebase configuration logic separate from UI.
class FirebaseService {
  static bool _initialized = false;
  static String? _error;

  /// Initialize Firebase
  /// 
  /// Returns true if initialization was successful, false otherwise.
  /// Check [error] for details if initialization fails.
  static Future<bool> initialize() async {
    if (_initialized) {
      return true;
    }

    try {
      // Validate Firebase configuration before initialization
      _validateConfiguration();

      // Initialize Firebase
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );

      _initialized = true;
      _error = null;
      return true;
    } on FirebaseException catch (e) {
      _error = 'Firebase initialization failed: ${e.message}';
      return false;
    } catch (e) {
      _error = 'Failed to initialize Firebase: $e';
      return false;
    }
  }

  /// Validate Firebase configuration
  /// 
  /// Throws [Exception] if configuration is invalid or missing.
  static void _validateConfiguration() {
    final options = DefaultFirebaseOptions.currentPlatform;

    // Check for placeholder values (indicates configuration not done)
    if (options.apiKey == 'YOUR_API_KEY' ||
        options.appId == 'YOUR_APP_ID' ||
        options.projectId == 'YOUR_PROJECT_ID') {
      throw Exception(
        'Firebase is not configured. Please run "flutterfire configure" '
        'or update firebase_options.dart with your Firebase configuration.',
      );
    }

    // Validate required fields for web
    if (options.apiKey.isEmpty ||
        options.appId.isEmpty ||
        options.projectId.isEmpty) {
      throw Exception(
        'Firebase configuration is incomplete. Please check firebase_options.dart',
      );
    }
  }

  /// Get initialization error message
  static String? get error => _error;

  /// Check if Firebase is initialized
  static bool get isInitialized => _initialized;

  /// Reset initialization state (for testing)
  static void reset() {
    _initialized = false;
    _error = null;
  }
}

