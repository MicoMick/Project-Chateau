import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:video_player/video_player.dart';
import 'app_colors.dart';
import 'app_services.dart';
import 'domain/uploads/uploads.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';
import 'audit_logger.dart';

// ── Data ───────────────────────────────────────────────────────────────────────

class _CategoryData {
  final IconData icon;
  final String label;
  const _CategoryData(this.icon, this.label);
}

// ── Page ───────────────────────────────────────────────────────────────────────

class ReportPage extends StatefulWidget {
  const ReportPage({super.key});

  @override
  State<ReportPage> createState() => _ReportPageState();
}

class _ReportPageState extends State<ReportPage> {
  final _descController = TextEditingController();
  final _picker = ImagePicker();
  final _supabase = Supabase.instance.client;

  File? _pickedImage;
  Uint8List? _pickedImageBytes;
  // ── added: video state ─────────────────────────────────────────────────────
  File? _pickedVideo;
  Uint8List? _pickedVideoBytes;
  VideoPlayerController? _videoController;
  // ──────────────────────────────────────────────────────────────────────────
  bool _isSubmitting = false;
  int _selectedIndex = 0;

  static const _categories = [
    _CategoryData(Icons.build_rounded, "Maintenance"),
    _CategoryData(Icons.volume_off_rounded, "Noise"),
    _CategoryData(Icons.delete_sweep_rounded, "Cleanliness"),
    _CategoryData(Icons.shield_rounded, "Security"),
    _CategoryData(Icons.traffic_rounded, "Roads"),
    _CategoryData(Icons.more_horiz_rounded, "Other"),
  ];

  bool get _hasImage => _pickedImage != null || _pickedImageBytes != null;
  // ── added ──────────────────────────────────────────────────────────────────
  bool get _hasVideo => _pickedVideo != null || _pickedVideoBytes != null;
  // ──────────────────────────────────────────────────────────────────────────

  @override
  void dispose() {
    _descController.dispose();
    _videoController?.dispose(); // added
    super.dispose();
  }

  // ── Category ──────────────────────────────────────────────────────────────

  void _selectCategory(int index) {
    if (_selectedIndex == index) return;
    HapticFeedback.selectionClick();
    setState(() {
      _selectedIndex = index;
      _pickedImage = null;
      _pickedImageBytes = null;
      // added: clear video too
      _pickedVideo = null;
      _pickedVideoBytes = null;
      _videoController?.dispose();
      _videoController = null;
      _descController.clear();
    });
  }

  // ── Photo picker ──────────────────────────────────────────────────────────

  Future<void> _pickImage(ImageSource source) async {
    try {
      final xfile = await _picker.pickImage(
        source: source,
        imageQuality: 80,
        maxWidth: 1200,
      );
      if (xfile != null && mounted) {
        if (kIsWeb) {
          final bytes = await xfile.readAsBytes();
          if (!mounted) return;
          setState(() {
            _pickedImageBytes = bytes;
            _pickedImage = null;
          });
        } else {
          setState(() {
            _pickedImage = File(xfile.path);
            _pickedImageBytes = null;
          });
        }
        // added: clear any video when image chosen
        _pickedVideo = null;
        _pickedVideoBytes = null;
        _videoController?.dispose();
        _videoController = null;
      }
    } catch (e) {
      _showError(
          "Could not access ${source == ImageSource.camera ? 'camera' : 'gallery'}. Check permissions.");
    }
  }

  // ── Video picker ──────────────────────────────────────────────────────────

  Future<void> _pickVideo(ImageSource source) async {
    try {
      final xfile = await _picker.pickVideo(
        source: source,
        maxDuration: const Duration(minutes: 2),
      );
      if (xfile == null || !mounted) return;

      // clear any image when video chosen
      _pickedImage = null;
      _pickedImageBytes = null;
      _videoController?.dispose();
      _videoController = null;

      if (kIsWeb) {
        final bytes = await xfile.readAsBytes();
        if (!mounted) return;
        setState(() {
          _pickedVideoBytes = bytes;
          _pickedVideo = null;
        });
        final ctrl = VideoPlayerController.networkUrl(Uri.parse(xfile.path));
        await ctrl.initialize();
        if (mounted) setState(() => _videoController = ctrl);
      } else {
        final file = File(xfile.path);
        setState(() {
          _pickedVideo = file;
          _pickedVideoBytes = null;
        });
        final ctrl = VideoPlayerController.file(file);
        await ctrl.initialize();
        if (mounted) setState(() => _videoController = ctrl);
      }
    } catch (e) {
      _showError(
          "Could not access ${source == ImageSource.camera ? 'camera' : 'gallery'}. Check permissions.");
    }
  }

