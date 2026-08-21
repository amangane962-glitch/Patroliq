import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hive/hive.dart';
import 'package:uuid/uuid.dart';
import '../models/incident_model.dart';
import '../services/supabase_service.dart';

class ReportIncidentScreen extends StatefulWidget {
  final String shiftId;
  final String siteId;
  final String reportedBy;
  final SupabaseService supabaseService;

  const ReportIncidentScreen({
    Key? key,
    required this.shiftId,
    required this.siteId,
    required this.reportedBy,
    required this.supabaseService,
  }) : super(key: key);

  @override
  _ReportIncidentScreenState createState() => _ReportIncidentScreenState();
}

class _ReportIncidentScreenState extends State<ReportIncidentScreen> {
  final _titleController = TextEditingController();
  final _descController = TextEditingController();

  String _category = 'security_breach';
  String _severity = 'medium';
  bool _isSubmitting = false;

  String? _photoPath;
  String? _voiceNotePath;
  bool _isRecordingAudio = false;

  double? _latitude;
  double? _longitude;

  final Map<String, String> _categoryOptions = {
    'security_breach': 'Security Breach',
    'suspicious_person': 'Suspicious Person',
    'theft_suspected': 'Theft / Suspected Theft',
    'intrusion': 'Intrusion',
    'fire': 'Fire Safety',
    'equipment_failure': 'Equipment Failure',
    'damaged_infrastructure': 'Damaged Infrastructure',
    'unauthorised_access': 'Unauthorised Access',
    'safety_concern': 'Safety Concern',
    'other': 'Other Event',
  };

  @override
  void initState() {
    super.initState();
    _fetchGpsLocation();
  }

  Future<void> _fetchGpsLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
      });
    } catch (e) {
      print('GPS capture for incident failed: $e');
    }
  }

  void _simulateCapturePhoto() {
    setState(() {
      _photoPath = '/sdcard/patrol_iq/incidents/photo_${DateTime.now().millisecondsSinceEpoch}.jpg';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Incident photo captured (Simulated camera).')),
    );
  }

  void _toggleAudioRecording() {
    if (_isRecordingAudio) {
      setState(() {
        _isRecordingAudio = false;
        _voiceNotePath = '/sdcard/patrol_iq/incidents/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Voice memo recorded for incident.')),
      );
    } else {
      setState(() {
        _isRecordingAudio = true;
      });
    }
  }

  Future<void> _submitIncident() async {
    if (_titleController.text.trim().isEmpty || _descController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an incident title and description.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final clientGeneratedId = const Uuid().v4();
      final incident = IncidentModel(
        clientGeneratedId: clientGeneratedId,
        shiftId: widget.shiftId,
        siteId: widget.siteId,
        reportedBy: widget.reportedBy,
        category: _category,
        title: _titleController.text.trim(),
        description: _descController.text.trim(),
        severity: _severity,
        status: 'open',
        reportedAt: DateTime.now(),
        latitude: _latitude,
        longitude: _longitude,
        photoUrl: _photoPath,
        voiceNoteUrl: _voiceNotePath,
      );

      // Attempt online upload, fallback to local Hive cache
      try {
        await widget.supabaseService.uploadIncident(incident);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Incident submitted successfully to server.')),
        );
      } catch (e) {
        // Queue locally
        final box = Hive.box('incidents_queue');
        await box.put(clientGeneratedId, incident.toCacheMap());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Offline: Incident saved locally and queued for auto-sync.')),
        );
      }

      Navigator.pop(context);
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F0E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF12181A),
        title: const Text('REPORT SECURITY INCIDENT', style: TextStyle(fontFamily: 'Space Grotesk', fontSize: 14, color: Colors.redAccent, fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Category Dropdown
            const Text('INCIDENT CATEGORY', style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF12181A),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _category,
                  dropdownColor: const Color(0xFF12181A),
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  items: _categoryOptions.entries.map((e) {
                    return DropdownMenuItem<String>(
                      value: e.key,
                      child: Text(e.value),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _category = val);
                  },
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Severity Radio Group
            const Text('SEVERITY LEVEL', style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
            const SizedBox(height: 8),
            Row(
              children: ['low', 'medium', 'high', 'critical'].map((sev) {
                final isSelected = _severity == sev;
                Color color = Colors.blue;
                if (sev == 'medium') color = Colors.yellow;
                if (sev == 'high') color = Colors.orange;
                if (sev == 'critical') color = Colors.red;

                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _severity = sev),
                    child: Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected ? color.withOpacity(0.2) : const Color(0xFF12181A),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: isSelected ? color : Colors.white.withOpacity(0.05)),
                      ),
                      child: Text(
                        sev.toUpperCase(),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: isSelected ? color : Colors.white50,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'IBM Plex Mono',
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Title Field
            const Text('INCIDENT TITLE', style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
            const SizedBox(height: 8),
            TextField(
              controller: _titleController,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'e.g. Broken Fence Mesh at Gate 3',
                hintStyle: const TextStyle(color: Colors.white20, fontSize: 12),
                filled: true,
                fillColor: const Color(0xFF12181A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 20),

            // Description Field
            const Text('DETAILED DESCRIPTION', style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
            const SizedBox(height: 8),
            TextField(
              controller: _descController,
              maxLines: 4,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Provide full observation notes, affected equipment, or suspect descriptions...',
                hintStyle: const TextStyle(color: Colors.white20, fontSize: 12),
                filled: true,
                fillColor: const Color(0xFF12181A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 24),

            // Media attachments
            const Text('INCIDENT EVIDENCE ATTACHMENTS', style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: _simulateCapturePhoto,
                    child: Container(
                      height: 90,
                      decoration: BoxDecoration(
                        color: const Color(0xFF12181A),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: _photoPath != null ? const Color(0xFF3DDCC5) : Colors.white.withOpacity(0.05)),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.camera_alt, color: _photoPath != null ? const Color(0xFF3DDCC5) : Colors.white20, size: 28),
                          const SizedBox(height: 6),
                          Text(_photoPath != null ? 'PHOTO ATTACHED' : 'TAKE PHOTO', style: TextStyle(color: _photoPath != null ? const Color(0xFF3DDCC5) : Colors.white30, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: _toggleAudioRecording,
                    child: Container(
                      height: 90,
                      decoration: BoxDecoration(
                        color: const Color(0xFF12181A),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: _isRecordingAudio ? Colors.blue : _voiceNotePath != null ? const Color(0xFF3DDCC5) : Colors.white.withOpacity(0.05)),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.mic, color: _isRecordingAudio ? Colors.blue : _voiceNotePath != null ? const Color(0xFF3DDCC5) : Colors.white20, size: 28),
                          const SizedBox(height: 6),
                          Text(_isRecordingAudio ? 'RECORDING...' : _voiceNotePath != null ? 'AUDIO ATTACHED' : 'RECORD VOICE', style: TextStyle(color: _isRecordingAudio ? Colors.blue : _voiceNotePath != null ? const Color(0xFF3DDCC5) : Colors.white30, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 36),

            // Submit Button
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submitIncident,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSubmitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('SUBMIT INCIDENT REPORT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            ),
          ],
        ),
      ),
    );
  }
}
