import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:hive/hive.dart';
import '../models/scan_model.dart';
import '../models/incident_model.dart';

class SupabaseService {
  final SupabaseClient client = Supabase.instance.client;

  // Authentication
  Future<AuthResponse> signIn(String email, String password) async {
    return await client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signOut() async {
    await client.auth.signOut();
  }

  User? get currentUser => client.auth.currentUser;

  // Profiles
  Future<Map<String, dynamic>?> fetchProfile() async {
    final user = currentUser;
    if (user == null) return null;
    
    final response = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    return response;
  }

  // Cache checkpoints locally for offline validation
  Future<void> cacheCheckpointsLocally() async {
    try {
      final response = await client
          .from('checkpoints')
          .select('id, name, tag_code, geofence_radius_meters, location, route_id');
      
      final checkpointBox = Hive.box('checkpoints_cache');
      await checkpointBox.clear();

      for (var cp in response) {
        final locString = cp['location'] as String;
        final coordsMatch = RegExp(r'POINT\(([-\d\.]+) ([\-\d\.]+)\)').firstMatch(locString);
        
        double lat = 0.0;
        double lng = 0.0;
        if (coordsMatch != null) {
          lng = double.parse(coordsMatch.group(1)!);
          lat = double.parse(coordsMatch.group(2)!);
        }

        await checkpointBox.put(cp['tag_code'], {
          'id': cp['id'],
          'name': cp['name'],
          'tag_code': cp['tag_code'],
          'radius': (cp['geofence_radius_meters'] as num).toDouble(),
          'latitude': lat,
          'longitude': lng,
        });
      }
      print('Checkpoints successfully cached locally.');
    } catch (e) {
      print('Failed to cache checkpoints: $e');
    }
  }

  // Shifts
  Future<String?> startShift(String siteId, {double? lat, double? lng}) async {
    final user = currentUser;
    if (user == null) return null;

    final data = <String, dynamic>{
      'user_id': user.id,
      'site_id': siteId,
    };
    if (lat != null && lng != null) {
      data['start_location'] = 'POINT($lng $lat)';
    }

    final response = await client
        .from('shifts')
        .insert(data)
        .select('id')
        .single();
    
    return response['id'] as String;
  }

  Future<void> endShift(String shiftId, {String? guardNotes}) async {
    await client
        .from('shifts')
        .update({
          'ended_at': DateTime.now().toIso8601String(),
          'guard_notes': guardNotes,
        })
        .eq('id', shiftId);
  }

  // Upload scan to Supabase database via server-authoritative RPC function
  Future<Map<String, dynamic>?> uploadScan(ScanModel scan) async {
    try {
      final response = await client.rpc('record_checkpoint_scan', params: {
        'p_client_generated_id': scan.clientGeneratedId,
        'p_shift_id': scan.shiftId,
        'p_checkpoint_id': scan.checkpointId,
        'p_scanned_by': scan.scannedBy,
        'p_scanned_at': scan.scannedAt.toIso8601String(),
        'p_longitude': scan.longitude,
        'p_latitude': scan.latitude,
        'p_gps_accuracy': scan.gpsAccuracy,
        'p_observation_category': scan.observationCategory,
        'p_notes': scan.notes,
        'p_photo_url': scan.photoUrl,
        'p_voice_note_url': scan.voiceNoteUrl,
      });

      if (response != null && response is Map) {
        return Map<String, dynamic>.from(response);
      }
      return null;
    } catch (e) {
      print('RPC record_checkpoint_scan notice, falling back to direct table insertion: $e');
      await client.from('checkpoint_scans').insert(scan.toJson());
      return null;
    }
  }

  // Upload Incident record
  Future<void> uploadIncident(IncidentModel incident) async {
    await client.from('incidents').insert(incident.toJson());
  }

  // Register or update active device session
  Future<void> logDeviceSession(String deviceId, String platformName) async {
    final user = currentUser;
    if (user == null) return;

    try {
      await client.from('devices').upsert({
        'user_id': user.id,
        'device_id': deviceId,
        'platform': platformName,
        'last_active_at': DateTime.now().toIso8601String(),
        'last_sync_at': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      print('Device session log failed: $e');
    }
  }

  // Fetch sites list for starting shifts
  Future<List<Map<String, dynamic>>> fetchSites() async {
    final response = await client.from('sites').select('id, name');
    return List<Map<String, dynamic>>.from(response);
  }

  // Upload file binary to Supabase Storage patrol_media bucket
  Future<String?> uploadMedia(String localFilePath, String storagePath) async {
    final file = File(localFilePath);
    if (!await file.exists()) return null;

    try {
      await client.storage.from('patrol_media').upload(
        storagePath,
        file,
        fileOptions: const FileOptions(cacheControl: '3600', upsert: true),
      );
      
      final String publicUrl = client.storage.from('patrol_media').getPublicUrl(storagePath);
      return publicUrl;
    } catch (e) {
      print('Storage upload failure: $e');
      rethrow;
    }
  }
}
