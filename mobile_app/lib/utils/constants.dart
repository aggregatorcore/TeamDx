import 'app_config.dart';

class ApiConstants {
  // API Base URL - Uses environment-based configuration
  // Automatically switches between emulator and physical device
  static String get baseUrl => AppConfig.apiBaseUrl;
  
  // WebSocket URL - Same as API base URL
  static String get wsUrl => AppConfig.socketUrl;
  
  // API Endpoints
  static const String loginEndpoint = '/api/auth/login';
  static const String registerDeviceEndpoint = '/api/mobile/register';
  static const String heartbeatEndpoint = '/api/mobile/heartbeat';
  static const String mobileStatusEndpoint = '/api/mobile/status';
  static const String callLogEndpoint = '/api/calls/mobile/log';
  static const String searchLeadEndpoint = '/api/leads/search-by-phone';
  static const String autoCreateLeadEndpoint = '/api/leads/auto-create';
  static const String createLeadEndpoint = '/api/leads';
}

class StorageKeys {
  static const String token = 'auth_token';
  static const String user = 'user_data';
  static const String deviceId = 'device_id';
}

class CallConstants {
  static const int heartbeatInterval = 30; // seconds
  static const int offlineQueueMaxSize = 100;
}

