import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:video_player/video_player.dart';
import 'app_colors.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';

// ── Data ───────────────────────────────────────────────────────────────────────

class _CategoryData {
  final IconData icon;
  final String label;
  final Color color;
  const _CategoryData(this.icon, this.label, this.color);
}

// ── Page ───────────────────────────────────────────────────────────────────────

class ReportPage extends StatefulWidget {
  const ReportPage({super.key});

  @override
  State<ReportPage> createState() => _ReportPageState();
}

class _ReportPageState extends State<ReportPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entranceController;

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

  final List<_CategoryData> _categories = const [
    _CategoryData(Icons.build_rounded, "Maintenance", Color(0xFFFF8C42)),
    _CategoryData(Icons.volume_off_rounded, "Noise", Color(0xFFEF4444)),
    _CategoryData(Icons.delete_sweep_rounded, "Cleanliness", Color(0xFF22C55E)),
    _CategoryData(Icons.shield_rounded, "Security", Color(0xFF3B82F6)),
    _CategoryData(Icons.traffic_rounded, "Roads", Color(0xFF92400E)),
    _CategoryData(Icons.more_horiz_rounded, "Other", Color(0xFF6B7280)),
  ];

  bool get _hasImage => _pickedImage != null || _pickedImageBytes != null;
  // ── added ──────────────────────────────────────────────────────────────────
  bool get _hasVideo => _pickedVideo != null || _pickedVideoBytes != null;
  // ──────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
  }

  @override
  void dispose() {
    _entranceController.dispose();
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
      if (xfile != null) {
        if (kIsWeb) {
          final bytes = await xfile.readAsBytes();
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
      if (xfile == null) return;

      // clear any image when video chosen
      _pickedImage = null;
      _pickedImageBytes = null;
      _videoController?.dispose();
      _videoController = null;

      if (kIsWeb) {
        final bytes = await xfile.readAsBytes();
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
        final fileExt = kIsWeb ? 'jpg' : _pickedImage!.path.split('.').last;
        final fileName =
            '${user.id}/${DateTime.now().millisecondsSinceEpoch}.$fileExt';

        if (kIsWeb) {
          await _supabase.storage
              .from('report-photos')
              .uploadBinary(fileName, _pickedImageBytes!);
        } else {
          await _supabase.storage
              .from('report-photos')
              .upload(fileName, _pickedImage!);
        }

        photoUrl = _supabase.storage
            .from('report-photos')
            .getPublicUrl(fileName);
      }

      // added: upload video if present
      if (_hasVideo) {
        final fileExt = kIsWeb ? 'mp4' : _pickedVideo!.path.split('.').last;
        final fileName =
            '${user.id}/${DateTime.now().millisecondsSinceEpoch}.$fileExt';

        if (kIsWeb) {
          await _supabase.storage.from('report-videos').uploadBinary(
              fileName, _pickedVideoBytes!,
              fileOptions: const FileOptions(contentType: 'video/mp4'));
        } else {
          await _supabase.storage.from('report-videos').upload(
              fileName, _pickedVideo!,
              fileOptions: const FileOptions(contentType: 'video/mp4'));
        }

        videoUrl = _supabase.storage
            .from('report-videos')
            .getPublicUrl(fileName);
      }

      await _supabase.from('reports').insert({
        'user_id': user.id,
        'category': _categories[_selectedIndex].label,
        'description': description,
        'photo_url': photoUrl,
        'video_url': videoUrl, // added
        'created_at': DateTime.now().toIso8601String(),
      });

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
      setState(() => _isSubmitting = false);
      _showError("Photo upload failed: ${e.message}");
    } on PostgrestException catch (e) {
      setState(() => _isSubmitting = false);
      _showError("Could not save report: ${e.message}");
    } catch (e) {
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
    final mq = MediaQuery.of(context);
    final screenW = mq.size.width;
    final screenH = mq.size.height;
    final isSmall = screenH < 680;
    final isWide = screenW > 600;
    final hPad = isWide ? screenW * 0.08 : AppSpacing.lg;
    final selected = _categories[_selectedIndex];

    return Container(
      color: chateuBackground,
      child: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: EdgeInsets.symmetric(horizontal: hPad)
              .copyWith(bottom: AppSpacing.xxxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(height: isSmall ? 12 : AppSpacing.xl),

              // ── Header ────────────────────────────────────────────
              _AnimatedItem(
                controller: _entranceController,
                delay: 0.0,
                child: const AppSectionHeader(title: "Submit a Report"),
              ),

              const SizedBox(height: AppSpacing.xs),

              _AnimatedItem(
                controller: _entranceController,
                delay: 0.05,
                child: Text(
                  "Help us keep Chateau safe and comfortable.",
                  style: AppText.bodyMedium.copyWith(
                    color: Colors.grey.shade500,
                  ),
                ),
              ),

              SizedBox(height: isSmall ? 16 : AppSpacing.xl),

              // ── Category picker ───────────────────────────────────
              _AnimatedItem(
                controller: _entranceController,
                delay: 0.1,
                child: Text(
                  "Category",
                  style: AppText.labelMedium.copyWith(color: chateuText),
                ),
              ),

              const SizedBox(height: AppSpacing.sm),

              _AnimatedItem(
                controller: _entranceController,
                delay: 0.15,
                child: GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    childAspectRatio: 1.1,
                    crossAxisSpacing: AppSpacing.sm,
                    mainAxisSpacing: AppSpacing.sm,
                  ),
                  itemCount: _categories.length,
                  itemBuilder: (context, i) {
                    final cat = _categories[i];
                    final isSelected = _selectedIndex == i;
                    return GestureDetector(
                      onTap: () => _selectCategory(i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? cat.color.withAlpha(22)
                              : Colors.white,
                          borderRadius:
                              BorderRadius.circular(AppRadius.sm),
                          border: Border.all(
                            color: isSelected
                                ? cat.color
                                : Colors.grey.shade200,
                            width: isSelected ? 2 : 1,
                          ),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: cat.color.withAlpha(30),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  )
                                ]
                              : AppShadows.card,
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              cat.icon,
                              color: isSelected
                                  ? cat.color
                                  : Colors.grey.shade400,
                              size: 26,
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              cat.label,
                              style: AppText.caption.copyWith(
                                color: isSelected
                                    ? cat.color
                                    : Colors.grey.shade500,
                                fontWeight: isSelected
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),

              SizedBox(height: isSmall ? 16 : AppSpacing.xl),

              // ── Form card ─────────────────────────────────────────
              _AnimatedItem(
                controller: _entranceController,
                delay: 0.2,
                child: Container(
                  decoration: AppDecorations.card,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Card header
                      Container(
                        padding: const EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            AppSpacing.md,
                            AppSpacing.lg,
                            AppSpacing.md),
                        decoration: BoxDecoration(
                          color: selected.color.withAlpha(16),
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(AppRadius.md),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(selected.icon,
                                color: selected.color, size: 20),
                            const SizedBox(width: AppSpacing.sm),
                            Text(
                              selected.label,
                              style: AppText.titleMedium.copyWith(
                                color: selected.color,
                              ),
                            ),
                          ],
                        ),
                      ),

                      Padding(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Description
                            Text(
                              "Description",
                              style: AppText.labelMedium
                                  .copyWith(color: chateuText),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            TextField(
                              controller: _descController,
                              maxLines: isSmall ? 3 : 4,
                              maxLength: 500,
                              style: AppText.bodyMedium,
                              decoration: InputDecoration(
                                hintText:
                                    "Describe the issue in detail…",
                                hintStyle: AppText.bodyMedium.copyWith(
                                  color: Colors.grey.shade400,
                                ),
                                counterStyle: AppText.caption.copyWith(
                                  color: Colors.grey.shade400,
                                ),
                                filled: true,
                                fillColor: chateuBackground,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(
                                      AppRadius.sm),
                                  borderSide: BorderSide(
                                      color: Colors.grey.shade200),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(
                                      AppRadius.sm),
                                  borderSide: BorderSide(
                                      color: Colors.grey.shade200),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(
                                      AppRadius.sm),
                                  borderSide: const BorderSide(
                                      color: chateuPrimary, width: 1.5),
                                ),
                                contentPadding: const EdgeInsets.all(
                                    AppSpacing.md),
                              ),
                            ),

                            SizedBox(height: isSmall ? 12 : AppSpacing.lg),

                            // Photo label + menu trigger
                            Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  "Photo / Video (optional)", // updated label
                                  style: AppText.labelMedium
                                      .copyWith(color: chateuText),
                                ),
                                // ── updated: bottom sheet media picker ────────
                                GestureDetector(
                                  onTap: () => _showMediaPicker(context),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: AppSpacing.sm,
                                      vertical: AppSpacing.xs,
                                    ),
                                    decoration: BoxDecoration(
                                      color: chateuPrimary.withAlpha(14),
                                      borderRadius: BorderRadius.circular(
                                          AppRadius.xs),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          (_hasImage || _hasVideo)
                                              ? Icons.edit_rounded
                                              : Icons.add_photo_alternate_rounded,
                                          color: chateuPrimary,
                                          size: 16,
                                        ),
                                        const SizedBox(
                                            width: AppSpacing.xs),
                                        Text(
                                          (_hasImage || _hasVideo)
                                              ? "Change"
                                              : "Add",
                                          style:
                                              AppText.labelMedium.copyWith(
                                            color: chateuPrimary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                // ─────────────────────────────────────────────
                              ],
                            ),

                            const SizedBox(height: AppSpacing.sm),

                            // Photo / video preview / placeholder
                            AspectRatio(
                              aspectRatio: 16 / 9,
                              child: _hasVideo
                                  ? _buildVideoPreview() // added
                                  : _hasImage
                                      ? _buildImagePreview()
                                      : GestureDetector(
                                          onTap: () async {
                                            if (kIsWeb) {
                                              await _pickImage(
                                                  ImageSource.gallery);
                                            } else {
                                              // trigger same popup elsewhere
                                            }
                                          },
                                          child: CustomPaint(
                                            painter: _DashedBorderPainter(
                                              color: Colors.grey.shade300,
                                              borderRadius: AppRadius.sm,
                                              dashWidth: 6,
                                              dashGap: 4,
                                            ),
                                            child: Center(
                                              child: Column(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(
                                                    Icons.add_photo_alternate_outlined,
                                                    size: 36,
                                                    color:
                                                        Colors.grey.shade400,
                                                  ),
                                                  const SizedBox(
                                                      height: AppSpacing.sm),
                                                  Text(
                                                    "Use the Add button above",
                                                    style: AppText.bodyMedium
                                                        .copyWith(
                                                      color:
                                                          Colors.grey.shade500,
                                                      fontWeight:
                                                          FontWeight.w500,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 3),
                                                  Text(
                                                    kIsWeb
                                                        ? "Gallery  •  JPG, PNG, MP4"
                                                        : "Camera or Gallery  •  JPG, PNG, MP4",
                                                    style: AppText.caption
                                                        .copyWith(
                                                      color:
                                                          Colors.grey.shade400,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ),
                            ),

                            SizedBox(height: isSmall ? 20 : AppSpacing.xxl),

                            // Submit Button
                            AppPrimaryButton(
                              label: "Submit Report",
                              icon: Icons.send_rounded,
                              isLoading: _isSubmitting,
                              onPressed: _submitReport,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              SizedBox(height: isSmall ? 16 : AppSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }

  // ── Media picker bottom sheet (added) ────────────────────────────────────

  Widget _mediaSectionHeader(String label) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 14,
          decoration: BoxDecoration(
            color: chateuPrimary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        Text(label, style: AppText.labelMedium.copyWith(color: chateuText)),
      ],
    );
  }

  Widget _mediaOptionTile({
    required BuildContext ctx,
    required IconData icon,
    required String label,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
            vertical: AppSpacing.md, horizontal: AppSpacing.sm),
        decoration: BoxDecoration(
          color: chateuPrimary.withAlpha(10),
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: chateuPrimary.withAlpha(40)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: chateuPrimary.withAlpha(20),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: chateuPrimary, size: 22),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(label,
                style: AppText.labelMedium.copyWith(color: chateuText)),
            const SizedBox(height: 2),
            Text(subtitle,
                style: AppText.caption.copyWith(color: Colors.grey.shade500)),
          ],
        ),
      ),
    );
  }

  void _showMediaPicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.xxl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // drag handle
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // title
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  "Add Media",
                  style: AppText.titleMedium.copyWith(color: chateuText),
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  "Choose a source for your photo or video",
                  style: AppText.bodyMedium
                      .copyWith(color: Colors.grey.shade500),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              if (!kIsWeb) ...[
                _mediaSectionHeader("Camera"),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: _mediaOptionTile(
                        ctx: context,
                        icon: Icons.camera_alt_rounded,
                        label: "Photo",
                        subtitle: "Take a photo",
                        onTap: () {
                          Navigator.pop(context);
                          _pickImage(ImageSource.camera);
                        },
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: _mediaOptionTile(
                        ctx: context,
                        icon: Icons.videocam_rounded,
                        label: "Video",
                        subtitle: "Record a clip",
                        onTap: () {
                          Navigator.pop(context);
                          _pickVideo(ImageSource.camera);
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
              ],

              _mediaSectionHeader("Gallery"),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: _mediaOptionTile(
                      ctx: context,
                      icon: Icons.photo_library_rounded,
                      label: "Photo",
                      subtitle: "JPG, PNG",
                      onTap: () {
                        Navigator.pop(context);
                        _pickImage(ImageSource.gallery);
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _mediaOptionTile(
                      ctx: context,
                      icon: Icons.video_library_rounded,
                      label: "Video",
                      subtitle: "MP4, MOV",
                      onTap: () {
                        Navigator.pop(context);
                        _pickVideo(ImageSource.gallery);
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // ── Image preview ─────────────────────────────────────────────────────────

  Widget _buildImagePreview() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: Stack(
        fit: StackFit.expand,
        children: [
          kIsWeb
              ? Image.memory(_pickedImageBytes!, fit: BoxFit.cover)
              : Image.file(_pickedImage!, fit: BoxFit.cover),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withAlpha(160),
                  ],
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_rounded,
                      color: Colors.white, size: 15),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    "Photo attached  •  Use menu above to change",
                    style: AppText.caption.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Video preview (added) ─────────────────────────────────────────────────

  Widget _buildVideoPreview() {
    final ctrl = _videoController;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // player or loading spinner
          (ctrl != null && ctrl.value.isInitialized)
              ? FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: ctrl.value.size.width,
                    height: ctrl.value.size.height,
                    child: VideoPlayer(ctrl),
                  ),
                )
              : Container(
                  color: Colors.black,
                  child: const Center(
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2),
                  ),
                ),
          // play / pause tap
          GestureDetector(
            onTap: _toggleVideoPlayback,
            behavior: HitTestBehavior.opaque,
            child: Center(
              child: AnimatedOpacity(
                opacity: (ctrl?.value.isPlaying ?? false) ? 0.0 : 1.0,
                duration: const Duration(milliseconds: 200),
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.black.withAlpha(140),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.play_arrow_rounded,
                      color: Colors.white, size: 30),
                ),
              ),
            ),
          ),
          // bottom label (mirrors image preview style)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withAlpha(160),
                  ],
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.videocam_rounded,
                      color: Colors.white, size: 15),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    "Video attached  •  Use menu above to change",
                    style: AppText.caption.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
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

// ── Animation helper ───────────────────────────────────────────────────────────

class _AnimatedItem extends StatelessWidget {
  final AnimationController controller;
  final double delay;
  final Widget child;

  const _AnimatedItem({
    required this.controller,
    required this.delay,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final fade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: controller,
        curve: Interval(
          delay,
          (delay + 0.4).clamp(0.0, 1.0),
          curve: Curves.easeOut,
        ),
      ),
    );
    final slide =
        Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero).animate(
      CurvedAnimation(
        parent: controller,
        curve: Interval(
          delay,
          (delay + 0.4).clamp(0.0, 1.0),
          curve: Curves.easeOut,
        ),
      ),
    );
    return FadeTransition(
      opacity: fade,
      child: SlideTransition(position: slide, child: child),
    );
  }
}