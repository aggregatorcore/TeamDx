import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/call_state_service.dart';
import '../services/api_service.dart';
import '../models/call_event.dart';
import '../models/lead.dart';
import '../utils/storage.dart';
import '../widgets/new_lead_dialog.dart';
import 'call_detail_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final CallStateService _callStateService = CallStateService();
  final ApiService _apiService = ApiService();
  final List<CallEvent> _recentCalls = [];
  bool _isInitialized = false;
  String? _status;
  static const String _callLogsKey = 'call_logs';
  bool _isDisposed = false;
  StreamSubscription<LeadDialogEvent>? _leadDialogSubscription;
  CallEvent? _currentIncomingCall;  // Track current incoming call

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadSavedCallLogs();
    _initializeService();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // App is going to background - save call logs
      // Note: Heartbeat will continue running in background (Timer.periodic works in background)
      print('📱 App going to background - saving call logs');
      _saveCallLogs();
    } else if (state == AppLifecycleState.resumed) {
      // App is coming back to foreground - reload call logs and restart heartbeat if needed
      print('📱 App resumed - reloading call logs and checking heartbeat');
      _loadSavedCallLogs();
      // Restart heartbeat if it stopped while in background
      _callStateService.restartHeartbeatIfNeeded();
      // FIX Issue 2: Sync offline queue when app resumes (e.g., after screen unlock)
      print('🔄 App resumed - syncing offline call queue...');
      _callStateService.syncOfflineQueue().catchError((e) {
        print('⚠️ Error syncing offline queue on resume: $e');
      });
    }
  }

  Future<void> _loadSavedCallLogs() async {
    try {
      final savedLogsJson = Storage.getStringList(_callLogsKey);
      if (savedLogsJson != null && savedLogsJson.isNotEmpty) {
        final loadedCalls = savedLogsJson.map((jsonStr) {
          try {
            return CallEvent.fromJson(json.decode(jsonStr));
          } catch (e) {
            print('Error parsing call log: $e');
            return null;
          }
        }).whereType<CallEvent>().toList();
        
        // Merge with existing logs (avoid duplicates by timestamp and phone number)
        final existingPhones = _recentCalls.map((c) => '${c.phoneNumber}_${c.timestamp.toIso8601String()}').toSet();
        final newCalls = loadedCalls.where((call) {
          final key = '${call.phoneNumber}_${call.timestamp.toIso8601String()}';
          return !existingPhones.contains(key);
        }).toList();
        
        if (mounted && !_isDisposed) {
          setState(() {
            _recentCalls.addAll(newCalls);
            // Sort by timestamp (newest first)
            _recentCalls.sort((a, b) => b.timestamp.compareTo(a.timestamp));
            // Keep only last 50
            if (_recentCalls.length > 50) {
              _recentCalls.removeRange(50, _recentCalls.length);
            }
          });
        }
      }
    } catch (e) {
      print('Error loading saved call logs: $e');
    }
  }

  Future<void> _saveCallLogs() async {
    try {
      // Save last 50 call logs
      final logsToSave = _recentCalls.take(50).toList();
      final logsJson = logsToSave.map((call) => json.encode(call.toJson())).toList();
      await Storage.setStringList(_callLogsKey, logsJson);
    } catch (e) {
      print('Error saving call logs: $e');
    }
  }

  StreamSubscription<CallEvent>? _callEventSubscription;

  Future<void> _initializeService() async {
    // Show UI immediately, initialize in background
    if (mounted && !_isDisposed) {
      setState(() {
        _isInitialized = false;
        _status = 'Initializing...';
      });
    }
    
    try {
      print('🔵 [MOBILE APP] Home screen: Starting initialization...');
      
      // Initialize in background (don't block UI)
      _callStateService.initialize().timeout(
        const Duration(seconds: 60),
        onTimeout: () {
          print('❌ [MOBILE APP] Initialization timeout after 60 seconds');
          throw TimeoutException('Initialization timeout');
        },
      ).then((_) async {
        print('✅ [MOBILE APP] Home screen: Initialization successful');
        
        // Cancel existing subscriptions if any
        await _callEventSubscription?.cancel();
        await _leadDialogSubscription?.cancel();
        
        // Listen to call events
      _callEventSubscription = _callStateService.callEvents?.listen((event) {
        if (mounted && !_isDisposed) {
          setState(() {
            // Track incoming calls for notification
            if (event.type == CallType.incoming && event.state == CallState.ringing) {
              _currentIncomingCall = event;
              // Show notification for incoming call
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Row(
                    children: [
                      const Icon(Icons.phone, color: Colors.white),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Incoming call from ${event.phoneNumber}',
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                  backgroundColor: Colors.blue,
                  duration: const Duration(seconds: 3),
                ),
              );
            } else if (event.state == CallState.offhook || event.state == CallState.idle) {
              // Clear incoming call indicator when call connects or ends
              _currentIncomingCall = null;
            }
            
            _recentCalls.insert(0, event);
            if (_recentCalls.length > 50) {
              _recentCalls.removeLast();
            }
            // Save to local storage whenever a new call is added
            _saveCallLogs();
          });
        }
      });

      // Listen to lead dialog events
      _leadDialogSubscription = _callStateService.leadDialogEvents?.listen((dialogEvent) {
        if (mounted && !_isDisposed) {
          _showLeadDialog(
            dialogEvent.phoneNumber,
            dialogEvent.callEvent,
            dialogEvent.existingLead,
            dialogEvent.assignedToOther,
          );
        }
      });

        if (mounted && !_isDisposed) {
          setState(() {
            _isInitialized = true;
            _status = '✅ Service Active';
          });
          print('✅ [MOBILE APP] Home screen: UI updated, initialization complete');
        }
      }).catchError((e) {
        print('❌ [MOBILE APP] Home screen: Initialization error: $e');
        if (mounted && !_isDisposed) {
          setState(() {
            _isInitialized = false;
            _status = '❌ Initialization Failed: ${e.toString()}';
          });
        }
        // For Future<void>, catchError handler should return void (implicit)
        return;
        // Show error to user
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Initialization failed: ${e.toString()}'),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 5),
            ),
          );
        }
      });
    } catch (e) {
      print('❌ [MOBILE APP] Home screen: Unexpected error: $e');
      if (mounted && !_isDisposed) {
        setState(() {
          _isInitialized = false;
          _status = '❌ Error: ${e.toString()}';
        });
      }
    } catch (e) {
      if (mounted && !_isDisposed) {
        setState(() {
          _status = 'Error: ${e.toString()}';
        });
      }
    }
  }

  void _showLeadDialog(
    String phoneNumber,
    CallEvent callEvent,
    Lead? existingLead,
    AssignedUser? assignedToOther,
  ) {
    if (!mounted || _isDisposed) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return NewLeadDialog(
          phoneNumber: phoneNumber,
          callEvent: callEvent,
          existingLead: existingLead,
          assignedToOther: assignedToOther,
          onCreateLead: (leadData) async {
            try {
              await _apiService.createLead(leadData);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Lead created/updated successfully'),
                    backgroundColor: Colors.green,
                  ),
                );
              }
            } catch (e) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Error creating lead: ${e.toString()}'),
                    backgroundColor: Colors.red,
                  ),
                );
              }
            }
          },
          onSkip: () {
            // User skipped creating/updating lead
            print('User skipped lead creation for: $phoneNumber');
          },
        );
      },
    );
  }

  Future<void> _handleLogout() async {
    // Save call logs before logout (optional - can remove if you want to clear logs on logout)
    await _saveCallLogs();
    
    // Clear storage (removes token and user data)
    await Storage.clear();
    
    // Dispose service only on explicit logout
    _callStateService.dispose();
    
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  String _formatDuration(int? seconds) {
    if (seconds == null || seconds == 0) return '';
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${mins}:${secs.toString().padLeft(2, '0')}';
  }

  String _formatCallTime(DateTime dateTime) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final callDate = DateTime(dateTime.year, dateTime.month, dateTime.day);
    
    if (callDate == today) {
      return DateFormat('h:mm a').format(dateTime);
    } else if (callDate == today.subtract(const Duration(days: 1))) {
      return 'Yesterday';
    } else {
      return DateFormat('MMM d').format(dateTime);
    }
  }

  String _getCallStatusText(CallEvent call) {
    // If call was connected and has duration, show duration with call type
    if (call.wasConnectedCheck && call.duration != null && call.duration! > 0) {
      final durationText = _formatDuration(call.duration);
      final typeText = call.type == CallType.incoming ? 'Incoming' : 'Outgoing';
      return '$durationText ($typeText)';
    }
    switch (call.effectiveStatus) {
      case CallStatus.connected:
        if (call.duration != null && call.duration! > 0) {
          final durationText = _formatDuration(call.duration);
          final typeText = call.type == CallType.incoming ? 'Incoming' : 'Outgoing';
          return '$durationText ($typeText)';
        }
        final typeText = call.type == CallType.incoming ? 'Incoming' : 'Outgoing';
        return 'Connected ($typeText)';
      case CallStatus.missed:
        return 'Missed Call';
      case CallStatus.rejected:
        return 'Rejected';
      case CallStatus.noAnswer:
        return 'Not Connected';
      case CallStatus.busy:
        return 'Busy';
      case CallStatus.cancelled:
        return 'Cancelled';
      default:
        return '';
    }
  }

  Color _getCallStatusColor(CallEvent call) {
    // Green for connected calls
    if (call.wasConnectedCheck) {
      return Colors.green;
    }
    // Red for missed/not connected
    return Colors.red;
  }

  IconData _getCallIcon(CallEvent call) {
    if (call.type == CallType.incoming) {
      if (call.wasConnectedCheck) {
        return Icons.call_received;
      } else {
        return Icons.call_missed;
      }
    } else {
      if (call.wasConnectedCheck) {
        return Icons.call_made;
      } else {
        return Icons.call_end;
      }
    }
  }

  Color _getCallIconColor(CallEvent call) {
    // Green for connected calls (both incoming and outgoing)
    if (call.wasConnectedCheck) {
      return Colors.green;
    }
    // Red for not connected/missed
    return Colors.red;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('TVF DX Mobile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: Column(
        children: [
          // Incoming Call Banner
          if (_currentIncomingCall != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.blue,
              child: Row(
                children: [
                  const Icon(Icons.phone, color: Colors.white),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Incoming Call',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          _currentIncomingCall!.phoneNumber,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          
          // Status Card
          Card(
            margin: const EdgeInsets.all(16),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        _isInitialized ? Icons.check_circle : Icons.error,
                        color: _isInitialized ? Colors.green : Colors.red,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _status ?? 'Initializing...',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Call tracking is ${_isInitialized ? "active" : "inactive"}',
                    style: TextStyle(
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          // Recent Calls Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Recent Calls',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (_recentCalls.isNotEmpty)
                  Text(
                    '${_recentCalls.length}',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
              ],
            ),
          ),
          
          Expanded(
            child: _recentCalls.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.call_outlined,
                          size: 64,
                          color: Colors.grey[400],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No calls yet',
                          style: TextStyle(
                            fontSize: 18,
                            color: Colors.grey[600],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Call history will appear here',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[500],
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    itemCount: _recentCalls.length,
                    separatorBuilder: (context, index) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final call = _recentCalls[index];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        leading: CircleAvatar(
                          radius: 24,
                          backgroundColor: _getCallIconColor(call).withOpacity(0.1),
                          child: Icon(
                            _getCallIcon(call),
                            color: _getCallIconColor(call),
                            size: 24,
                          ),
                        ),
                        title: Text(
                          call.phoneNumber,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                // Show arrow for incoming calls
                                if (call.type == CallType.incoming)
                                  Icon(
                                    Icons.arrow_downward,
                                    size: 14,
                                    color: call.wasConnectedCheck ? Colors.green : Colors.red,
                                  ),
                                // Show arrow for outgoing calls
                                if (call.type == CallType.outgoing)
                                  Icon(
                                    Icons.arrow_upward,
                                    size: 14,
                                    color: call.wasConnectedCheck ? Colors.green : Colors.red,
                                  ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    _getCallStatusText(call),
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: _getCallStatusColor(call),
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                                // Show recording icon if recording exists
                                if (call.recordingPath != null && call.recordingPath!.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(left: 8),
                                    child: Icon(
                                      Icons.mic,
                                      size: 16,
                                      color: Colors.red,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              _formatCallTime(call.timestamp),
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[600],
                              ),
                            ),
                            if (call.wasConnectedCheck && call.duration != null && call.duration! > 0) ...[
                              const SizedBox(height: 4),
                              Text(
                                _formatDuration(call.duration),
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey[500],
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ],
                        ),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (context) => CallDetailScreen(
                                callEvent: call,
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _isDisposed = true;
    WidgetsBinding.instance.removeObserver(this);
    // Cancel subscriptions
    _callEventSubscription?.cancel();
    _leadDialogSubscription?.cancel();
    // Save call logs one final time before disposing
    _saveCallLogs();
    // Only dispose service when widget is actually being removed (logout)
    // Don't dispose on app background - keep service running
    // _callStateService.dispose(); // Commented out - service should persist
    super.dispose();
  }
}

