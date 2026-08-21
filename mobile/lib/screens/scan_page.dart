import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:hive/hive.dart';
import 'package:uuid/uuid.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../models/scan_model.dart';
import '../services/sync_service.dart';

class ScanPage extends StatefulWidget {
  final String shiftId;
  final String scannedBy;
  final SyncService syncService;

  const ScanPage({
    Key? key,
    required this.shiftId,
    required this.scannedBy,
    required this.syncService,
  }) : super(key: key);

  @override
  _ScanPageState createState() => _ScanPageState();
}

class _ScanPageState extends State<ScanPage> {
  bool _isProcessing = false;
  String? _statusMessage;
  List<Map<dynamic, dynamic>> _cachedCheckpoints = [];

  // Scanned results state
  bool _hasScannedCode = false;
  String? _scannedTagCode;
  String _checkpointId = '';
  String _checkpointName = '';
  double _allowedRadius = 15.0;
  double _scannedDistance = 0.0;
  bool _withinGeofence = false;
  double _latitude = 0.0;
  double _longitude = 0.0;

  // Form media report state
  final _notesController = TextEditingController();
  String? _photoPath;
  String? _voiceNotePath;
  bool _isRecordingAudio = false;

  @override
  void initState() {
    super.initState();
    _loadCachedCheckpoints();
  }

  void _loadCachedCheckpoints() {
    final box = Hive.box('checkpoints_cache');
    setState(() {
      _cachedCheckpoints = box.values.map((v) => v as Map<dynamic, dynamic>).toList();
    });
  }

