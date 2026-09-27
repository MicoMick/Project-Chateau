import 'package:flutter/material.dart';

/// App-wide color tokens. Use these instead of raw hex / Colors.* in pages.
///
/// Every token resolves against [appDark], which [MyApp] keeps in sync with
/// the platform brightness and rebuilds the tree when it flips. All text
/// tokens meet WCAG AA (4.5:1) on background, surface and surfaceMuted in
/// both appearances.
// ponytail: one global brightness flag instead of a ThemeExtension; move to
// context-bound tokens if a subtree ever needs its own theme.
bool appDark = false;

Color _pick(int light, int dark) => Color(appDark ? dark : light);

// ── Brand ─────────────────────────────────────────────────────────────────────
/// The logo green, for filled surfaces (buttons, drawer header, selected
/// days) in both appearances — always paired with [chateuOnBrand].
const Color chateuBrand   = Color(0xFF006837);
const Color chateuOnBrand = Colors.white;
const Color chateuLogoYellow = Color(0xFFF4DD03);

/// Green for text and icons. Light mode is the brand green itself; dark mode
/// lifts it along the logo's hue so it still reads on dark surfaces.
Color get chateuPrimary   => _pick(0xFF006837, 0xFF41AA75);
Color get chateuSecondary => _pick(0xFF007D42, 0xFF3FA06E);
/// Yellow — fills, highlights and text on dark/photo backgrounds only.
Color get chateuAccent    => _pick(0xFFE0C31A, 0xFFE0C31A);

/// Text/icons sitting on a semantic fill (error, warning, info).
Color get chateuOnColor   => _pick(0xFFFFFFFF, 0xFF06140C);

// ── Neutrals ──────────────────────────────────────────────────────────────────
Color get chateuBackground   => _pick(0xFFF7F9F7, 0xFF0F1411);
Color get chateuSurface      => _pick(0xFFFFFFFF, 0xFF171D19); // cards, sheets, inputs
Color get chateuSurfaceMuted => _pick(0xFFEEF3EF, 0xFF202822); // tinted fills, chips
Color get chateuBorder       => _pick(0xFFE1E7E2, 0xFF2C3530); // outlines, dividers
Color get chateuText         => _pick(0xFF1A1A1A, 0xFFE6ECE8);
Color get chateuTextMuted    => _pick(0xFF5B6B61, 0xFFA9B6AE); // secondary text
Color get chateuTextSubtle   => _pick(0xFF627167, 0xFF8E9C94); // captions, placeholders

// ── Semantic ──────────────────────────────────────────────────────────────────
Color get chateuSuccess => _pick(0xFF137638, 0xFF4ADE80);
Color get chateuWarning => _pick(0xFFA84C08, 0xFFF5A524);
Color get chateuError   => _pick(0xFFC81E1E, 0xFFF87171);
Color get chateuInfo    => _pick(0xFF0369A1, 0xFF5AB8F0);

// ── Announcement / report categories ─────────────────────────────────────────
Color get chateuMaintenance => _pick(0xFFC2410C, 0xFFFB923C);

Color announcementCategoryColor(String? category) {
  switch ((category ?? '').toLowerCase()) {
    case 'event':
      return chateuInfo;
    case 'maintenance':
      return chateuMaintenance;
    case 'election':
      return chateuError;
    case 'security':
      return chateuTextMuted;
    case 'financial':
      return chateuSecondary;
    default: // General
      return chateuPrimary;
  }
}
