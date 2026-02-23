import 'package:audioplayers/audioplayers.dart';
import 'dart:async';

class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;
  AudioPlayerService._internal();

  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isPlaying = false;
  String? _currentPath;
  StreamController<Duration>? _positionController;
  StreamController<Duration>? _durationController;

  Stream<Duration>? get positionStream => _positionController?.stream;
  Stream<Duration>? get durationStream => _durationController?.stream;
  bool get isPlaying => _isPlaying;
  String? get currentPath => _currentPath;

  Future<void> play(String filePath) async {
    try {
      if (_currentPath == filePath && _isPlaying) {
        await pause();
        return;
      }

      if (_currentPath != filePath) {
        await stop();
        _currentPath = filePath;
      }

      await _audioPlayer.play(DeviceFileSource(filePath));
      _isPlaying = true;

      // Listen to position updates
      _audioPlayer.onPositionChanged.listen((position) {
        _positionController?.add(position);
      });

      _audioPlayer.onDurationChanged.listen((duration) {
        _durationController?.add(duration);
      });

      _audioPlayer.onPlayerComplete.listen((_) {
        _isPlaying = false;
        _positionController?.add(Duration.zero);
      });
    } catch (e) {
      print('Error playing audio: $e');
      _isPlaying = false;
    }
  }

  Future<void> pause() async {
    try {
      await _audioPlayer.pause();
      _isPlaying = false;
    } catch (e) {
      print('Error pausing audio: $e');
    }
  }

  Future<void> resume() async {
    try {
      await _audioPlayer.resume();
      _isPlaying = true;
    } catch (e) {
      print('Error resuming audio: $e');
    }
  }

  Future<void> stop() async {
    try {
      await _audioPlayer.stop();
      _isPlaying = false;
      _currentPath = null;
      _positionController?.add(Duration.zero);
    } catch (e) {
      print('Error stopping audio: $e');
    }
  }

  Future<void> seek(Duration position) async {
    try {
      await _audioPlayer.seek(position);
    } catch (e) {
      print('Error seeking audio: $e');
    }
  }

  void initialize() {
    _positionController = StreamController<Duration>.broadcast();
    _durationController = StreamController<Duration>.broadcast();
  }

  void dispose() {
    stop();
    _positionController?.close();
    _durationController?.close();
    _audioPlayer.dispose();
  }
}

