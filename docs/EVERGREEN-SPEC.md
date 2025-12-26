# HF4A Card Explorer - Roadmap

Forward-looking specification for High Frontier 4 All Card Explorer.
For completed work, see [DONE.md](./DONE.md).

---

## Current State: v0.3.1

Working card explorer with SHOWXATING scan mode. Local OCR via PP-OCRv4 ONNX. Deployed at https://hf4a.github.io/

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
