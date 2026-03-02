/// App Configuration - Environment-based settings
///
/// - Production: Set [apiBaseUrlOverride] (e.g. Render backend) or build with --dart-define=API_BASE_URL=https://...
/// - Development: Uses localhost:5000 (ADB reverse: adb reverse tcp:5000 tcp:5000)

enum AppEnvironment {
  development,
  production,
}

enum DeviceType {
  emulator,
  physical,
}

class AppConfig {
  static const AppEnvironment environment = AppEnvironment.development;
  static const DeviceType deviceType = DeviceType.emulator;
  static const String dockerHostIp = '192.168.29.158';
  static const int backendPort = 5000;

  /// Override for production: set to your backend URL (e.g. https://tvf-dx-api.onrender.com)
  static const String? apiBaseUrlOverride = null; // Set for release build or use --dart-define=API_BASE_URL=...

  /// Android emulator: use 10.0.2.2 to reach host machine's localhost.
  static const String _emulatorHost = '10.0.2.2';

  static String get apiBaseUrl {
    const urlFromDefine = String.fromEnvironment('API_BASE_URL', defaultValue: '');
    if (urlFromDefine.isNotEmpty) {
      return _normalizeUrl(urlFromDefine);
    }
    if (apiBaseUrlOverride != null && apiBaseUrlOverride!.isNotEmpty) {
      return _normalizeUrl(apiBaseUrlOverride!);
    }
    // Emulator: 10.0.2.2 = host PC. Physical device: use PC's LAN IP (same WiFi).
    String host = deviceType == DeviceType.emulator ? _emulatorHost : dockerHostIp;
    String url = 'http://$host:$backendPort';
    return _normalizeUrl(url);
  }

  static String _normalizeUrl(String url) {
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://$url';
    }
    if (url.contains('https//') || url.contains('http//')) {
      throw Exception('Malformed URL: $url');
    }
    if (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
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


