import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:hive/hive.dart';
import 'supabase_service.dart';
import '../models/scan_model.dart';
import '../models/incident_model.dart';

enum SyncState { synced, syncing, queued }

class SyncService extends ChangeNotifier {
  final SupabaseService _supabaseService;
  final Box _scansQueue = Hive.box('scans_queue');
  final Box _incidentsQueue = Hive.box('incidents_queue');
  final Connectivity _connectivity = Connectivity();
  
  SyncState _state = SyncState.synced;
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _isProcessing = false;

  SyncService(this._supabaseService) {
    // Determine initial state
    _updateSyncState();

    // Listen for internet connectivity restoration
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      if (results.any((result) => result != ConnectivityResult.none)) {
        processQueue();
      }
    });
  }

  SyncState get state => _state;
  int get queueCount => _scansQueue.length + _incidentsQueue.length;

  // Add scan to local queue and attempt upload if online
  Future<void> logScan(ScanModel scan) async {
    await _scansQueue.put(scan.clientGeneratedId, scan.toCacheMap());
    _updateSyncState();
    notifyListeners();
    await processQueue();
  }

  // Add incident to local queue and attempt upload if online
  Future<void> logIncident(IncidentModel incident) async {
    await _incidentsQueue.put(incident.clientGeneratedId, incident.toCacheMap());
    _updateSyncState();
    notifyListeners();
    await processQueue();
  }

  // Process all queued scans and incidents sequentially
  Future<void> processQueue() async {
    if (_isProcessing) return;
    
    // Check if offline
    final connection = await _connectivity.checkConnectivity();
    if (connection.contains(ConnectivityResult.none)) {
      _state = SyncState.queued;
      notifyListeners();
      return;
    }

    if (_scansQueue.isEmpty && _incidentsQueue.isEmpty) {
      _state = SyncState.synced;
      notifyListeners();
      return;
    }

    _isProcessing = true;
    _state = SyncState.syncing;
    notifyListeners();

    // 1. Process Scans Queue
    final scanKeys = List.from(_scansQueue.keys);
    for (var key in scanKeys) {
      final cachedData = _scansQueue.get(key);
      if (cachedData == null) continue;

      final scan = ScanModel.fromCacheMap(cachedData as Map);

      try {
        String? photoUrl = scan.photoUrl;
        String? voiceNoteUrl = scan.voiceNoteUrl;

        if (photoUrl != null && !photoUrl.startsWith('http')) {
          final String extension = photoUrl.split('.').last;
          final storagePath = 'photos/${scan.clientGeneratedId}.$extension';
          final publicUrl = await _supabaseService.uploadMedia(photoUrl, storagePath);
          if (publicUrl != null) {
            photoUrl = publicUrl;
          }
        }

        if (voiceNoteUrl != null && !voiceNoteUrl.startsWith('http')) {
          final String extension = voiceNoteUrl.split('.').last;
          final storagePath = 'audio/${scan.clientGeneratedId}.$extension';
          final publicUrl = await _supabaseService.uploadMedia(voiceNoteUrl, storagePath);
          if (publicUrl != null) {
            voiceNoteUrl = publicUrl;
          }
        }

        final updatedScan = scan.copyWith(
          photoUrl: photoUrl,
          voiceNoteUrl: voiceNoteUrl,
        );

        await _supabaseService.uploadScan(updatedScan);
        await _scansQueue.delete(key);
      } catch (e) {
        print('Upload failed for scan ${scan.clientGeneratedId}: $e.');
        break;
      }
    }

    // 2. Process Incidents Queue
    final incidentKeys = List.from(_incidentsQueue.keys);
    for (var key in incidentKeys) {
      final cachedData = _incidentsQueue.get(key);
      if (cachedData == null) continue;

      final incident = IncidentModel.fromCacheMap(cachedData as Map);

      try {
        String? photoUrl = incident.photoUrl;
        String? voiceNoteUrl = incident.voiceNoteUrl;

        if (photoUrl != null && !photoUrl.startsWith('http')) {
          final String extension = photoUrl.split('.').last;
          final storagePath = 'incidents/${incident.clientGeneratedId}_photo.$extension';
          final publicUrl = await _supabaseService.uploadMedia(photoUrl, storagePath);
          if (publicUrl != null) {
            photoUrl = publicUrl;
          }
        }

        if (voiceNoteUrl != null && !voiceNoteUrl.startsWith('http')) {
          final String extension = voiceNoteUrl.split('.').last;
          final storagePath = 'incidents/${incident.clientGeneratedId}_voice.$extension';
          final publicUrl = await _supabaseService.uploadMedia(voiceNoteUrl, storagePath);
          if (publicUrl != null) {
            voiceNoteUrl = publicUrl;
          }
        }

        final updatedIncident = incident.copyWith(
          photoUrl: photoUrl,
          voiceNoteUrl: voiceNoteUrl,
        );

        await _supabaseService.uploadIncident(updatedIncident);
        await _incidentsQueue.delete(key);
      } catch (e) {
        print('Upload failed for incident ${incident.clientGeneratedId}: $e.');
        break;
      }
    }

    _isProcessing = false;
    _updateSyncState();
    notifyListeners();
  }

  void _updateSyncState() {
    if (_scansQueue.isEmpty && _incidentsQueue.isEmpty) {
      _state = SyncState.synced;
    } else {
      _state = SyncState.queued;
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
