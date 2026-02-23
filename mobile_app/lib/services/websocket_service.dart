import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../utils/constants.dart';
import '../utils/storage.dart';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;
  WebSocketService._internal();

  IO.Socket? _socket;
  bool _isConnected = false;
  Function(Map<String, dynamic>)? _onCallInitiate;
  Function()? _onConnectCallback; // FIX Issue 2: Callback for connection/reconnection

  bool get isConnected => _isConnected;

  // Register callback for call:initiate event
  void setCallInitiateHandler(Function(Map<String, dynamic>) handler) {
    print('✅ [WebSocket] Call initiate handler registered');
    _onCallInitiate = handler;
  }

  // FIX Issue 2: Register callback for connection/reconnection events
  void setOnConnectCallback(Function() callback) {
    print('✅ [WebSocket] Connection callback registered');
    _onConnectCallback = callback;
  }

  void connect(String deviceId) {
    // Check if already connected
    if (_isConnected && _socket != null && _socket!.connected) {
      print('✅ WebSocket already connected, skipping...');
      // Still register device in case it wasn't registered before
      _socket!.emit('device:register', {'deviceId': deviceId});
      return;
    }

    // If socket exists but not connected, disconnect and create new one
    if (_socket != null && !_socket!.connected) {
      print('🔄 Disconnecting old socket before creating new connection...');
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }

    final token = Storage.getString(StorageKeys.token);
    if (token == null) {
      print('⚠️ No token available for WebSocket connection');
      // Retry after a short delay in case token is being stored
      Future.delayed(const Duration(seconds: 2), () {
        final retryToken = Storage.getString(StorageKeys.token);
        if (retryToken != null) {
          print('🔄 Retrying WebSocket connection after token available...');
          connect(deviceId);
        } else {
          print('❌ Token still not available after retry');
        }
      });
      return;
    }

    print('🔌 Attempting WebSocket connection to: ${ApiConstants.wsUrl}');
    print('🔑 Token available: ${token != null ? "YES (${token.substring(0, 10)}...)" : "NO"}');
    print('📱 Device ID: $deviceId');

    print('🔧 [WebSocket] Creating Socket.IO client with options...');
    print('🔧 [WebSocket] URL: ${ApiConstants.wsUrl}');
    print('🔧 [WebSocket] Token length: ${token.length}');
    
    _socket = IO.io(
      ApiConstants.wsUrl,
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling']) // Allow fallback to polling
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(999) // Keep trying to reconnect indefinitely
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .setTimeout(10000) // FIX: Reduced to 10 seconds for faster failure detection
          .build(),
    );
    
    print('🔧 [WebSocket] Socket.IO client created, waiting for connection...');
    
    // FIX: Add timeout handler to detect hanging connections
    Future.delayed(const Duration(seconds: 15), () {
      if (!_isConnected && _socket != null) {
        print('⏱️ [WebSocket] Connection timeout after 15 seconds - connection may be hanging');
        print('⏱️ [WebSocket] Socket state: connected=${_socket!.connected}, disconnected=${_socket!.disconnected}');
        print('⏱️ [WebSocket] Attempting to force disconnect and retry...');
        _socket!.disconnect();
        _socket!.dispose();
        _socket = null;
        // Retry connection
        Future.delayed(const Duration(seconds: 2), () {
          print('🔄 [WebSocket] Retrying connection after timeout...');
          connect(deviceId);
        });
      }
    });

    _socket!.onConnect((_) {
      print('✅ WebSocket connected successfully');
      print('🔗 Socket ID: ${_socket!.id}');
      final wasDisconnected = !_isConnected;
      _isConnected = true;
      
      // Register device
      _socket!.emit('device:register', {'deviceId': deviceId});
      print('📱 Device registered: $deviceId');
      
      // FIX Issue 2: Trigger offline queue sync on connection/reconnection
      if (wasDisconnected && _onConnectCallback != null) {
        print('🔄 [WebSocket] Connection restored - triggering offline queue sync...');
        _onConnectCallback!();
      }
    });

    _socket!.onDisconnect((reason) {
      print('❌ WebSocket disconnected: $reason');
      print('🔗 Socket ID was: ${_socket?.id ?? "unknown"}');
      _isConnected = false;
      
      // Auto-reconnect will be handled by socket.io client
      // But we can also manually trigger reconnection if needed
      print('🔄 WebSocket will attempt to reconnect automatically...');
    });

    _socket!.onConnectError((error) {
      print('❌ WebSocket connection error: $error');
      print('❌ Error type: ${error.runtimeType}');
      print('❌ Error details: ${error.toString()}');
      print('💡 Make sure the backend server is running at ${ApiConstants.wsUrl}');
      print('💡 Check if token is valid and backend WebSocket server is accessible');
      _isConnected = false;
    });

    _socket!.onError((error) {
      print('❌ WebSocket error: $error');
      print('❌ Error type: ${error.runtimeType}');
      print('❌ Error details: ${error.toString()}');
      _isConnected = false;
    });

    _socket!.onReconnect((attemptNumber) {
      print('🔄 WebSocket reconnecting... (attempt $attemptNumber)');
    });

    _socket!.onReconnectAttempt((attemptNumber) {
      print('🔄 WebSocket reconnection attempt $attemptNumber');
    });

    _socket!.onReconnectError((error) {
      print('❌ WebSocket reconnection error: $error');
    });

    _socket!.onReconnectFailed((_) {
      print('❌ WebSocket reconnection failed after maximum attempts');
      // Try to reconnect manually after a delay
      Future.delayed(const Duration(seconds: 5), () {
        if (!_isConnected && _socket != null) {
          print('🔄 Attempting manual reconnection...');
          _socket!.connect();
        }
      });
    });

    // Listen for call initiation requests from web
    _socket!.on('call:initiate', (data) {
      print('📞 [WebSocket] Received call initiation request: $data');
      print('📞 [WebSocket] Handler registered: ${_onCallInitiate != null}');
      print('📞 [WebSocket] Data type: ${data.runtimeType}');
      
      if (_onCallInitiate != null && data is Map<String, dynamic>) {
        print('✅ [WebSocket] Calling handler with data: $data');
        try {
          _onCallInitiate!(data);
        } catch (e) {
          print('❌ [WebSocket] Error in handler: $e');
        }
      } else {
        if (_onCallInitiate == null) {
          print('⚠️ [WebSocket] No call initiate handler registered');
        } else {
          print('⚠️ [WebSocket] Data is not Map<String, dynamic>, got: ${data.runtimeType}');
        }
      }
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
  }

  void emit(String event, Map<String, dynamic> data) {
    if (_isConnected && _socket != null) {
      _socket!.emit(event, data);
    }
  }

  void on(String event, Function(dynamic) handler) {
    _socket?.on(event, handler);
  }
}

