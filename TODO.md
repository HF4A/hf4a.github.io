# TODO

Project documentation has been reorganized. See:

- **[docs/EVERGREEN-SPEC.md](docs/EVERGREEN-SPEC.md)** - Current roadmap and forward-looking items
- **[docs/DONE.md](docs/DONE.md)** - Completed features and milestones
- **[docs/SPEC.md](docs/SPEC.md)** - Full project specification
- **[docs/archive/](docs/archive/)** - Historical planning documents

---

## Future Worker Enhancements

### Direct Feedback Logging
Now that we have Cloudflare Workers, skip the Google Forms feedback mechanism. Log feedback directly to worker (KV or D1). No spec yet - just noting for future.

### Direct Diagnostics Upload
Instead of share sheet export for diagnostics, upload directly to worker (R2 bucket). Enables:
- Automatic telemetry collection
- Remote debugging without user action
- Model improvement from real scan data

No spec yet - future improvement.
