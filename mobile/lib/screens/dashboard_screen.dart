import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:hive/hive.dart';
import '../services/supabase_service.dart';
import '../services/sync_service.dart';
import 'scan_page.dart';
import 'report_incident_screen.dart';
import 'login_screen.dart';

class DashboardScreen extends StatefulWidget {
  final SupabaseService supabaseService;

  const DashboardScreen({Key? key, required this.supabaseService}) : super(key: key);

  @override
  _DashboardScreenState createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _isLoading = false;
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _sites = [];
  String? _selectedSiteId;
  String? _activeShiftId;
  String? _activeSiteName;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() => _isLoading = true);
    try {
      final profile = await widget.supabaseService.fetchProfile();
      final sites = await widget.supabaseService.fetchSites();

      // Check if there is an active running shift in Hive local storage
      final sessionBox = Hive.box('session_data');
      final savedShiftId = sessionBox.get('active_shift_id') as String?;
      final savedSiteName = sessionBox.get('active_site_name') as String?;

      setState(() {
        _profile = profile;
        _sites = sites;
        if (sites.isNotEmpty && _selectedSiteId == null) {
          _selectedSiteId = sites.first['id'] as String;
        }
        _activeShiftId = savedShiftId;
        _activeSiteName = savedSiteName;
      });
    } catch (e) {
      print('Offline: loading from local profile cache');
      final sessionBox = Hive.box('session_data');
      setState(() {
        _profile = {
          'name': sessionBox.get('cached_user_name', defaultValue: 'Guard Field Officer'),
          'role': 'guard',
        };
        _activeShiftId = sessionBox.get('active_shift_id') as String?;
        _activeSiteName = sessionBox.get('active_site_name') as String?;
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _startShift() async {
    if (_selectedSiteId == null) return;
    setState(() => _isLoading = true);

    try {
      final siteObj = _sites.firstWhere((s) => s['id'] == _selectedSiteId);
      final siteName = siteObj['name'] as String;

      final shiftId = await widget.supabaseService.startShift(_selectedSiteId!);

      if (shiftId != null) {
        final sessionBox = Hive.box('session_data');
        await sessionBox.put('active_shift_id', shiftId);
        await sessionBox.put('active_site_id', _selectedSiteId);
        await sessionBox.put('active_site_name', siteName);

        setState(() {
          _activeShiftId = shiftId;
          _activeSiteName = siteName;
        });
      }
    } catch (e) {
      // Allow starting shift offline by creating a mock/temporary local shift ID
      final tempShiftId = 'local_shift_${DateTime.now().millisecondsSinceEpoch}';
      final siteObj = _sites.isNotEmpty 
          ? _sites.firstWhere((s) => s['id'] == _selectedSiteId) 
          : {'name': 'Offline Site Location'};
      final siteName = siteObj['name'] as String;

      final sessionBox = Hive.box('session_data');
      await sessionBox.put('active_shift_id', tempShiftId);
      await sessionBox.put('active_site_id', _selectedSiteId);
      await sessionBox.put('active_site_name', siteName);

      setState(() {
        _activeShiftId = tempShiftId;
        _activeSiteName = siteName;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Offline shift started. Scans will queue locally.')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _endShift({String? guardNotes}) async {
    if (_activeShiftId == null) return;
    setState(() => _isLoading = true);

    try {
      if (!_activeShiftId!.startsWith('local_shift_')) {
        await widget.supabaseService.endShift(_activeShiftId!, guardNotes: guardNotes);
      }

      final sessionBox = Hive.box('session_data');
      await sessionBox.delete('active_shift_id');
      await sessionBox.delete('active_site_id');
      await sessionBox.delete('active_site_name');

      setState(() {
        _activeShiftId = null;
        _activeSiteName = null;
      });
    } catch (e) {
      // Force end shift locally even if network fails
      final sessionBox = Hive.box('session_data');
      await sessionBox.delete('active_shift_id');
      await sessionBox.delete('active_site_id');
      await sessionBox.delete('active_site_name');

      setState(() {
        _activeShiftId = null;
        _activeSiteName = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Shift ended locally. Cleared active session.')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _promptEndShiftNotes(BuildContext context) {
    final notesController = TextEditingController();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF12181A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'End Active Shift',
          style: TextStyle(color: Colors.white, fontSize: 16, fontFamily: 'Space Grotesk'),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Please input optional summary report notes for management regarding your shift observations.',
              style: TextStyle(color: Colors.white70, fontSize: 12),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: notesController,
              maxLines: 3,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'e.g. All perimeters checked. wear on lock 3...',
                hintStyle: const TextStyle(color: Colors.white20, fontSize: 12),
                filled: true,
                fillColor: const Color(0xFF0B0F0E),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('CANCEL', style: TextStyle(color: Colors.white30)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _endShift(guardNotes: notesController.text.trim());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF3DDCC5).withOpacity(0.1),
              foregroundColor: const Color(0xFF3DDCC5),
              side: const BorderSide(color: Color(0xFF3DDCC5), width: 0.5),
            ),
            child: const Text('SUBMIT & END'),
          ),
        ],
      ),
    );
  }

  void _handleLogout() async {
    await widget.supabaseService.signOut();
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => LoginScreen(supabaseService: widget.supabaseService)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<SyncService>(
      create: (_) => SyncService(widget.supabaseService),
      child: Consumer<SyncService>(
        builder: (context, syncService, _) {
          return Scaffold(
            backgroundColor: const Color(0xFF0B0F0E),
            appBar: AppBar(
              backgroundColor: const Color(0xFF12181A),
              elevation: 0,
              title: const Text(
                'PatrolIQ Field Control',
                style: TextStyle(fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh, color: Color(0xFF3DDCC5)),
                  onPressed: () {
                    _loadDashboardData();
                    syncService.processQueue();
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.logout, color: Colors.white30),
                  onPressed: _handleLogout,
                ),
              ],
            ),
            body: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF3DDCC5)))
                : Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // User welcome block
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF12181A),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withOpacity(0.05)),
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 20,
                                backgroundColor: const Color(0xFF3DDCC5).withOpacity(0.1),
                                child: Text(
                                  _profile?['name']?.substring(0, 2).toUpperCase() ?? 'G',
                                  style: const TextStyle(color: Color(0xFF3DDCC5), fontWeight: FontWeight.bold, fontSize: 12),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _profile?['name'] ?? 'Guard Officer',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                                    ),
                                    Text(
                                      'ROLE: ${_profile?['role']?.toString().toUpperCase() ?? 'GUARD'}',
                                      style: const TextStyle(color: Colors.white30, fontSize: 9, fontFamily: 'IBM Plex Mono'),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Sync Queue Panel Status
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF12181A),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: syncService.state == SyncState.synced
                                  ? const Color(0xFF3DDCC5).withOpacity(0.1)
                                  : syncService.state == SyncState.syncing
                                      ? Colors.blue.withOpacity(0.15)
                                      : const Color(0xFFE8A33D).withOpacity(0.15),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.between,
                                children: [
                                  const Text(
                                    'SYNCHRONISATION QUEUE',
                                    style: TextStyle(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1),
                                  ),
                                  // State Indicator circle
                                  Row(
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: syncService.state == SyncState.synced
                                              ? const Color(0xFF3DDCC5)
                                              : syncService.state == SyncState.syncing
                                                  ? Colors.blue
                                                  : const Color(0xFFE8A33D),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        syncService.state == SyncState.synced
                                            ? 'ONLINE / SYNCED'
                                            : syncService.state == SyncState.syncing
                                                ? 'SYNCING...'
                                                : 'OFFLINE QUEUED',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontFamily: 'IBM Plex Mono',
                                          fontWeight: FontWeight.bold,
                                          color: syncService.state == SyncState.synced
                                              ? const Color(0xFF3DDCC5)
                                              : syncService.state == SyncState.syncing
                                                  ? Colors.blue
                                                  : const Color(0xFFE8A33D),
                                        ),
                                      ),
                                    ],
                                  )
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(
                                syncService.queueCount == 0
                                    ? 'All patrol scans safely uploaded to server database.'
                                    : 'There are ${syncService.queueCount} scan records pending upload cached locally.',
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                              if (syncService.queueCount > 0) ...[
                                const SizedBox(height: 12),
                                LinearProgressIndicator(
                                  value: syncService.state == SyncState.syncing ? null : 0.0,
                                  backgroundColor: Colors.white.withOpacity(0.05),
                                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF3DDCC5)),
                                )
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Shift Control Panel
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: const Color(0xFF12181A),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.white.withOpacity(0.05)),
                            ),
                            child: _activeShiftId == null
                                ? Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      const Icon(Icons.location_off, size: 48, color: Colors.white20),
                                      const SizedBox(height: 16),
                                      const Text(
                                        'No Active Shift Running',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 16),
                                      ),
                                      const SizedBox(height: 8),
                                      const Text(
                                        'Choose a site division to sign in and initiate your patrol route sequence.',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(color: Colors.white30, fontSize: 12),
                                      ),
                                      const SizedBox(height: 32),

                                      if (_sites.isNotEmpty) ...[
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 12),
                                          decoration: BoxDecoration(
                                            color: Colors.black20,
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: Colors.white.withOpacity(0.05)),
                                          ),
                                          child: DropdownButtonHideUnderline(
                                            child: DropdownButton<String>(
                                              value: _selectedSiteId,
                                              dropdownColor: const Color(0xFF12181A),
                                              style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'IBM Plex Mono'),
                                              items: _sites.map((s) {
                                                return DropdownMenuItem<String>(
                                                  value: s['id'] as String,
                                                  child: Text(s['name'] as String),
                                                );
                                              }).toList(),
                                              onChanged: (val) {
                                                setState(() => _selectedSiteId = val);
                                              },
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                      ],

                                      ElevatedButton(
                                        onPressed: _startShift,
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF3DDCC5).withOpacity(0.1),
                                          foregroundColor: const Color(0xFF3DDCC5),
                                          padding: const EdgeInsets.symmetric(vertical: 16),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          side: const BorderSide(color: Color(0xFF3DDCC5), width: 0.5),
                                        ),
                                        child: const Text('INITIATE SHIFT', style: TextStyle(fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  )
                                : Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      const Icon(Icons.explore, size: 48, color: Color(0xFF3DDCC5)),
                                      const SizedBox(height: 16),
                                      Text(
                                        'Active Shift: $_activeSiteName',
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'SHIFT ID: ${_activeShiftId!.substring(0, 12)}...',
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(color: Colors.white30, fontSize: 9, fontFamily: 'IBM Plex Mono'),
                                      ),
                                      const SizedBox(height: 40),

                                      // PRIMARY SCAN TRIGGER
                                      ElevatedButton.icon(
                                        onPressed: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) => ScanPage(
                                                shiftId: _activeShiftId!,
                                                scannedBy: _profile?['id'] ?? widget.supabaseService.currentUser!.id,
                                                syncService: syncService,
                                              ),
                                            ),
                                          );
                                        },
                                        icon: const Icon(Icons.qr_code_scanner, size: 24),
                                        label: const Text('SCAN CHECKPOINT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF3DDCC5),
                                          foregroundColor: const Color(0xFF0B0F0E),
                                          padding: const EdgeInsets.symmetric(vertical: 20),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                          elevation: 4,
                                        ),
                                      ),
                                      const SizedBox(height: 12),

                                      // SECONDARY REPORT INCIDENT TRIGGER
                                      ElevatedButton.icon(
                                        onPressed: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) => ReportIncidentScreen(
                                                shiftId: _activeShiftId!,
                                                siteId: _selectedSiteId ?? 'unknown_site',
                                                reportedBy: _profile?['id'] ?? (widget.supabaseService.currentUser?.id ?? 'guard_id'),
                                                supabaseService: widget.supabaseService,
                                              ),
                                            ),
                                          );
                                        },
                                        icon: const Icon(Icons.warning_amber_rounded, size: 22, color: Colors.orangeAccent),
                                        label: const Text('REPORT INCIDENT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.orangeAccent.withOpacity(0.15),
                                          foregroundColor: Colors.orangeAccent,
                                          padding: const EdgeInsets.symmetric(vertical: 16),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          side: BorderSide(color: Colors.orangeAccent.withOpacity(0.4), width: 1),
                                        ),
                                      ),
                                      const SizedBox(height: 16),

                                      // END SHIFT BUTTON
                                      OutlinedButton(
                                        onPressed: () => _promptEndShiftNotes(context),
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: Colors.redAccent,
                                          side: BorderSide(color: Colors.redAccent.withOpacity(0.3)),
                                          padding: const EdgeInsets.symmetric(vertical: 14),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                        child: const Text('END SHIFT', style: TextStyle(fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
          );
        },
      ),
    );
  }
}
