import 'package:flutter/material.dart';

/// App-wide color tokens. Use these instead of raw hex / Colors.grey.* in pages.
///
/// Brand (matches the web app):
/// - Primary: #006837 (brand green)       — 6.9:1 on white
/// - Secondary: #007D42 (supporting green)
/// - Accent: #E0C31A yellow — fills/highlights only, pair with [chateuText]
///
/// Every text token below meets WCAG AA (4.5:1) on white and on [chateuBackground].
const Color chateuBackground = Color(0xFFF7F9F7);
const Color chateuText       = Color(0xFF1A1A1A);
const Color chateuPrimary    = Color(0xFF006837);
const Color chateuSecondary  = Color(0xFF007D42);
const Color chateuAccent     = Color(0xFFE0C31A);

// ── Neutrals ──────────────────────────────────────────────────────────────────
const Color chateuSurface      = Colors.white;       // cards, sheets, inputs
const Color chateuSurfaceMuted = Color(0xFFEEF3EF);  // tinted fills, chips, empty icons
const Color chateuBorder       = Color(0xFFE1E7E2);  // card / input outlines, dividers
const Color chateuTextMuted    = Color(0xFF5B6B61);  // secondary text, 5.6:1
const Color chateuTextSubtle   = Color(0xFF6B7A70);  // captions, placeholders, 4.5:1

// ── Semantic ──────────────────────────────────────────────────────────────────
const Color chateuSuccess = Color(0xFF15803D);
const Color chateuWarning = Color(0xFFB45309);
const Color chateuError   = Color(0xFFDC2626);
const Color chateuInfo    = Color(0xFF0369A1);
