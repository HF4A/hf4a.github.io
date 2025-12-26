# HF4A Card Explorer - Roadmap

Forward-looking specification for High Frontier 4 All Card Explorer.
For completed work, see [DONE.md](./DONE.md).

---

## Current State: v0.3.9

Working card explorer with SHOWXATING scan mode. Local OCR via PP-OCRv4 ONNX. Deployed at https://hf4a.github.io/

---

## Cloud Vision Replatform (In Progress)

Replace local PP-OCRv4 ONNX with OpenAI Vision API via Cloudflare Workers.

**Target version:** v0.4.0 (breaking change - removes local OCR)

### Rollback Checkpoint
```
git checkout 59dfff3  # v0.3.9 - last stable local OCR version
```
Key files preserved at v0.3.9:
- `public/models/*.onnx` - PP-OCRv4 models (15.5MB)
- `src/features/showxating/services/ocrEngine.ts`
- `src/features/showxating/services/ocrService.ts`
- `src/features/showxating/services/matchFusion.ts`

### Status
- [x] Cloudflare Worker deployed: `https://hf4a-card-scanner.github-f2b.workers.dev`
- [x] Model evaluation complete: GPT-4.1-mini recommended (100% name accuracy, 2-9s latency)
- [x] Bbox detection tested: Full-frame approach works (model returns card positions)
- [x] Authentication scheme designed (invite code + deviceId)
- [ ] Implementation (see checklist below)

### Implementation Checklist

**Worker (Cloudflare):**
- [ ] Create KV namespace `HF4A_AUTH`
- [ ] Add KV binding to wrangler.toml
- [ ] Implement `/register` endpoint
- [ ] Add token validation middleware to `/scan`
- [ ] Seed initial invite code (ROSS2024)

**Client (React):**
- [ ] Create `src/services/cloudScanner.ts` - API client with auth
- [ ] Create `src/services/authService.ts` - Token computation, registration
- [ ] Update welcome screen with invite code input
- [ ] Wire "Let's Get Started" to registration flow
- [ ] Update scan hooks to use cloud API instead of local OCR
- [ ] Add offline detection + fallback to dHash-only

**Cleanup (after migration verified):**
- [ ] Remove `public/models/*.onnx` (15.5MB)
- [ ] Remove `ocrEngine.ts`, `ocrService.ts`, `textMatcher.ts`, `matchFusion.ts`
- [ ] Update PWA cache config (remove model caching)
- [ ] Update version to 0.4.0

### Architectural Decision: Full-Frame vs Hybrid

**Option A: Full-Frame Only** (remove OpenCV)
- Send entire camera frame to API
- Model returns cards + bboxes in one call
- Simpler code, 15.5MB smaller bundle
- **Downside:** No real-time bounding box feedback (2-16s wait)

**Option B: Hybrid** (keep OpenCV for detection)
- OpenCV runs locally at 15 FPS for immediate bbox overlay
- API call only for identification
- **Downside:** More code, OpenCV dependency remains

**Evaluation Results (2025-12-26):**
| Scenario | Latency | Name Accuracy | Bbox Quality |
|----------|---------|---------------|--------------|
| 1 card | 2.8s | 100% | Good |
| 9 cards | 18s | 100% | Good 3x3 grid |

**Prompt iterations:**
- v1: Card #1 returned type as name, generators returned invalid "side": "red"
- v2: Added clarification that card_name is at BOTTOM, side is BACK color → 100% accuracy

**Recommendation:** Start with full-frame (Option A) for simplicity. Add OpenCV back only if UX feedback during scanning is critical.

### Files to Remove (after migration)
- `public/models/*.onnx` (15.5MB)
- `src/features/showxating/services/ocrEngine.ts`
- `src/features/showxating/services/ocrService.ts`
- `src/features/showxating/services/textMatcher.ts`
- `src/features/showxating/services/matchFusion.ts`

### Authentication: Invite Code Scheme

**Goals:**
- Simple sharing (text someone a code)
- No API keys visible to users
- Track referrals (future)
- Revocable access

