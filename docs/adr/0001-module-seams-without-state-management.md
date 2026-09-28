# Module seams without a state-management package

**Status:** accepted (2026-09-28)

## Context

The mobile app is a BSIT capstone project with a limited scope: one resident-facing Flutter app with about 20 pages on a shared Supabase backend. Supabase calls are currently scattered through page `State` classes. We're pulling the domain rules (Dues, Reservations, the Current Resident, Uploads, Format) into modules under `mobile/lib/domain/`, so they can be tested and explained.

## Decision

We use explicit constructor-based dependency injection. We don't use a state-management package.

- A page takes the module it needs through its constructor, e.g. `PaymentPage({Dues? dues})`. That parameter defaults to the Supabase-backed version, which is created at the composition root.
- A module depends on an abstract data source, e.g. `PaymentsSource`. Each data source has two implementations: a Supabase adapter for the app and an in-memory adapter for tests.
- Time-dependent rules take an injected clock instead of calling `DateTime.now()`.
- State that isn't shared stays local to its page or widget.

## Why

- **Fewer dependencies:** we add no framework, only plain Dart classes.
- **Easier for the team:** a student can follow a dependency by reading a constructor. There's no framework behaviour to learn.
- **Clearer module boundaries:** each module's interface and data source are visible in the code, so tests swap in the in-memory adapter.
- **Easier to explain at the defense:** the whole architecture fits in "pages call modules, modules call data sources".

## Tradeoffs

- A dependency needed deep in the widget tree has to be passed down through each constructor along the way.
- Nothing rebuilds automatically when shared data changes. A page reloads or is told to refresh. For example, the Current Resident is refreshed by hand after an Account edit.
- If the app grows a lot, this gets less convenient.

## Alternatives considered

- **Provider, Riverpod, Bloc, GetX:** rejected. None of them solves a problem we have today. Each adds a dependency, framework concepts and more to explain.
- **A global singleton:** rejected, because tests can't substitute the data source.

## Revisit when

- Several unrelated pages must react live to the same changing state, such as unread notification counts once a backend field exists, or realtime updates to the Balance. Refreshing by hand would then mean duplicated reload logic.
- Passing dependencies through constructors has to go more than two or three widgets deep in several places.
- The team grows, or the app outlives the capstone and gains features well beyond PRODUCT.md.

If none of these apply, don't add a package just to follow a common pattern.
