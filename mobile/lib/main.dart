import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'services/supabase_service.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize Hive for local persistent caching
  await Hive.initFlutter();
  await Hive.openBox('scans_queue');
  await Hive.openBox('incidents_queue');
  await Hive.openBox('checkpoints_cache');
  await Hive.openBox('session_data');

  // 2. Initialize Supabase
  // For production compilation, replace with real project configurations
  const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: 'https://your-supabase-url.supabase.co');
  const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: 'your-supabase-anon-key');

  await Supabase.initialize(
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  );

  runApp(const PatrolIQApp());
}

class PatrolIQApp extends StatelessWidget {
  const PatrolIQApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final SupabaseService supabaseService = SupabaseService();
    final bool isLoggedIn = supabaseService.currentUser != null;

    return MaterialApp(
      title: 'PatrolIQ Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF3DDCC5),
        scaffoldBackgroundColor: const Color(0xFF0B0F0E),
        fontFamily: 'Inter',
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF3DDCC5),
          surface: Color(0xFF12181A),
        ),
      ),
      home: isLoggedIn 
          ? DashboardScreen(supabaseService: supabaseService)
          : LoginScreen(supabaseService: supabaseService),
    );
  }
}
