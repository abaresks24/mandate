//! MANDATE — Phase 2 integration crate.
//!
//! This crate has no runtime code of its own. It exists only to host the
//! `near-workspaces` sandbox integration tests in `tests/`, which deploy the
//! compiled `coordinator` and `vault` wasms into a local `neard` sandbox and
//! drive the real end-to-end composition (draw committee → commit/reveal →
//! tally → execute through the cross-contract callback).
