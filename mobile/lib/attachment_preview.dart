import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'app_colors.dart';
import 'app_theme.dart';
import 'app_dialogs.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Shared attachment preview — an announcement's attachment_url rendered as an
// inline image/PDF/link tile, with a fullscreen viewer for images. Used by
// both the Home dashboard's announcement cards and the Notifications page's
// announcement detail sheet, so they stay visually and behaviorally in sync.
// ─────────────────────────────────────────────────────────────────────────────

bool isImageAttachment(String url) {
  final u = url.toLowerCase();
  return u.contains('.jpg') ||
      u.contains('.jpeg') ||
      u.contains('.png') ||
      u.contains('.gif') ||
      u.contains('.webp');
}

bool isPdfAttachment(String url) => url.toLowerCase().contains('.pdf');

class AttachmentPreview extends StatelessWidget {
  final String url;
  final bool isImage;
  final bool isPdf;

  const AttachmentPreview({
    super.key,
    required this.url,
    required this.isImage,
    required this.isPdf,
  });

  @override
  Widget build(BuildContext context) {
    if (isImage) {
      final mq = MediaQuery.of(context);
      return Semantics(
        button: true,
        label: 'View full image',
        child: GestureDetector(
          onTap: () => _openFullscreen(context),
          child: Container(
            margin: const EdgeInsets.fromLTRB(
                AppSpacing.md, 0, AppSpacing.md, AppSpacing.sm),
            height: 180,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              color: chateuSurfaceMuted,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    url,
                    fit: BoxFit.cover,
                    cacheWidth: (mq.size.width * mq.devicePixelRatio).round(),
                    loadingBuilder: (_, child, progress) {
                      if (progress == null) return child;
                      return Center(
                        child: CircularProgressIndicator(
                          value: progress.expectedTotalBytes != null
                              ? progress.cumulativeBytesLoaded /
                                  progress.expectedTotalBytes!
                              : null,
                          color: chateuPrimary,
                          strokeWidth: 2,
                        ),
                      );
                    },
                    errorBuilder: (_, __, ___) => Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.broken_image_outlined,
                              color: chateuTextSubtle, size: 32),
                          const SizedBox(height: AppSpacing.xs),
                          Text("Could not load image",
                              style: AppText.caption
                                  .copyWith(color: chateuTextSubtle)),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(AppRadius.xxl),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.fullscreen_rounded,
                              color: Colors.white, size: 14),
                          const SizedBox(width: 3),
                          Text("View full",
                              style: AppText.caption
                                  .copyWith(color: Colors.white)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    if (isPdf) {
      return FileTile(
        url: url,
        icon: Icons.picture_as_pdf_rounded,
        iconColor: chateuError,
        label: url.split('/').last.split('?').first,
        onTap: () => _confirmOpenPdf(context, url),
      );
    }

    // External link
    return FileTile(
      url: url,
      icon: Icons.link_rounded,
      iconColor: chateuInfo,
      label: url,
      onTap: () => _confirmOpenLink(context, url),
    );
  }

  void _openFullscreen(BuildContext context) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) =>
          AttachmentFullscreen(url: url, isImage: isImage, isPdf: isPdf),
    ));
  }

  static Future<void> _confirmOpenPdf(BuildContext context, String url) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Open PDF',
      message:
          'Open this PDF in your browser?\n\n${url.split('/').last.split('?').first}',
      confirmLabel: 'Open PDF',
      icon: Icons.picture_as_pdf_rounded,
    );

    if (confirmed == true) {
      final uri = Uri.tryParse(url);
      if (uri != null) {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else if (context.mounted) {
          showAppSnack(context, 'Could not open PDF', type: SnackType.error);
        }
      }
    }
  }

  static Future<void> _confirmOpenLink(BuildContext context, String url) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Open Link',
      message: 'You are about to open an external link:\n\n$url',
      confirmLabel: 'Open',
      icon: Icons.open_in_new_rounded,
    );

    if (confirmed == true) {
      final uri = Uri.tryParse(url);
      if (uri != null && context.mounted) {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else if (context.mounted) {
          showAppSnack(context, 'Could not open link', type: SnackType.error);
        }
      }
    }
  }
}

// ── File Tile ──────────────────────────────────────────────────────────────────

class FileTile extends StatelessWidget {
  final String url;
  final IconData icon;
  final Color iconColor;
  final String label;
  final VoidCallback onTap;

  const FileTile({
    super.key,
    required this.url,
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, 0, AppSpacing.md, AppSpacing.sm),
      child: Material(
        color: iconColor.withAlpha(10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          side: BorderSide(color: iconColor.withAlpha(40)),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            child: Row(
              children: [
                Icon(icon, color: iconColor, size: 20),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    label.isNotEmpty ? label : "Attachment",
                    style: AppText.bodyMedium.copyWith(
                      color: iconColor,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 2,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Icon(Icons.open_in_new_rounded, color: iconColor, size: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Attachment Fullscreen ──────────────────────────────────────────────────────

class AttachmentFullscreen extends StatelessWidget {
  final String url;
  final bool isImage;
  final bool isPdf;

  const AttachmentFullscreen({
    super.key,
    required this.url,
    required this.isImage,
    required this.isPdf,
  });

  @override
  Widget build(BuildContext context) {
    String title;
    if (isImage) {
      title = "Photo";
    } else if (isPdf) {
      title = "PDF Document";
    } else {
      title = "Link";
    }

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        leading: const CloseButton(),
        title: Text(title,
            style: AppText.titleMedium.copyWith(color: Colors.white)),
      ),
      body: isImage
          ? InteractiveViewer(
              minScale: 0.5,
              maxScale: 5.0,
              child: Center(
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  loadingBuilder: (_, child, progress) {
                    if (progress == null) return child;
                    return Center(
                      child: CircularProgressIndicator(
                        value: progress.expectedTotalBytes != null
                            ? progress.cumulativeBytesLoaded /
                                progress.expectedTotalBytes!
                            : null,
                        color: chateuPrimary,
                      ),
                    );
                  },
                  errorBuilder: (_, __, ___) => Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.broken_image_outlined,
                            color: Colors.white54, size: 48),
                        const SizedBox(height: AppSpacing.md),
                        Text("Could not load image",
                            style: AppText.bodyMedium
                                .copyWith(color: Colors.white54)),
                      ],
                    ),
                  ),
                ),
              ),
            )
          : Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isPdf ? Icons.picture_as_pdf_rounded : Icons.link_rounded,
                      color: isPdf ? chateuError : chateuInfo,
                      size: 64,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      isPdf ? url.split('/').last.split('?').first : url,
                      style: AppText.bodyMedium.copyWith(color: Colors.white70),
                      textAlign: TextAlign.center,
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    ElevatedButton.icon(
                      onPressed: () async {
                        final uri = Uri.tryParse(url);
                        if (uri != null && await canLaunchUrl(uri)) {
                          await launchUrl(uri,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                      icon: const Icon(Icons.open_in_new_rounded, size: 16),
                      label: Text(isPdf ? "Open PDF" : "Open Link"),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
