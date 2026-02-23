import 'package:flutter/material.dart';
import '../models/call_event.dart';
import '../services/audio_player_service.dart';
import 'dart:async';
import 'package:intl/intl.dart';

class CallDetailScreen extends StatefulWidget {
  final CallEvent callEvent;
  final String? contactName; // Optional: can be fetched from lead

  const CallDetailScreen({
    Key? key,
    required this.callEvent,
    this.contactName,
  }) : super(key: key);

  @override
  State<CallDetailScreen> createState() => _CallDetailScreenState();
}

class _CallDetailScreenState extends State<CallDetailScreen> {
  final AudioPlayerService _audioPlayer = AudioPlayerService();
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration>? _durationSubscription;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _audioPlayer.initialize();
    _positionSubscription = _audioPlayer.positionStream?.listen((position) {
      if (mounted) {
        setState(() {
          _position = position;
        });
      }
    });
    _durationSubscription = _audioPlayer.durationStream?.listen((duration) {
      if (mounted) {
        setState(() {
          _duration = duration;
        });
      }
    });
    _isInitialized = true;
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    _durationSubscription?.cancel();
    _audioPlayer.dispose();
    super.dispose();
  }

  void _togglePlayback() {
    if (widget.callEvent.recordingPath == null || widget.callEvent.recordingPath!.isEmpty) {
      return;
    }

    if (_audioPlayer.isPlaying) {
      _audioPlayer.pause();
    } else {
      if (_audioPlayer.currentPath == widget.callEvent.recordingPath) {
        _audioPlayer.resume();
      } else {
        _audioPlayer.play(widget.callEvent.recordingPath!);
      }
    }
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    
    if (hours > 0) {
      return '${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}';
    }
    return '${twoDigits(minutes)}:${twoDigits(seconds)}';
  }

  String _formatCallDuration(int? seconds) {
    if (seconds == null || seconds == 0) return 'Not connected';
    final hours = seconds ~/ 3600;
    final mins = (seconds % 3600) ~/ 60;
    final secs = seconds % 60;
    
    if (hours > 0) {
      return '${hours}h ${mins}m ${secs}s';
    } else if (mins > 0) {
      return '${mins}m ${secs}s';
    } else {
      return '${secs}s';
    }
  }

  String _formatDateTime(DateTime dateTime) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final callDate = DateTime(dateTime.year, dateTime.month, dateTime.day);
    
    if (callDate == today) {
      return 'Today, ${DateFormat('h:mm a').format(dateTime)}';
    } else if (callDate == today.subtract(const Duration(days: 1))) {
      return 'Yesterday, ${DateFormat('h:mm a').format(dateTime)}';
    } else {
      return DateFormat('MMM d, y h:mm a').format(dateTime);
    }
  }

  String _getStatusText() {
    switch (widget.callEvent.effectiveStatus) {
      case CallStatus.connected:
        final typeText = widget.callEvent.type == CallType.incoming ? 'Incoming' : 'Outgoing';
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
    }
  }

  IconData _getStatusIcon() {
    switch (widget.callEvent.effectiveStatus) {
      case CallStatus.connected:
        return Icons.check_circle;
      case CallStatus.missed:
        return Icons.phone_missed;
      case CallStatus.rejected:
        return Icons.phone_disabled;
      case CallStatus.noAnswer:
        return Icons.phone_callback;
      case CallStatus.busy:
        return Icons.phone_paused;
      case CallStatus.cancelled:
        return Icons.phone_disabled;
    }
  }

  Color _getStatusColor() {
    switch (widget.callEvent.effectiveStatus) {
      case CallStatus.connected:
        return Colors.green;
      case CallStatus.missed:
      case CallStatus.rejected:
      case CallStatus.noAnswer:
      case CallStatus.busy:
      case CallStatus.cancelled:
        return Colors.red;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Call Details'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Phone number display (large)
          Center(
            child: Column(
              children: [
                const SizedBox(height: 32),
                Text(
                  widget.contactName ?? widget.callEvent.phoneNumber,
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (widget.contactName != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    widget.callEvent.phoneNumber,
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                // Call type icon
                Icon(
                  widget.callEvent.type == CallType.incoming
                      ? Icons.call_received
                      : Icons.call_made,
                  size: 48,
                  color: (widget.callEvent.wasConnected == true && widget.callEvent.duration != null && widget.callEvent.duration! > 0)
                      ? Colors.green
                      : Colors.red,
                ),
                const SizedBox(height: 16),
                // Status
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _getStatusIcon(),
                      color: _getStatusColor(),
                      size: 24,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _getStatusText(),
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: _getStatusColor(),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Duration or status message
                Text(
                  (widget.callEvent.wasConnected == true && widget.callEvent.duration != null && widget.callEvent.duration! > 0)
                      ? '${_formatCallDuration(widget.callEvent.duration)} - ${widget.callEvent.type == CallType.incoming ? "Incoming" : "Outgoing"}'
                      : _getStatusText(),
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          
          // Details Card
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.access_time),
                  title: const Text('Date & Time'),
                  subtitle: Text(_formatDateTime(widget.callEvent.timestamp)),
                ),
                const Divider(),
                if (widget.callEvent.startTime != null)
                  ListTile(
                    leading: const Icon(Icons.play_circle_outline),
                    title: const Text('Call Started'),
                    subtitle: Text(_formatDateTime(widget.callEvent.startTime!)),
                  ),
                if (widget.callEvent.startTime != null) const Divider(),
                if (widget.callEvent.endTime != null)
                  ListTile(
                    leading: const Icon(Icons.stop_circle_outlined),
                    title: const Text('Call Ended'),
                    subtitle: Text(_formatDateTime(widget.callEvent.endTime!)),
                  ),
                if (widget.callEvent.endTime != null) const Divider(),
                if (widget.callEvent.duration != null && widget.callEvent.duration! > 0)
                  ListTile(
                    leading: const Icon(Icons.timer),
                    title: const Text('Duration'),
                    subtitle: Text(_formatCallDuration(widget.callEvent.duration)),
                  ),
                if (widget.callEvent.duration != null && widget.callEvent.duration! > 0) const Divider(),
                ListTile(
                  leading: Icon(
                    widget.callEvent.type == CallType.incoming
                        ? Icons.arrow_downward
                        : Icons.arrow_upward,
                    color: widget.callEvent.type == CallType.incoming
                        ? Colors.green
                        : Colors.blue,
                  ),
                  title: const Text('Call Type'),
                  subtitle: Text(
                    widget.callEvent.type == CallType.incoming
                        ? 'Incoming'
                        : 'Outgoing',
                  ),
                ),
                // Call Recording Section
                if (widget.callEvent.recordingPath != null && widget.callEvent.recordingPath!.isNotEmpty) ...[
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.mic, color: Colors.red),
                    title: const Text('Call Recording'),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 8),
                        // Playback Controls
                        Row(
                          children: [
                            IconButton(
                              icon: Icon(
                                _audioPlayer.isPlaying && _audioPlayer.currentPath == widget.callEvent.recordingPath
                                    ? Icons.pause_circle_filled
                                    : Icons.play_circle_filled,
                                size: 48,
                                color: Colors.green,
                              ),
                              onPressed: _togglePlayback,
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Progress bar
                                  if (_duration.inSeconds > 0)
                                    Slider(
                                      value: _position.inSeconds.toDouble(),
                                      max: _duration.inSeconds.toDouble(),
                                      onChanged: (value) {
                                        _audioPlayer.seek(Duration(seconds: value.toInt()));
                                      },
                                    ),
                                  // Time display
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        _formatDuration(_position),
                                        style: const TextStyle(fontSize: 12),
                                      ),
                                      Text(
                                        _formatDuration(_duration),
                                        style: const TextStyle(fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          
          // Action Buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              ElevatedButton.icon(
                onPressed: () {
                  // TODO: Implement call back
                },
                icon: const Icon(Icons.phone),
                label: const Text('Call'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                ),
              ),
              ElevatedButton.icon(
                onPressed: () {
                  // TODO: Implement message
                },
                icon: const Icon(Icons.message),
                label: const Text('Message'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

