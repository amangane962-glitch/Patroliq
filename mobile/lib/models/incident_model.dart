import 'dart:convert';

class IncidentModel {
  final String clientGeneratedId;
  final String shiftId;
  final String siteId;
  final String reportedBy;
  final String category; // e.g. security_breach, fire, intrusion, equipment_failure
  final String title;
  final String description;
  final String severity; // low, medium, high, critical
  final String status; // open, under_investigation, resolved
  final DateTime reportedAt;
  final double? latitude;
  final double? longitude;
  final String? photoUrl;
  final String? voiceNoteUrl;

  IncidentModel({
    required this.clientGeneratedId,
    required this.shiftId,
    required this.siteId,
    required this.reportedBy,
    required this.category,
    required this.title,
    required this.description,
    required this.severity,
    this.status = 'open',
    required this.reportedAt,
    this.latitude,
    this.longitude,
    this.photoUrl,
    this.voiceNoteUrl,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'client_generated_id': clientGeneratedId,
      'shift_id': shiftId,
      'site_id': siteId,
      'reported_by': reportedBy,
      'category': category,
      'title': title,
      'description': description,
      'severity': severity,
      'status': status,
      'reported_at': reportedAt.toIso8601String(),
      'photo_url': photoUrl,
      'voice_note_url': voiceNoteUrl,
    };
    if (latitude != null && longitude != null) {
      map['location'] = 'POINT($longitude $latitude)';
    }
    return map;
  }

  Map<String, dynamic> toCacheMap() {
    return {
      'clientGeneratedId': clientGeneratedId,
      'shiftId': shiftId,
      'siteId': siteId,
      'reportedBy': reportedBy,
      'category': category,
      'title': title,
      'description': description,
      'severity': severity,
      'status': status,
      'reportedAt': reportedAt.toIso8601String(),
      'latitude': latitude,
      'longitude': longitude,
      'photoUrl': photoUrl,
      'voiceNoteUrl': voiceNoteUrl,
    };
  }

  factory IncidentModel.fromCacheMap(Map<dynamic, dynamic> map) {
    return IncidentModel(
      clientGeneratedId: map['clientGeneratedId'] as String,
      shiftId: map['shiftId'] as String,
      siteId: map['siteId'] as String,
      reportedBy: map['reportedBy'] as String,
      category: map['category'] as String,
      title: map['title'] as String,
      description: map['description'] as String,
      severity: map['severity'] as String,
      status: (map['status'] as String?) ?? 'open',
      reportedAt: DateTime.parse(map['reportedAt'] as String),
      latitude: map['latitude'] as double?,
      longitude: map['longitude'] as double?,
      photoUrl: map['photoUrl'] as String?,
      voiceNoteUrl: map['voiceNoteUrl'] as String?,
    );
  }

  IncidentModel copyWith({
    String? photoUrl,
    String? voiceNoteUrl,
  }) {
    return IncidentModel(
      clientGeneratedId: clientGeneratedId,
      shiftId: shiftId,
      siteId: siteId,
      reportedBy: reportedBy,
      category: category,
      title: title,
      description: description,
      severity: severity,
      status: status,
      reportedAt: reportedAt,
      latitude: latitude,
      longitude: longitude,
      photoUrl: photoUrl ?? this.photoUrl,
      voiceNoteUrl: voiceNoteUrl ?? this.voiceNoteUrl,
    );
  }
}
