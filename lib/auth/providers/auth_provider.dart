import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/auth_service.dart';
import '../../core/models/user_model.dart';

/// Auth Service Provider
final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

/// Current User Stream Provider
/// 
/// Provides a stream of the current authenticated user's data
final currentUserStreamProvider = StreamProvider<UserModel?>((ref) {
  final authService = ref.watch(authServiceProvider);
  final currentUser = authService.currentUser;

  if (currentUser == null) {
    return Stream.value(null);
  }

  return authService.getUserDataStream(currentUser.uid);
});

/// Current User Provider
/// 
/// Provides the current user data (synchronous access)
final currentUserProvider = Provider<UserModel?>((ref) {
  final userAsync = ref.watch(currentUserStreamProvider);
  return userAsync.valueOrNull;
});

/// Auth State Provider
/// 
/// Provides the Firebase auth state
final authStateProvider = StreamProvider((ref) {
  final authService = ref.watch(authServiceProvider);
  return authService.authStateChanges;
});
