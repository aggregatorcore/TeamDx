import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/screens/login_screen.dart';
import '../auth/providers/auth_provider.dart';
import '../auth/services/auth_service.dart';
import '../features/dashboard/screens/dashboard_screen.dart';
import '../features/my_task/screens/my_task_screen.dart';
import '../features/buckets/screens/buckets_screen.dart';
import '../features/device_binding/screens/device_binding_screen.dart';
import '../features/leads/screens/leads_screen.dart';

/// Router Provider
/// 
/// Provides GoRouter instance with Riverpod integration
final routerProvider = Provider<GoRouter>((ref) {
  // Watch auth state to trigger router rebuilds
  ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      try {
        // Get auth state from the container
        final container = ProviderScope.containerOf(context);
        final authStateAsync = container.read(authStateProvider);
        final authState = authStateAsync.valueOrNull;
        
        final isLoggedIn = authState != null;
        final isGoingToLogin = state.matchedLocation == '/login';

        // If not logged in and not going to login, redirect to login
        if (!isLoggedIn && !isGoingToLogin) {
          return '/login';
        }

        // If logged in and going to login, redirect to dashboard
        if (isLoggedIn && isGoingToLogin) {
          return '/dashboard';
        }

        return null; // No redirect needed
      } catch (e) {
        // Fallback to login on error
        return '/login';
      }
    },
    routes: [
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        name: 'dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/my-task',
        name: 'my-task',
        builder: (context, state) => const MyTaskScreen(),
      ),
      GoRoute(
        path: '/buckets',
        name: 'buckets',
        builder: (context, state) => const BucketsScreen(),
      ),
      GoRoute(
        path: '/device-binding',
        name: 'device-binding',
        builder: (context, state) => const DeviceBindingScreen(),
      ),
      GoRoute(
        path: '/leads',
        name: 'leads',
        builder: (context, state) => const LeadsScreen(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              'Page not found',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              state.matchedLocation,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => context.go('/dashboard'),
              child: const Text('Go to Dashboard'),
            ),
          ],
        ),
      ),
    ),
  );
});

/// App Router Configuration
/// 
/// Static access to router (for navigation outside of widgets)
class AppRouter {
  static GoRouter? _router;

  static GoRouter get router {
    if (_router == null) {
      throw Exception(
        'Router not initialized. Use routerProvider in MaterialApp.router',
      );
    }
    return _router!;
  }

  static void setRouter(GoRouter router) {
    _router = router;
  }
}