  // Pre-process scan tag, fetch GPS, check geofence
  Future<void> _handleTagScanned(String rawTagCode) async {
    if (_isProcessing || _hasScannedCode) return;
    setState(() {
      _isProcessing = true;
      _statusMessage = 'Reading GPS coordinates...';
    });

    // Strip PATROLIQ: prefix if encoded in payload
    final String cleanTagCode = rawTagCode.startsWith('PATROLIQ:') 
        ? rawTagCode.substring(9).trim() 
        : rawTagCode.trim();

    try {
      // 1. Get GPS coordinates
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw 'Location permissions are denied. Please enable GPS in device settings.';
        }
      }

      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      // Check if GPS accuracy is poor (>30m)
      if (position.accuracy > 30.0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('GPS ACCURACY LOW: Move to an open area and try again.'),
            backgroundColor: Colors.orangeAccent,
          ),
        );
      }

      // 2. Lookup scanned code in local checkpoints cache
      final box = Hive.box('checkpoints_cache');
      var checkpointData = box.get(cleanTagCode) as Map<dynamic, dynamic>?;
      
      // Fallback search if tag has prefix or format differences
      if (checkpointData == null) {
        for (var key in box.keys) {
          if (key.toString().toUpperCase() == cleanTagCode.toUpperCase()) {
            checkpointData = box.get(key) as Map<dynamic, dynamic>?;
            break;
          }
        }
      }

      bool withinGeofence = false;
      double distance = 0.0;
      double allowedRadius = 15.0;
      String checkpointId = 'cp_' + cleanTagCode;
      String checkpointName = 'Checkpoint ($cleanTagCode)';

      if (checkpointData != null) {
        checkpointId = checkpointData['id'] as String;
        checkpointName = checkpointData['name'] as String;
        allowedRadius = checkpointData['radius'] as double;
        final double targetLat = checkpointData['latitude'] as double;
        final double targetLng = checkpointData['longitude'] as double;

        // Calculate distance in meters
        distance = Geolocator.distanceBetween(
          position.latitude,
          position.longitude,
          targetLat,
          targetLng,
        );

        if (distance <= allowedRadius) {
          withinGeofence = true;
        }
      } else {
        // Uncached checkpoint fallback validation
        withinGeofence = true;
      }

      if (!withinGeofence) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('LOCATION NOT VERIFIED: Move closer to the checkpoint and scan again.'),
            backgroundColor: Colors.amber,
          ),
        );
      }

      setState(() {
        _hasScannedCode = true;
        _scannedTagCode = cleanTagCode;
        _checkpointId = checkpointId;
        _checkpointName = checkpointName;
        _allowedRadius = allowedRadius;
        _scannedDistance = distance;
        _withinGeofence = withinGeofence;
        _latitude = position.latitude;
        _longitude = position.longitude;
      });

    } catch (e) {
      setState(() {
        _statusMessage = 'GPS LOCATION UNAVAILABLE: Please enable location services.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('GPS Error: $e')),
      );
    } finally {
      setState(() {
        _isProcessing = false;
      });
    }
  }

  // Camera mock capture
  void _simulateCapturePhoto() {
    setState(() {
      _photoPath = '/sdcard/patrol_iq/photos/photo_${DateTime.now().millisecondsSinceEpoch}.jpg';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Photo snapshot captured from camera (Simulated).')),
    );
  }

  // Voice note mock recorder
  void _toggleAudioRecording() {
    if (_isRecordingAudio) {
      setState(() {
        _isRecordingAudio = false;
        _voiceNotePath = '/sdcard/patrol_iq/audio/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Voice memo recorded successfully (Simulated).')),
      );
    } else {
      setState(() {
        _isRecordingAudio = true;
      });
    }
  }

  // Submit complete scan report
  Future<void> _submitPatrolLog() async {
    if (_scannedTagCode == null) return;
    setState(() {
      _isProcessing = true;
      _statusMessage = 'Queueing patrol log...';
    });

    final clientGeneratedId = const Uuid().v4();

    final scan = ScanModel(
      clientGeneratedId: clientGeneratedId,
      checkpointId: _checkpointId,
      shiftId: widget.shiftId,
      scannedBy: widget.scannedBy,
      scannedAt: DateTime.now(),
      latitude: _latitude,
      longitude: _longitude,
      withinGeofence: _withinGeofence,
      tagCode: _scannedTagCode!,
      checkpointName: _checkpointName,
      notes: _notesController.text.trim().isNotEmpty ? _notesController.text.trim() : null,
      photoUrl: _photoPath,
      voiceNoteUrl: _voiceNotePath,
    );

    // Write to Hive offline sync queue
    await widget.syncService.logScan(scan);

    setState(() {
      _isProcessing = false;
    });

    _showCompletionDialog();
  }

  void _showCompletionDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF12181A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(
              _withinGeofence ? Icons.check_circle : Icons.warning_amber_rounded,
              color: _withinGeofence ? const Color(0xFF3DDCC5) : const Color(0xFFE8A33D),
            ),
            const SizedBox(width: 8),
            const Text('Log Logged', style: TextStyle(color: Colors.white, fontSize: 16, fontFamily: 'Space Grotesk')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_checkpointName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            Text(
              _withinGeofence 
                  ? 'Patrol validated. Point is inside route geofence.' 
                  : 'GEOFENCE WARNING: Scanner was out of range. Location recorded.',
              style: TextStyle(color: _withinGeofence ? Colors.white70 : const Color(0xFFE8A33D), fontSize: 12),
            ),
            const SizedBox(height: 8),
            Text(
              'Distance: ${_scannedDistance.toStringAsFixed(1)}m / Allowed: ${_allowedRadius.toStringAsFixed(1)}m',
              style: const TextStyle(color: Colors.white30, fontSize: 10, fontFamily: 'IBM Plex Mono'),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context); // Close dialog
              Navigator.pop(context); // Return to Dashboard
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF3DDCC5).withOpacity(0.1),
              foregroundColor: const Color(0xFF3DDCC5),
              side: const BorderSide(color: Color(0xFF3DDCC5), width: 0.5),
            ),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F0E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF12181A),
        title: Text(
          _hasScannedCode ? 'Compile Patrol Report' : 'Scan Checkpoint Tag',
          style: const TextStyle(fontFamily: 'Space Grotesk', fontSize: 16, color: Colors.white),
        ),
        elevation: 0,
      ),
      body: _hasScannedCode
          ? SingleChildScrollView(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Scanned Point details card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF12181A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _withinGeofence
                            ? const Color(0xFF3DDCC5).withOpacity(0.1)
                            : const Color(0xFFE8A33D).withOpacity(0.15),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.between,
                          children: [
                            Text(
                              _checkpointName,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: _withinGeofence
                                    ? const Color(0xFF3DDCC5).withOpacity(0.1)
                                    : const Color(0xFFE8A33D).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                _withinGeofence ? 'VALIDATED' : 'BREACH',
                                style: TextStyle(
                                  color: _withinGeofence ? const Color(0xFF3DDCC5) : const Color(0xFFE8A33D),
                                  fontSize: 8,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'IBM Plex Mono',
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'TAG CODE: $_scannedTagCode',
                          style: const TextStyle(color: Colors.white30, fontSize: 10, fontFamily: 'IBM Plex Mono'),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Distance: ${_scannedDistance.toStringAsFixed(1)}m / allowed: ${_allowedRadius.toStringAsFixed(1)}m',
                          style: const TextStyle(color: Colors.white50, fontSize: 10, fontFamily: 'IBM Plex Mono'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Report Notes field
                  const Text(
                    'PATROL OBSERVATION REPORT NOTES',
                    style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _notesController,
                    maxLines: 4,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Describe perimeters checked, incident notes, or damage details...',
                      hintStyle: const TextStyle(color: Colors.white20, fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF12181A),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Media attachments cards
                  const Text(
                    'MEDIA REPORT ATTACHMENTS',
                    style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
                  const SizedBox(height: 12),
                  
                  Row(
                    children: [
                      // Photo attachment card
                      Expanded(
                        child: InkWell(
                          onTap: _simulateCapturePhoto,
                          child: Container(
                            height: 100,
                            decoration: BoxDecoration(
                              color: const Color(0xFF12181A),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _photoPath != null ? const Color(0xFF3DDCC5).withOpacity(0.3) : Colors.white.withOpacity(0.05),
                              ),
                            ),
                            child: _photoPath != null
                                ? Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: const [
                                      Icon(Icons.photo, color: Color(0xFF3DDCC5), size: 32),
                                      SizedBox(height: 8),
                                      Text('PHOTO LINKED', style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold)),
                                    ],
                                  )
                                : Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: const [
                                      Icon(Icons.camera_alt, color: Colors.white20, size: 32),
                                      SizedBox(height: 8),
                                      Text('ATTACH PHOTO', style: TextStyle(color: Colors.white30, fontSize: 10)),
                                    ],
                                  ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),

                      // Audio memo attachment card
                      Expanded(
                        child: InkWell(
                          onTap: _toggleAudioRecording,
                          child: Container(
                            height: 100,
                            decoration: BoxDecoration(
                              color: const Color(0xFF12181A),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _isRecordingAudio 
                                    ? Colors.blue.withOpacity(0.4) 
                                    : _voiceNotePath != null 
                                        ? const Color(0xFF3DDCC5).withOpacity(0.3) 
                                        : Colors.white.withOpacity(0.05),
                              ),
                            ),
                            child: _isRecordingAudio
                                ? Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: const [
                                      Icon(Icons.mic, color: Colors.blue, size: 32),
                                      SizedBox(height: 8),
                                      Text('RECORDING... TAP OK', style: TextStyle(color: Colors.blue, fontSize: 9, fontWeight: FontWeight.bold)),
                                    ],
                                  )
                                : _voiceNotePath != null
                                    ? Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: const [
                                          Icon(Icons.audiotrack, color: Color(0xFF3DDCC5), size: 32),
                                          SizedBox(height: 8),
                                          Text('AUDIO MEMO LINKED', style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold)),
                                        ],
                                      )
                                    : Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: const [
                                          Icon(Icons.mic, color: Colors.white20, size: 32),
                                          SizedBox(height: 8),
                                          Text('RECORD VOICE', style: TextStyle(color: Colors.white30, fontSize: 10)),
                                        ],
                                      ),
                          ),
                        ),
                      )
                    ],
                  ),
                  const SizedBox(height: 48),

                  // SUBMIT REPORT TRIGGER
                  ElevatedButton(
                    onPressed: _isProcessing ? null : _submitPatrolLog,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3DDCC5),
                      foregroundColor: const Color(0xFF0B0F0E),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 4,
                    ),
                    child: _isProcessing
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: Color(0xFF0B0F0E), strokeWidth: 2),
                          )
                        : const Text(
                            'SUBMIT PATROL REPORT',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                  ),
                ],
              ),
            )
          : Column(
              children: [
                // Live camera scanner
                Expanded(
                  flex: 3,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      MobileScanner(
                        onDetect: (capture) {
                          final List<Barcode> barcodes = capture.barcodes;
                          if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
                            _handleTagScanned(barcodes.first.rawValue!);
                          }
                        },
                      ),
                      Container(
                        width: 220,
                        height: 220,
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFF3DDCC5), width: 2),
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      if (_isProcessing)
                        Container(
                          color: Colors.black70,
                          child: Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const CircularProgressIndicator(color: Color(0xFF3DDCC5)),
                                const SizedBox(height: 16),
                                Text(
                                  _statusMessage ?? 'Reading coordinates...',
                                  style: const TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'IBM Plex Mono'),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

                // Simulator Panel for offline sandbox testing
                Expanded(
                  flex: 2,
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    color: const Color(0xFF12181A),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'DEVELOPMENT SCAN SIMULATOR',
                          style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1),
                        ),
                        const SizedBox(height: 12),
                        if (_cachedCheckpoints.isEmpty)
                          const Text(
                            'No cached checkpoints found. Log in online to pre-fetch route points.',
                            style: TextStyle(color: Colors.white50, fontSize: 12),
                          )
                        else
                          Expanded(
                            child: ListView.separated(
                              itemCount: _cachedCheckpoints.length,
                              separatorBuilder: (context, index) => const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                final cp = _cachedCheckpoints[index];
                                return InkWell(
                                  onTap: _isProcessing ? null : () => _handleTagScanned(cp['tag_code'] as String),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: Colors.black20,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: Colors.white.withOpacity(0.03)),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.between,
                                      children: [
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              cp['name'] as String,
                                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                            ),
                                            Text(
                                              'TAG: ${cp['tag_code']}',
                                              style: const TextStyle(color: Colors.white35, fontSize: 9, fontFamily: 'IBM Plex Mono'),
                                            ),
                                          ],
                                        ),
                                        const Icon(Icons.arrow_forward_ios, size: 12, color: Colors.white30),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                      ],
                    ),
                  ),
                )
              ],
            ),
    );
  }
}
