import 'dart:convert';

class ScanModel {
  final String clientGeneratedId;
  final String checkpointId;
  final String shiftId;
  final String scannedBy;
  final DateTime scannedAt;
  final double latitude;
  final double longitude;
  final double? gpsAccuracy;
  final bool withinGeofence;
  final bool isDuplicate;
  final String tagCode;
  final String checkpointName;
  final String? observationCategory;
  
  // Media attachments
  final String? notes;
  final String? photoUrl; // Local path if queued offline; Public URL if synced
  final String? voiceNoteUrl; // Local path if queued offline; Public URL if synced

  ScanModel({
    required this.clientGeneratedId,
    required this.checkpointId,
    required this.shiftId,
    required this.scannedBy,
    required this.scannedAt,
    required this.latitude,
    required this.longitude,
    this.gpsAccuracy,
    required this.withinGeofence,
    this.isDuplicate = false,
    required this.tagCode,
    required this.checkpointName,
    this.observationCategory,
    this.notes,
    this.photoUrl,
    this.voiceNoteUrl,
  });

  // Convert model to JSON map for Supabase insertion
  Map<String, dynamic> toJson() {
    return {
      'client_generated_id': clientGeneratedId,
      'checkpoint_id': checkpointId,
      'shift_id': shiftId,
      'scanned_by': scannedBy,
      'scanned_at': scannedAt.toIso8601String(),
      'scan_location': 'POINT($longitude $latitude)', // WKT Point format for PostGIS geography
      'gps_accuracy': gpsAccuracy,
      'within_geofence': withinGeofence,
      'is_duplicate': isDuplicate,
      'observation_category': observationCategory,
      'notes': notes,
      'photo_url': photoUrl,
      'voice_note_url': voiceNoteUrl,
    };
  }

  // Convert to simplified map for local Hive cache (stores local file paths)
  Map<String, dynamic> toCacheMap() {
    return {
      'clientGeneratedId': clientGeneratedId,
      'checkpointId': checkpointId,
      'shiftId': shiftId,
      'scannedBy': scannedBy,
      'scannedAt': scannedAt.toIso8601String(),
      'latitude': latitude,
      'longitude': longitude,
      'gpsAccuracy': gpsAccuracy,
      'withinGeofence': withinGeofence,
      'isDuplicate': isDuplicate,
      'tagCode': tagCode,
      'checkpointName': checkpointName,
      'observationCategory': observationCategory,
      'notes': notes,
      'photoUrl': photoUrl,
      'voiceNoteUrl': voiceNoteUrl,
    };
  }

  // Create from Hive cache map
  factory ScanModel.fromCacheMap(Map<dynamic, dynamic> map) {
    return ScanModel(
      clientGeneratedId: map['clientGeneratedId'] as String,
      checkpointId: map['checkpointId'] as String,
      shiftId: map['shiftId'] as String,
      scannedBy: map['scannedBy'] as String,
      scannedAt: DateTime.parse(map['scannedAt'] as String),
      latitude: map['latitude'] as double,
      longitude: map['longitude'] as double,
      gpsAccuracy: map['gpsAccuracy'] as double?,
      withinGeofence: map['withinGeofence'] as bool,
      isDuplicate: (map['isDuplicate'] as bool?) ?? false,
      tagCode: map['tagCode'] as String,
      checkpointName: map['checkpointName'] as String,
      observationCategory: map['observationCategory'] as String?,
      notes: map['notes'] as String?,
      photoUrl: map['photoUrl'] as String?,
      voiceNoteUrl: map['voiceNoteUrl'] as String?,
    );
  }

  // Helper method to copy instance with updated URLs
  ScanModel copyWith({
    String? photoUrl,
    String? voiceNoteUrl,
    bool? isDuplicate,
  }) {
    return ScanModel(
      clientGeneratedId: clientGeneratedId,
      checkpointId: checkpointId,
      shiftId: shiftId,
      scannedBy: scannedBy,
      scannedAt: scannedAt,
      latitude: latitude,
      longitude: longitude,
      gpsAccuracy: gpsAccuracy,
      withinGeofence: withinGeofence,
      isDuplicate: isDuplicate ?? this.isDuplicate,
      tagCode: tagCode,
      checkpointName: checkpointName,
      observationCategory: observationCategory,
      notes: notes,
      photoUrl: photoUrl ?? this.photoUrl,
      voiceNoteUrl: voiceNoteUrl ?? this.voiceNoteUrl,
    );
  }
}