**Security model:**
- Client code is 100% public (GitHub Pages) - no secrets possible
- Invite code + deviceId together create trust relationship
- Neither alone is useful; both required to compute valid token

**Data flow:**
```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Admin (CLI)      │      │ Client           │      │ Worker + KV      │
│                  │      │                  │      │                  │
│ Create invite:   │      │                  │      │ INVITE:ROSS2024  │
│ wrangler kv put  │─────►│                  │      │ {owner,maxDev}   │
│                  │      │                  │      │                  │
│                  │      │ User enters code │      │                  │
│                  │      │ App gen deviceId │      │                  │
│                  │      │        │         │      │                  │
│                  │      │        ▼         │      │                  │
│                  │      │ POST /register   │─────►│ Validate invite  │
│                  │      │ {code, deviceId} │      │ Check device cap │
│                  │      │                  │      │ Compute token    │
│                  │      │                  │      │ Store TOKEN:xxx  │
│                  │      │                  │◄─────│ {success: true}  │
│                  │      │        │         │      │                  │
│                  │      │        ▼         │      │                  │
│                  │      │ POST /scan       │─────►│ Lookup TOKEN:xxx │
│                  │      │ Auth: Bearer xxx │      │ If valid: scan   │
│                  │      │ {image: base64}  │◄─────│ Return results   │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```

**UX: Welcome screen placement**
```
┌────────────────────────────────────────┐
│                                        │
│        HF4A Card Explorer              │
│                                        │
│   Scan and identify cards from         │
│   High Frontier 4 All                  │
│                                        │
│   ┌────────────────────────────────┐   │
│   │  Enter invite code             │   │
│   │  ┌──────────────────────────┐  │   │
│   │  │ ROSS2024                 │  │   │
│   │  └──────────────────────────┘  │   │
│   │  ☑ Remember on this device     │   │
│   └────────────────────────────────┘   │
│                                        │
│        [ Let's Get Started ]           │
│                                        │
└────────────────────────────────────────┘
```
- Invite code field appears on welcome/first-time screen
- Above "Let's Get Started" button
- Button disabled until valid code entered and registered
- Code stored in localStorage after successful registration
- Skip this screen on subsequent visits if code present

**Storage locations:**

| Location | Key | Value | Access |
|----------|-----|-------|--------|
| Client localStorage | `hf4a-invite-code` | `"ROSS2024"` | Device only |
| Client localStorage | `hf4a-device-id` | `"a1b2c3d4-..."` | Device only |
| Worker KV | `INVITE:ROSS2024` | `{ownerId, maxDevices, deviceCount}` | Admin |
| Worker KV | `TOKEN:<hash>` | `{inviteCode, deviceId, createdAt}` | Admin |
| Worker env | `OPENAI_API_KEY` | `sk-...` | Never exposed |

**Worker endpoints:**

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | None | Health check |
| `/register` | POST | None | Register device with invite code |
| `/scan` | POST | Bearer token | Scan card image |

**Admin: Creating invite codes**
```bash
# Create new invite code
wrangler kv put --namespace-id=<ID> "INVITE:ROSS2024" \
  '{"ownerId":"ross","maxDevices":5,"deviceCount":0,"createdAt":1735200000}'

# List all invite codes
wrangler kv list --namespace-id=<ID> --prefix="INVITE:"

# Revoke all devices for a code
wrangler kv list --namespace-id=<ID> --prefix="TOKEN:" | \
  jq -r '.[] | select(.metadata.inviteCode=="ROSS2024") | .name' | \
  xargs -I{} wrangler kv delete --namespace-id=<ID> "{}"
```

**Future: Referral tracking**
- Each invite code has `ownerId`
- When new user registers, record `invitedBy` = invite code owner
- Dashboard shows who invited whom
- Usage analytics per invite code

**Telemetry (current):**
- Cloudflare observability enabled (request logs, latency, errors)
- No custom analytics or user tracking beyond KV metadata
- No IP logging beyond Cloudflare defaults

**Telemetry Roadmap (Future):**

