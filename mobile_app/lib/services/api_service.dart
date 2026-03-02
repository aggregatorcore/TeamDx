import 'dart:convert';
import 'package:http/http.dart' as http;
import '../utils/constants.dart';
import '../utils/storage.dart';
import '../models/call_event.dart';
import '../models/user.dart';
import '../models/device_info.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String get baseUrl => ApiConstants.baseUrl;

  Future<Map<String, String>> _getHeaders() async {
    final token = Storage.getString(StorageKeys.token);
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> _handleResponse(http.Response response) async {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        return {};
      }
      try {
        return json.decode(response.body);
      } catch (e) {
        throw Exception('Invalid response format from server');
      }
    } else {
      try {
        final errorBody = json.decode(response.body);
        final errorMessage = errorBody['error'] ?? errorBody['message'] ?? 'Request failed';
        throw Exception(errorMessage);
      } catch (e) {
        if (response.statusCode == 401) {
          throw Exception('Invalid credentials. Please check your email and password.');
        } else if (response.statusCode == 403) {
          throw Exception('Access denied. Please contact administrator.');
        } else if (response.statusCode >= 500) {
          throw Exception('Server error. Please try again later.');
        } else {
          throw Exception('Request failed with status ${response.statusCode}');
        }
      }
    }
  }

  // Auth
  Future<Map<String, dynamic>> login(String email, String password) async {
    // Debug: Log actual URL being used
    final baseUrlValue = baseUrl;
    final endpointValue = ApiConstants.loginEndpoint;
    final urlString = '$baseUrlValue$endpointValue';
    
    // CRITICAL DEBUG: Log URL configuration
    print('🔵 [API] Login Request - Base URL: $baseUrlValue');
    print('🔵 [API] Login Request - Endpoint: $endpointValue');
    print('🔵 [API] Login Request - Full URL String: $urlString');
    
    // Validate URL format
    if (!urlString.startsWith('http://')) {
      print('❌ [API] Invalid URL format: $urlString');
      throw Exception('Invalid URL format: $urlString');
    }
    
    final uri = Uri.parse(urlString);
    print('🔵 [API] Login Request - Parsed URI: $uri');
    print('🔵 [API] Login Request - URI Scheme: ${uri.scheme}');
    print('🔵 [API] Login Request - URI Host: ${uri.host}');
    print('🔵 [API] Login Request - URI Port: ${uri.port}');
    print('🔵 [API] Login Request - URI Path: ${uri.path}');
    
    try {
      print('🔵 [API] Attempting login request to: $uri');
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': email, 'password': password}),
      ).timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          print('❌ [API] Login request timed out after 30 seconds');
          throw Exception('Connection timeout. Please check your internet connection and try again.');
        },
      );
      print('✅ [API] Login response received - Status: ${response.statusCode}');

      final data = await _handleResponse(response);
      
      // Store token and user
      if (data['token'] != null) {
        await Storage.setString(StorageKeys.token, data['token']);
      }
      if (data['user'] != null) {
        await Storage.setString(StorageKeys.user, json.encode(data['user']));
      }

      return data;
    } catch (e) {
      // CRITICAL DEBUG: Log the actual error
      print('❌ [API] Login error occurred: ${e.toString()}');
      print('❌ [API] Error type: ${e.runtimeType}');
      if (e is Exception) {
        print('❌ [API] Exception message: ${e.toString()}');
      }
      
      // Re-throw with better error message for network issues
      if (e.toString().contains('timeout') || e.toString().contains('Connection')) {
        print('❌ [API] Network/connection error detected');
        throw Exception('Unable to connect to server. Please check your internet connection.');
      }
      rethrow;
    }
  }

  // Device Registration
  Future<Map<String, dynamic>> registerDevice(DeviceInfo deviceInfo) async {
    try {
      final payload = deviceInfo.toJson();
      print('📱 [DEBUG] Registering device with payload: $payload');
      
      final response = await http.post(
        Uri.parse('$baseUrl${ApiConstants.registerDeviceEndpoint}'),
        headers: await _getHeaders(),
        body: json.encode(payload),
      ).timeout(const Duration(seconds: 30));
      
      print('📱 [DEBUG] Device registration response: ${response.statusCode} - ${response.body}');

      return await _handleResponse(response);
    } catch (e) {
      print('❌ [DEBUG] Device registration error: $e');
      rethrow;
    }
  }

  // Heartbeat
  Future<Map<String, dynamic>> sendHeartbeat(String deviceId) async {
    final response = await http.post(
      Uri.parse('$baseUrl${ApiConstants.heartbeatEndpoint}'),
      headers: await _getHeaders(),
      body: json.encode({'deviceId': deviceId}),
    ).timeout(const Duration(seconds: 10));

    return await _handleResponse(response);
  }

  // Call Logging
  Future<Map<String, dynamic>> logCall(CallEvent callEvent, String deviceId) async {
    // FIX 1: Validate callId before sending
    if (callEvent.callId == null || callEvent.callId!.isEmpty) {
      print('❌ [API Service] Skipping logCall - callId is missing');
      throw Exception('callId is required for call logging');
    }

    // Determine state string for API
    String state = 'ended';
    if (callEvent.state == CallState.ringing) {
      state = 'ringing';
    } else if (callEvent.state == CallState.offhook) {
      state = 'connected';
    } else if (callEvent.state == CallState.idle && callEvent.endTime != null) {
      state = 'ended';
    }

    // V2: Map rejected status to missed
    // FIX: Default to missed/no_answer if wasConnected is false (call not answered)
    String status = 'missed'; // FIX: Default to missed instead of completed
    if (callEvent.wasConnected == false || callEvent.connectTime == null) {
      // FIX: If call was not answered (wasConnected false or connectTime null), status = missed/no_answer
      if (callEvent.type == CallType.incoming) {
        status = 'missed';
      } else {
        status = 'no_answer';
      }
      print('🔄 [API Service] Call not answered - wasConnected=${callEvent.wasConnected}, connectTime=${callEvent.connectTime}, setting status=$status');
    } else if (callEvent.status == CallStatus.rejected) {
      status = 'missed';
      print('🔄 [API Service] Mapping rejected status to missed (V2 standard)');
    } else if (callEvent.status != null) {
      // Map other statuses
      if (callEvent.status == CallStatus.missed) {
        status = 'missed';
      } else if (callEvent.status == CallStatus.noAnswer) {
        status = 'no_answer';
      } else if (callEvent.status == CallStatus.busy) {
        status = 'busy';
      } else if (callEvent.status == CallStatus.connected) {
        status = 'completed'; // V2: Map connected to completed (only if wasConnected = true)
      }
    } else {
      // Use effectiveStatus if status is null
      final effectiveStatus = callEvent.effectiveStatus;
      if (effectiveStatus == CallStatus.missed || effectiveStatus == CallStatus.rejected) {
        status = 'missed';
      } else if (effectiveStatus == CallStatus.noAnswer) {
        status = 'no_answer';
      } else if (effectiveStatus == CallStatus.busy) {
        status = 'busy';
      } else if (effectiveStatus == CallStatus.connected && callEvent.wasConnected == true) {
        status = 'completed'; // V2: Map connected to completed (only if wasConnected = true)
      } else {
        // FIX: Default to missed/no_answer if not connected
        if (callEvent.type == CallType.incoming) {
          status = 'missed';
        } else {
          status = 'no_answer';
        }
      }
    }

    final payload = {
      'phoneNumber': callEvent.phoneNumber,
      'callType': callEvent.type.name,
      'state': state,
      'status': status, // V2: Send mapped status
      'startTime': callEvent.startTime?.toIso8601String(),
      'connectTime': callEvent.connectTime?.toIso8601String(),
      'endTime': callEvent.endTime?.toIso8601String(),
      'duration': callEvent.duration,
      'wasConnected': callEvent.wasConnected ?? false,
      'recordingPath': callEvent.recordingPath,
      'deviceId': deviceId,
      'callId': callEvent.callId, // FIX 1: Ensure callId is included in payload
    };

    final response = await http.post(
      Uri.parse('$baseUrl${ApiConstants.callLogEndpoint}'),
      headers: await _getHeaders(),
      body: json.encode(payload),
    ).timeout(const Duration(seconds: 30));

    return await _handleResponse(response);
  }

  // Lead Search
  Future<Map<String, dynamic>> searchLeadByPhone(String phone) async {
    final response = await http.get(
      Uri.parse('$baseUrl${ApiConstants.searchLeadEndpoint}?phone=${Uri.encodeComponent(phone)}'),
      headers: await _getHeaders(),
    ).timeout(const Duration(seconds: 30));

    return await _handleResponse(response);
  }

  // Auto-create Lead
  Future<Map<String, dynamic>> autoCreateLead(String phone, {String? source}) async {
    final response = await http.post(
      Uri.parse('$baseUrl${ApiConstants.autoCreateLeadEndpoint}'),
      headers: await _getHeaders(),
      body: json.encode({
        'phone': phone,
        'source': source ?? 'incoming_call',
      }),
    ).timeout(const Duration(seconds: 30));

    return await _handleResponse(response);
  }

  // Create Lead with full details
  Future<Map<String, dynamic>> createLead(Map<String, dynamic> leadData) async {
    final response = await http.post(
      Uri.parse('$baseUrl${ApiConstants.createLeadEndpoint}'),
      headers: await _getHeaders(),
      body: json.encode(leadData),
    ).timeout(const Duration(seconds: 30));

    return await _handleResponse(response);
  }

  // Get my leads (assigned to current user)
  Future<List<dynamic>> getLeads({int page = 1, int limit = 50}) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/leads?page=$page&limit=$limit'),
      headers: await _getHeaders(),
    ).timeout(const Duration(seconds: 30));
    final data = await _handleResponse(response);
    if (data['leads'] is List) return data['leads'] as List<dynamic>;
    return [];
  }

  // Get single lead by id
  Future<Map<String, dynamic>> getLead(String id) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/leads/$id'),
      headers: await _getHeaders(),
    ).timeout(const Duration(seconds: 30));
    return await _handleResponse(response);
  }

  // Get my tasks
  Future<List<dynamic>> getTasks() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/tasks'),
      headers: await _getHeaders(),
    ).timeout(const Duration(seconds: 30));
    final data = await _handleResponse(response);
    if (data['tasks'] is List) return data['tasks'] as List<dynamic>;
    return [];
  }

  // Get current user (auth/me)
  Future<Map<String, dynamic>> getMe() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/auth/me'),
      headers: await _getHeaders(),
    ).timeout(const Duration(seconds: 15));
    return await _handleResponse(response);
  }

  // Logout (clear token; server may have logout endpoint too)
  Future<void> logout() async {
    await Storage.remove(StorageKeys.token);
    await Storage.remove(StorageKeys.user);
  }
}
