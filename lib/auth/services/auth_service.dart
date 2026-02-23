import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/models/user_model.dart';

/// Authentication Service
/// 
/// Handles Firebase Authentication and user data management
/// for the Operations system only (no HR logic).
class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Get current Firebase user
  User? get currentUser => _auth.currentUser;

  /// Get current user stream
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// Sign in with email and password
  /// 
  /// Returns UserModel if successful, throws Exception on error.
  Future<UserModel?> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    final trimmedEmail = email.trim();
    debugPrint('🔐 Attempting login with email: $trimmedEmail');
    
    try {
      final userCredential = await _auth.signInWithEmailAndPassword(
        email: trimmedEmail,
        password: password,
      );
      
      debugPrint('✅ Firebase Auth successful. User ID: ${userCredential.user?.uid}');

      if (userCredential.user != null) {
        debugPrint('📋 Fetching user data from Firestore for UID: ${userCredential.user!.uid}');
        // Fetch user data from Firestore
        final userData = await _getUserData(userCredential.user!.uid);
        
        if (userData == null) {
          debugPrint('❌ User data not found in Firestore for UID: ${userCredential.user!.uid}');
          throw Exception(
            'User data not found in Firestore. Please contact administrator to create your user profile.',
          );
        }
        
        debugPrint('✅ User data retrieved successfully: ${userData.name} (${userData.role})');
        return userData;
      }
      return null;
    } on FirebaseAuthException catch (e) {
      debugPrint('❌ Firebase Auth Exception - Code: ${e.code}, Message: ${e.message}');
      debugPrint('❌ Full error details: ${e.toString()}');
      // Log to console for better visibility
      if (kDebugMode) {
        print('FIREBASE_AUTH_ERROR: ${e.code} - ${e.message}');
      }
      throw Exception(_handleAuthException(e));
    } catch (e) {
      debugPrint('❌ Unexpected error during login: $e');
      // Re-throw if already an Exception, otherwise wrap it
      if (e is Exception) {
        rethrow;
      }
      throw Exception('Failed to sign in: $e');
    }
  }

  /// Sign out current user
  Future<void> signOut() async {
    try {
      await _auth.signOut();
    } catch (e) {
      throw Exception('Failed to sign out: $e');
    }
  }

  /// Get user data from Firestore
  Future<UserModel?> _getUserData(String userId) async {
    try {
      debugPrint('🔍 Querying Firestore: collection=users, doc=$userId');
      final doc = await _firestore.collection('users').doc(userId).get();
      
      if (doc.exists && doc.data() != null) {
        debugPrint('✅ Firestore document found: ${doc.data()}');
        return UserModel.fromFirestore(doc.data()!, userId);
      }
      debugPrint('⚠️ Firestore document does not exist for userId: $userId');
      return null;
    } catch (e) {
      debugPrint('❌ Error fetching user data from Firestore: $e');
      throw Exception('Failed to fetch user data: $e');
    }
  }

  /// Get user data stream from Firestore
  Stream<UserModel?> getUserDataStream(String userId) {
    return _firestore
        .collection('users')
        .doc(userId)
        .snapshots()
        .map((doc) {
      if (doc.exists && doc.data() != null) {
        return UserModel.fromFirestore(doc.data()!, userId);
      }
      return null;
    });
  }

  /// Handle Firebase Auth exceptions
  String _handleAuthException(FirebaseAuthException e) {
    // Log the full error for debugging
    debugPrint('Firebase Auth Error - Code: ${e.code}, Message: ${e.message}');
    debugPrint('Full exception: ${e.toString()}');
    
    // Map Firebase error codes to user-friendly messages
    switch (e.code) {
      case 'user-not-found':
      case 'ERROR_USER_NOT_FOUND':
        return 'No user found with this email. Please check your email or create an account.';
      case 'wrong-password':
      case 'ERROR_WRONG_PASSWORD':
      case 'INVALID_PASSWORD':
        return 'Incorrect password. Please try again.';
      case 'invalid-email':
      case 'ERROR_INVALID_EMAIL':
      case 'INVALID_EMAIL':
        return 'Invalid email address. Please enter a valid email format.';
      case 'user-disabled':
      case 'ERROR_USER_DISABLED':
        return 'This account has been disabled. Please contact administrator.';
      case 'too-many-requests':
      case 'ERROR_TOO_MANY_REQUESTS':
        return 'Too many failed attempts. Please try again later.';
      case 'network-request-failed':
      case 'ERROR_NETWORK_REQUEST_FAILED':
        return 'Network error. Please check your connection.';
      case 'invalid-credential':
      case 'ERROR_INVALID_CREDENTIAL':
      case 'INVALID_CREDENTIAL':
        return 'Invalid email or password. Please check your credentials.';
      case 'operation-not-allowed':
      case 'ERROR_OPERATION_NOT_ALLOWED':
        return 'Email/Password authentication is not enabled. Please contact administrator.';
      case 'weak-password':
      case 'ERROR_WEAK_PASSWORD':
        return 'Password is too weak. Please use a stronger password.';
      case 'email-already-in-use':
      case 'ERROR_EMAIL_ALREADY_IN_USE':
        return 'This email is already registered.';
      case 'missing-password':
      case 'MISSING_PASSWORD':
        return 'Password is required.';
      case 'missing-email':
      case 'MISSING_EMAIL':
        return 'Email is required.';
      default:
        // Return the actual Firebase error message if available
        final errorMsg = e.message ?? e.code;
        return 'Authentication failed: $errorMsg. Please check your credentials or contact administrator.';
    }
  }
}