  void _toggleVideoPlayback() {
    if (_videoController == null) return;
    setState(() {
      _videoController!.value.isPlaying
          ? _videoController!.pause()
          : _videoController!.play();
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  Future<void> _submitReport() async {
    final description = _descController.text.trim();
    if (description.length < 10) {
      _showError("Please describe the issue in at least 10 characters.");
      return;
    }

    final user = _supabase.auth.currentUser;
    if (user == null) {
      _showError("You must be logged in to submit a report.");
      return;
    }

    setState(() => _isSubmitting = true);
    HapticFeedback.lightImpact();

    try {
      String? photoUrl;
      String? videoUrl; // added

      if (_hasImage) {
        photoUrl = await uploads.store(
            const Evidence.reportPhoto(),
            kIsWeb
                ? XFile.fromData(_pickedImageBytes!, name: 'photo.jpg')
                : XFile(_pickedImage!.path));
      }

      // added: upload video if present
      if (_hasVideo) {
        videoUrl = await uploads.store(
            const Evidence.reportVideo(),
            kIsWeb
                ? XFile.fromData(_pickedVideoBytes!, name: 'video.mp4')
                : XFile(_pickedVideo!.path));
      }

      await _supabase.from('reports').insert({
        'user_id': user.id,
        'category': _categories[_selectedIndex].label,
        'description': description,
        'photo_url': photoUrl,
        'video_url': videoUrl, // added
        'created_at': DateTime.now().toIso8601String(),
      });

      await logAudit('SUBMIT_REPORT', 'Filed a report — category: ${_categories[_selectedIndex].label}.');

      if (mounted) {
        _videoController?.dispose(); // added
        setState(() {
          _pickedImage = null;
          _pickedImageBytes = null;
          // added: clear video state
          _pickedVideo = null;
          _pickedVideoBytes = null;
          _videoController = null;
          _descController.clear();
          _isSubmitting = false;
        });
        _showSuccess("Report submitted successfully!");
      }
    } on StorageException catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      _showError("Upload failed: ${e.message}");
    } on PostgrestException catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      _showError("Could not save report: ${e.message}");
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      _showError("Something went wrong. Please try again.");
    }
  }

  void _showSuccess(String message) =>
      showAppSnack(context, message, type: SnackType.success);

  void _showError(String message) =>
      showAppSnack(context, message, type: SnackType.error);

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final hasMedia = _hasImage || _hasVideo;

    return SingleChildScrollView(
      padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
      child: AppContentWidth(
        maxWidth: 640,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.xl, AppSpacing.lg, AppSpacing.xxxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AppSectionHeader(title: "Submit a Report"),
              const SizedBox(height: AppSpacing.xs),
              Text(
                "Help us keep Chateau safe and comfortable.",
                style: AppText.bodyMedium.copyWith(color: chateuTextMuted),
              ),

              const SizedBox(height: AppSpacing.xl),
              Text("Category",
                  style: AppText.labelMedium.copyWith(color: chateuTextMuted)),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (var i = 0; i < _categories.length; i++)
                    ChoiceChip(
                      avatar: Icon(_categories[i].icon, size: 18),
                      label: Text(_categories[i].label),
                      selected: _selectedIndex == i,
                      showCheckmark: false,
                      onSelected: (_) => _selectCategory(i),
                    ),
                ],
              ),

              const SizedBox(height: AppSpacing.xl),
              TextField(
                controller: _descController,
                minLines: 4,
                maxLines: 8,
                maxLength: 500,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: "Description",
                  hintText: "Describe the issue in detail…",
                  alignLabelWithHint: true,
                ),
              ),

              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(
                    child: Text("Photo / Video (optional)",
                        style: AppText.labelMedium
                            .copyWith(color: chateuTextMuted)),
                  ),
                  if (hasMedia)
                    TextButton.icon(
                      onPressed: () => _showMediaPicker(context),
                      icon: const Icon(Icons.edit_rounded, size: 18),
                      label: const Text("Change"),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              AspectRatio(
                aspectRatio: 16 / 9,
                child: _hasVideo
                    ? _buildVideoPreview()
                    : _hasImage
                        ? _buildImagePreview()
                        : Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: () => _showMediaPicker(context),
                              borderRadius:
                                  BorderRadius.circular(AppRadius.sm),
                              child: CustomPaint(
                                painter: _DashedBorderPainter(
                                  color: chateuTextSubtle,
                                  borderRadius: AppRadius.sm,
                                  dashWidth: 6,
                                  dashGap: 4,
                                ),
                                child: Center(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.add_photo_alternate_outlined,
                                          size: 36, color: chateuPrimary),
                                      const SizedBox(height: AppSpacing.sm),
                                      Text(
                                        "Add a photo or video",
                                        style: AppText.bodyMedium.copyWith(
                                          color: chateuPrimary,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text("JPG, PNG, MP4",
                                          style: AppText.caption),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
              ),

              const SizedBox(height: AppSpacing.xxl),
              AppPrimaryButton(
                label: "Submit Report",
                isLoading: _isSubmitting,
                onPressed: _submitReport,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Media picker bottom sheet ────────────────────────────────────────────

  void _showMediaPicker(BuildContext context) {
    ListTile tile(IconData icon, String label, VoidCallback onTap) => ListTile(
          leading: Icon(icon),
          title: Text(label),
          onTap: () {
            Navigator.pop(context);
            onTap();
          },
        );

    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.sm, AppSpacing.sm, AppSpacing.sm, AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buildSheetHandle(),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: Text("Add Media", style: AppText.titleMedium),
              ),
              const SizedBox(height: AppSpacing.sm),
              if (!kIsWeb) ...[
                tile(Icons.camera_alt_rounded, "Take a photo",
                    () => _pickImage(ImageSource.camera)),
                tile(Icons.videocam_rounded, "Record a video",
                    () => _pickVideo(ImageSource.camera)),
              ],
              tile(Icons.photo_library_rounded, "Choose a photo",
                  () => _pickImage(ImageSource.gallery)),
              tile(Icons.video_library_rounded, "Choose a video",
                  () => _pickVideo(ImageSource.gallery)),
            ],
          ),
        ),
      ),
    );
  }

  // ── Image preview ─────────────────────────────────────────────────────────

  Widget _attachedLabel(IconData icon, String text) => Positioned(
        bottom: 0,
        left: 0,
        right: 0,
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          color: Colors.black.withAlpha(150),
          child: Row(
            children: [
              Icon(icon, color: Colors.white, size: 16),
              const SizedBox(width: AppSpacing.sm),
              Text(text,
                  style: AppText.caption.copyWith(
                      color: Colors.white, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      );

  Widget _buildImagePreview() {
    final w = (MediaQuery.sizeOf(context).width *
            MediaQuery.devicePixelRatioOf(context))
        .round();
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: Stack(
        fit: StackFit.expand,
        children: [
          kIsWeb
              ? Image.memory(_pickedImageBytes!,
                  fit: BoxFit.cover, cacheWidth: w)
              : Image.file(_pickedImage!, fit: BoxFit.cover, cacheWidth: w),
          _attachedLabel(Icons.check_circle_rounded, "Photo attached"),
        ],
      ),
    );
  }

  // ── Video preview ─────────────────────────────────────────────────────────

  Widget _buildVideoPreview() {
    final ctrl = _videoController;
    final playing = ctrl?.value.isPlaying ?? false;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: Stack(
        fit: StackFit.expand,
        children: [
          (ctrl != null && ctrl.value.isInitialized)
              ? FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: ctrl.value.size.width,
                    height: ctrl.value.size.height,
                    child: VideoPlayer(ctrl),
                  ),
                )
              : const ColoredBox(
                  color: Colors.black,
                  child: Center(
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2),
                  ),
                ),
          Semantics(
            button: true,
            label: playing ? 'Pause video' : 'Play video',
            child: GestureDetector(
              onTap: _toggleVideoPlayback,
              behavior: HitTestBehavior.opaque,
              child: Center(
                child: AnimatedOpacity(
                  opacity: playing ? 0.0 : 1.0,
                  duration: const Duration(milliseconds: 150),
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Colors.black.withAlpha(140),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.play_arrow_rounded,
                        color: Colors.white, size: 32),
                  ),
                ),
              ),
            ),
          ),
          _attachedLabel(Icons.videocam_rounded, "Video attached"),
        ],
      ),
    );
  }
}

// ── Dashed Border Painter ──────────────────────────────────────────────────────

class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double borderRadius;
  final double dashWidth;
  final double dashGap;

  _DashedBorderPainter({
    required this.color,
    required this.borderRadius,
    required this.dashWidth,
    required this.dashGap,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.6
      ..style = PaintingStyle.stroke;

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(borderRadius),
    );

    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      double distance = 0;
      while (distance < metric.length) {
        final next = distance + dashWidth;
        canvas.drawPath(
          metric.extractPath(distance, next.clamp(0, metric.length)),
          paint,
        );
        distance += dashWidth + dashGap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color;
}
