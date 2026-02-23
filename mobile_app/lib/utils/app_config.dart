/// App Configuration - Environment-based settings
/// 
/// HARDCODED: Always uses http://localhost:5000 for physical device builds
/// ADB reverse required: adb reverse tcp:5000 tcp:5000
/// 
/// Supports:
/// - Physical Device (USB): http://localhost:5000 (hardcoded)
/// - Development/Production environments

enum AppEnvironment {
  development,
  production,
}

enum DeviceType {
  emulator, // Android Emulator
  physical, // Physical Device
}

class AppConfig {
  // Environment
  static const AppEnvironment environment = AppEnvironment.development;
  
  // Device Type - Change this based on where you're running the app
  // Set to DeviceType.emulator for Android Emulator
  // Set to DeviceType.physical for Physical Device
  static const DeviceType deviceType = DeviceType.emulator;
  
  // Docker Backend Configuration
  // For Android Emulator: 10.0.2.2 maps to host machine's localhost
  // For Physical Device: Use your computer's IP address (e.g., 192.168.x.x)
  static const String dockerHostIp = '192.168.29.158'; // Change this to your Docker host IP
  static const int backendPort = 5000;
  
  // API Base URL
  // Returns properly formatted URL: http://host:port (no trailing slash)
  // HARDCODED: Force localhost for physical device builds (ADB reverse required)
  // Use: adb reverse tcp:5000 tcp:5000
  static String get apiBaseUrl {
    // HARDCODE: Always use localhost for physical device builds
    // ADB reverse must be set up: adb reverse tcp:5000 tcp:5000
    String url = 'http://localhost:$backendPort';
    // Ensure URL is properly formatted (no trailing slash, correct protocol)
    url = url.trim();
    
    // CRITICAL: Force http:// protocol (never https://)
    if (url.startsWith('https://')) {
      url = url.replaceFirst('https://', 'http://');
      print('⚠️ [AppConfig] WARNING: URL had https://, changed to http://');
    }
    if (!url.startsWith('http://')) {
      url = 'http://$url';
    }
    
    // Validate URL format - throw error if malformed
    if (url.contains('https//') || url.contains('http//')) {
      throw Exception('CRITICAL: Malformed URL detected: $url (missing colon in protocol)');
    }
    
    // Remove trailing slash if present
    if (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    
    // Final validation
    if (!url.startsWith('http://')) {
      throw Exception('CRITICAL: Invalid URL format: $url (must start with http://)');
    }
    
    return url;
  }
  
  // WebSocket URL (same as API base URL)
  // Socket.IO client expects URL without trailing slash
  static String get socketUrl {
    final url = apiBaseUrl;
    // Ensure no trailing slash for Socket.IO
    return url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }
  
  // Environment-specific settings
  static bool get isDevelopment => environment == AppEnvironment.development;
  static bool get isProduction => environment == AppEnvironment.production;
  
  // Debug logging
  static bool get enableDebugLogs => isDevelopment;
  
  // Print configuration on app start
  static void printConfig() {
    print('📱 [AppConfig] Environment: ${environment.name}');
    print('📱 [AppConfig] Device Type: ${deviceType.name}');
    print('📱 [AppConfig] API Base URL: $apiBaseUrl');
    print('📱 [AppConfig] Socket URL: $socketUrl');
    print('📱 [AppConfig] Docker Host IP: $dockerHostIp');
    print('📱 [AppConfig] Backend Port: $backendPort');
  }
}


