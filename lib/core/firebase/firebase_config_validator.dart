import 'firebase_options.dart';
import 'package:firebase_core/firebase_core.dart';

/// Firebase Configuration Validator
/// 
/// Validates Firebase configuration before app starts.
/// Keeps configuration validation logic separate from UI.
class FirebaseConfigValidator {
  /// Check if Firebase is properly configured
  /// 
  /// Returns true if configuration is valid, false otherwise.
  static bool isConfigured() {
    try {
      final options = DefaultFirebaseOptions.currentPlatform;
      
      // Check for placeholder values (indicates configuration not done)
      if (options.apiKey == 'YOUR_API_KEY' ||
          options.appId == 'YOUR_APP_ID' ||
          options.projectId == 'YOUR_PROJECT_ID') {
        return false;
      }

      // Validate required fields are not empty
      if (options.apiKey.isEmpty ||
          options.appId.isEmpty ||
          options.projectId.isEmpty) {
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /// Get configuration error message
  static String getConfigurationError() {
    if (!isConfigured()) {
      return 'Firebase is not configured. Please run "flutterfire configure" '
          'or update firebase_options.dart with your Firebase configuration.';
    }
    return '';
  }
}

