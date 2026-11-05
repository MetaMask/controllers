## Explanation

Extension and mobile each had different `trackErrorAsAnalytics` helpers (and different event names / payloads). After discussion with mobile and follow-up with Mark Stacey, we agreed to put a shared helper in `@metamask/analytics-controller` instead, with a fresh `Error Occurred` event and no need for retro-compatibility with the older client events.

This PR adds `AnalyticsController.trackErrorAsAnalytics`, which:

- Emits `Error Occurred` with a unique `source` and a sanitized `error_message` (whitespace normalized, 500-character cap, no stack traces)
- Documents that `source` must uniquely identify the error case (not a shared label for every error in a file or package). Call sites with the same user impact may reuse the same `source`
- Reuses `trackEvent` for consent gating, the pre-consent queue, and geolocation enrichment
- Bounds volume with sampling, short-window deduplication, and a per-session cap (defaults: always emit, 10s, 50 events)
- Never throws, and does not consume session budget when the user is opted out

Example:

```ts
controller.trackErrorAsAnalytics(error, {
  source: 'swap-quote-fetch',
});
```

Dropped relative to the closed extension PR ([MetaMask/metamask-extension#47081](https://github.com/MetaMask/metamask-extension/pull/47081)), and later dropped from the shared API after review: `category`, `severity`, `context` / `error_context`, and MetaMetrics `buildOptions`.

Client migration of call sites is out of scope for this PR.

## References

- Related to [MetaMask/MetaMask-planning#7037](https://github.com/MetaMask/MetaMask-planning/issues/7037)
- Supersedes approach in [MetaMask/metamask-extension#47081](https://github.com/MetaMask/metamask-extension/pull/47081) (closed in favor of a shared controller API)

## Checklist

- [x] I've updated the test suite for new or updated code as appropriate
- [x] I've updated documentation (JSDoc, Markdown, etc.) for new or updated code as appropriate
- [x] I've communicated my changes to consumers by [updating changelogs for packages I've changed](https://github.com/MetaMask/core/tree/main/docs/processes/updating-changelogs.md)
- [ ] I've introduced [breaking changes](https://github.com/MetaMask/core/tree/main/docs/processes/breaking-changes.md) in this PR and have prepared draft pull requests for clients and consumer packages to resolve them