Expand telemetry based on invite code permissions:

| Invite Code Tier | Data Collected |
|------------------|----------------|
| `anonymous` | FinOps only: request count, latency, token usage, error rates |
| `standard` | + hashed device ID, model accuracy metrics, card type distribution |
| `research` | + stored images for model improvement, OCR confidence scores |

Implementation approach:
- Add `telemetryTier` field to invite code KV entry: `{ ..., telemetryTier: "anonymous" | "standard" | "research" }`
- Worker checks tier before storing additional data
- Research tier images stored in R2 bucket with TTL
- Privacy-preserving device ID: `SHA256(deviceId + "telemetry-salt")` (different from auth token)
- Dashboard for aggregate metrics (Cloudflare Analytics Engine or D1)

Use cases:
- Continuous model improvement from real-world card images
- Identify card types with low recognition accuracy
- Track cost per invite code for usage-based limits
- A/B test prompt variations

---

## Near-Term Polish

### UX Improvements
- [ ] **Scanning animation polish** - Stagger card matches so they don't all appear simultaneously. Show SCANNING → MATCH → overlay sequence with perceptible timing.
- [ ] **Manual correction stats** - Track and display count of manual corrections in SYS panel
- [ ] **Version update welcome** - Show welcome screen on minor version bumps (0.2.x → 0.3.x)

### Data Quality (from REVIEW.md)
- [ ] **Exodus cards** - 12 cards typed as "unknown" should be "exodus"
- [ ] **Missing UI fields** - colonistType, specialty, ideology, generatorType, reactorType not displayed
- [ ] **Radiator dual-side stats** - Light-side vs heavy-side columns not distinguished
- [ ] **GW Thruster/Freighter types** - "Type" column not captured in import

---

## Demo & Onboarding

- [ ] **Demo video on welcome** - Record iPhone walkthrough, transcribe with Belta dialect, narrate via ElevenLabs
  - Voice spec: "Working-class spacefaring accent inspired by Lang Belta. Light Caribbean cadence, Eastern European consonant hardness, pragmatic tone, restrained emotion."

---

## Phase 2: Stack Builder

*Future capability - not yet started*

- Drag cards to build spacecraft stacks
- Calculate total mass, thrust-to-weight ratio
- Validate support chains (reactor→generator→radiator dependencies)
- Export/share stack configurations
- Calculate delta-v and reachable destinations

---

## Phase 3: LLM-Powered Q&A

*Future capability - not yet started*

### Vision
Replace traditional search/filter with natural language queries. Eventually voice-enabled.

### Example Interactions
```
User: "Show me all colonists with futures involving robots"
→ Filters to: Colonist type, futures containing robot-related text

User: "What thrusters work with S-type spectral sites and have thrust > 5?"
→ Filters to: Thrusters, spectral=S, thrust≥5

User: "Which reactors don't need a radiator?"
→ Filters to: Reactors where requires does not include radiator

User (voice): "Find me low-mass robonauts for asteroid prospecting"
→ Interprets: Robonauts, low mass, ISRU suitable for asteroids (S/M/C types)
```

### Technical Approach
- OpenAI function calling for filter generation
- Query preprocessing for card-specific terminology
- Web Speech API for voice input
- Conversation context for query refinement

### API Key Handling
Options under consideration:
1. Cloudflare Worker as proxy (free tier: 100k requests/day)
2. User-provided OpenAI key (stored in localStorage)
3. Invite URL scheme for easy key sharing via iOS Messages

---

## Beyond

- [ ] **Expanse crew cards** - Create custom crew cards inspired by The Expanse TV show, complete with images

---

## Infrastructure

### Key Handling
- [ ] Evaluate Cloudflare Pages migration for complex AI capabilities
- [ ] If staying on GitHub Pages: implement invite URL scheme for API key injection (don't expect users to copy-paste keys)

---

## References

- [Original SPEC](./SPEC.md) - Full project specification with technical details
- [DONE.md](./DONE.md) - Completed features and milestones
- [Archive](./archive/) - Historical planning documents
