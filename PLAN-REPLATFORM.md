# HF4A Card Scanner Replatform Spec

## Executive Summary

Migrate from local PP-OCRv4 ONNX models (15.5MB, slow, accuracy issues) to OpenAI vision API hosted via Cloudflare Workers. Goal: faster inference, better accuracy, lighter client footprint.

**Key decision**: **GPT-4.1-mini** is the best choice after real-world evaluation:
- **100% card name accuracy** (vs 0-20% for GPT-5-nano)
- **2-6 second latency** (vs 20-35s for GPT-5-nano due to reasoning tokens)
- **Same cost** (~$0.0016/card)

Total monthly cost: **~$21** at baseline usage (10K cards).

---

## Current State

### Architecture
```
Camera → OpenCV (bounding box detection) → PP-OCRv4 (local ONNX) → Fuse.js (text match) + dHash (image match) → Match Fusion
```

### Problems
| Issue | Impact |
|-------|--------|
| PP-OCRv4 models: 15.5MB | Slow initial load, poor mobile experience |
| Single-threaded WASM | GitHub Pages lacks SharedArrayBuffer |
| OCR accuracy on small/distorted cards | ~70% accuracy multi-card scans |
| Type detection via color analysis | False positives |

### Key Files
- `src/features/showxating/services/ocrService.ts` - PP-OCRv4 integration
- `src/features/showxating/services/matchFusion.ts` - Score combination
- `public/models/` - 15.5MB ONNX models (can delete post-migration)

---

## Target Architecture

### Option A: OpenAI Vision via Cloudflare Workers (Recommended)

```
Camera → OpenCV (local, bounding boxes only) → Cloudflare Worker → OpenAI Vision API → JSON response
                                                    ↓
                                          Card IDs + confidence + vertices
```

**Why Cloudflare Workers**:
- Edge deployment (200+ cities, <100ms latency)
- Free tier: 100K requests/day
- Paid: $5/mo + $0.30/1M requests
- Simple CLI deployment (`wrangler deploy`)
- No GPU management

### Option B: Cloudflare Workers AI (Edge LLMs)

```
Camera → Cloudflare Worker → Workers AI (Llama 3.2 Vision 11B) → JSON response
```

**Pros**: Cheaper ($0.011/1K Neurons), no external API dependency
**Cons**: Lower accuracy than GPT-4.1-mini for structured extraction, beta models

### Option C: DigitalOcean Droplet + Functions

Simpler setup but no edge locations. Reserve for fallback if Cloudflare proves complex.

**Recommendation**: Start with Option A. Evaluate Option B if costs exceed projections.

---

## OpenAI Vision Model Comparison (Dec 2025)

### Real-World Evaluation Results (Dec 26, 2025)

Tested on 6 diagnostic images (1-9 cards each) from actual game sessions:

| Model | Latency | Input Tokens | Card Name Accuracy | Cost/Card |
|-------|---------|--------------|-------------------|-----------|
| **GPT-4.1-mini** | **2-9s** | 1,766 | **100%** | **$0.0016** |
| GPT-4o-mini | 3-8s | 37,109 | 0% (types only) | $0.0059 |
| GPT-5-nano | 22-35s | 1,654 | 0-20% (types only) | $0.0016 |

**Key finding**: GPT-5 models use "reasoning tokens" that consume output budget invisibly, causing:
- 20-35 second latency (vs 2-9s for GPT-4.1)
- Only card types returned, not actual names ("Radiator" vs "ETHER Charged Dust")

### GPT-4.1 Family - RECOMMENDED

| Model | Input $/1M | Output $/1M | Best For |
|-------|-----------|-------------|----------|
| **GPT-4.1-mini** | $0.40 | $1.60 | **Primary choice** - best accuracy + speed |
| GPT-4.1-nano | ~$0.10 | ~$0.40 | Untested - may be viable |

### GPT-5 Family - NOT Recommended (Reasoning Overhead)

| Model | Input $/1M | Output $/1M | Issue |
|-------|-----------|-------------|-------|
| GPT-5-nano | $0.05 | $0.40 | 20-35s latency, poor name accuracy |
| GPT-5-mini | $0.25 | $2.00 | Same issues |
| GPT-5 | $1.25 | $10.00 | Overkill |

GPT-5's reasoning tokens make it unsuitable for simple vision tasks - the model "thinks" too much.

### GPT-4o-mini - NOT Recommended (High Token Count)

Uses 37K input tokens vs 1.7K for GPT-4.1-mini (20x more expensive per request).

### Image Token Calculation

**GPT-5 family**: Unified token pricing for text + images. No separate multiplier.
- Typical card image: ~1,000-1,500 tokens

**GPT-4.x family** (high detail mode):
- 512px tiles: 170 tokens each + 85 base tokens
- Typical card (630x880px): ~765 tokens × 1.62 multiplier = **1,240 tokens/card**

---

## Cost Projections

### Baseline Usage
- 50 users × 100 scans/game × 2 games/month = **10,000 card identifications/month**

### Per-Card Cost (GPT-4.1-mini - Recommended)

| Component | Tokens | Cost |
|-----------|--------|------|
| Image input | ~1,766 | $0.00071 |
| Output | ~150 | $0.00024 |
| **Total/card** | | **$0.00095** |

### Monthly Costs

| Scenario | Cards/mo | OpenAI | Cloudflare | Total |
|----------|----------|--------|------------|-------|
| Baseline | 10,000 | $9.50 | $5.00 | **$14.50** |
| 2x usage | 20,000 | $19.00 | $5.00 | **$24.00** |
| 5x usage | 50,000 | $47.50 | $5.15 | **$52.65** |
| Viral (100K) | 100,000 | $95.00 | $5.30 | **$100.30** |

### Why Not GPT-5-nano (Cheaper on Paper)?

Despite lower $/token, GPT-5-nano is unsuitable:
- **30 second latency** - unacceptable for live scanning
- **0-20% name accuracy** - only returns card types, not names
- Reasoning tokens consume output budget invisibly

GPT-4.1-mini costs the same in practice (~$0.0016/card) but delivers 100% accuracy in 2-6 seconds.

---

## Implementation Plan

### Phase 0: Fail-Fast Prototype (1-2 days)

**Goal**: Validate GPT-5-nano can identify HF4A cards with >90% accuracy.

**Deliverables**:
1. Test script that sends 50 sample card images to GPT-5-nano
2. Compare GPT-5-nano vs GPT-5-mini accuracy (should be similar per benchmarks)
3. Prompt engineering for structured JSON output
4. Accuracy measurement against known card IDs

**Test Prompt** (iterate based on results):
```
Identify this High Frontier 4 All game card. Return JSON:
{
  "card_type": "crew|thruster|robonaut|refinery|reactor|radiator|generator|freighter|bernal|colonist|patent|event|factory|support",
  "card_name": "exact name on card",
  "side": "white|black|blue|gold|purple",
  "confidence": 0.0-1.0,
  "ocr_text": "raw text visible on card"
}
If multiple cards visible, return array. If not a game card, return {"error": "not_a_card"}.
```

**Success criteria**: >90% accuracy on single cards, >80% on multi-card scans.

**Model comparison matrix** (run same 50 cards through each):
| Model | Accuracy | Latency | Cost/50 cards |
|-------|----------|---------|---------------|
| GPT-5-nano | ? | ? | ~$0.006 |
| GPT-5-mini | ? | ? | ~$0.030 |

### Phase 1: Cloudflare Worker Setup (1 day)

**Prerequisites**:
- Cloudflare account
- `wrangler` CLI installed
- OpenAI API key

**Files to create**:

```
workers/
├── wrangler.toml       # Cloudflare config
├── src/
│   └── index.ts        # Worker entry point
└── package.json
```

**wrangler.toml**:
```toml
name = "hf4a-card-scanner"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
ALLOWED_ORIGINS = "https://hf4a.github.io"

# Secret: OPENAI_API_KEY (set via wrangler secret put)
```

**Deployment commands**:
```bash
cd workers
npm install
wrangler secret put OPENAI_API_KEY
wrangler deploy
```

### Phase 2: Worker Implementation (2-3 days)

**API endpoint**: `POST /api/scan`

**Request**:
```typescript
interface ScanRequest {
  image: string;          // Base64-encoded JPEG
  mode: 'detect' | 'identify' | 'full';
  model?: 'fast' | 'balanced' | 'accurate';
}
```

**Response**:
```typescript
interface ScanResponse {
  cards: Array<{
    id: string;           // e.g., "crew-01"
    name: string;         // "Mission Specialist"
    type: CardType;
    side: CardSide;
    confidence: number;
    bbox?: [x1, y1, x2, y2, x3, y3, x4, y4];  // Quadrilateral vertices
  }>;
  model_used: string;
  tokens_used: { input: number; output: number };
  latency_ms: number;
}
```

**Worker features**:
1. CORS handling (allow hf4a.github.io)
2. Rate limiting (prevent abuse)
3. Model selection based on `mode` parameter
4. Response caching (same image → cached result for 1 hour)
5. Error handling with fallback models

### Phase 3: Client Integration (2-3 days)

**Changes to existing code**:

1. **New service**: `src/features/showxating/services/cloudVision.ts`
   - Replaces `ocrService.ts` functionality
   - Handles image compression, API calls, response parsing

2. **Update**: `src/features/showxating/hooks/useCardIdentification.ts`
   - Switch from local OCR to cloud API
   - Add loading states for network latency
   - Graceful degradation if offline

3. **Remove**:
   - `public/models/` directory (15.5MB savings)
   - `ocrEngine.ts` (ONNX runtime loading)
   - ONNX-related dependencies

4. **Keep**:
   - OpenCV for local bounding box detection (optional pre-processing)
   - dHash matching as fallback for offline mode
   - Fuse.js for local search (catalog browsing)

**Hybrid mode** (recommended):
```
Online: Camera → Cloud API → Display results
Offline: Camera → OpenCV → dHash only → Lower confidence results
```

### Phase 4: Evaluation & Tuning (1-2 days)

**Metrics to track**:
- Accuracy by card type
- Latency (p50, p95, p99)
- Cost per session
- Error rate

**A/B test**:
- 50% traffic: GPT-4.1-mini only
- 50% traffic: Tiered (nano → mini → 4o)

**Dashboard**: Simple HTML page showing daily stats from Worker KV.

---

## Cloudflare Workers AI Evaluation (Optional Phase 5)

With GPT-5-nano at ~$1.20/month for baseline usage, Workers AI is **no longer cost-competitive** for this use case. Only evaluate if:
- OpenAI has outages requiring a fallback
- Privacy requirements prohibit external API calls
- Costs somehow exceed $20/month

### Available Vision Models (for reference)

| Model | Parameters | Neurons/request | Notes |
|-------|-----------|----------------|-------|
| `@cf/meta/llama-3.2-11b-vision-instruct` | 11B | ~500 | Best accuracy |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 24B | ~800 | Vision + tool calling |
| `@cf/google/gemma-3-12b-it` | 12B | ~600 | Multilingual |

### Cost Comparison (GPT-5 changes the calculus)

| Volume | GPT-5-nano | Workers AI (Llama 3.2) |
|--------|-----------|----------------------|
| 10K cards | **$1.20** | $5.50 |
| 50K cards | **$6.00** | $27.50 |
| 100K cards | **$12.00** | $55.00 |

**Verdict**: GPT-5-nano is 4-5x cheaper than Workers AI with better accuracy. Workers AI only makes sense as a privacy-first fallback.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OpenAI API downtime | Fallback to local dHash matching |
| Cost overrun | Rate limiting, tiered models, daily budget alerts |
| Latency spikes | Response caching, edge deployment |
| Accuracy issues | Prompt iteration, model fallback chain |
| Privacy concerns | Images not stored; processing only |

---

## Migration Checklist

- [ ] Phase 0: Prototype validation (>90% accuracy)
- [ ] Phase 1: Cloudflare Worker deployed
- [ ] Phase 2: API endpoint functional
- [ ] Phase 3: Client integration complete
- [ ] Phase 3b: Remove 15.5MB ONNX models
- [ ] Phase 4: Monitoring dashboard live
- [ ] Phase 5: (Optional) Workers AI evaluation
- [ ] Update README with new architecture

---

## Appendix A: Quick Start Commands

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create project
mkdir workers && cd workers
npm init -y
npm install @cloudflare/workers-types

# Set OpenAI API key
wrangler secret put OPENAI_API_KEY

# Deploy
wrangler deploy

# View logs
wrangler tail
```

## Appendix B: Alternative - DigitalOcean Droplet

If Cloudflare proves too complex:

```bash
# Create $6/mo droplet with Docker
doctl compute droplet create hf4a-api \
  --image docker-20-04 \
  --size s-1vcpu-1gb \
  --region nyc1

# Deploy simple Express server
docker run -d -p 3000:3000 \
  -e OPENAI_API_KEY=$KEY \
  hf4a/card-scanner
```

**Cons**: No edge deployment, higher latency for non-US users, requires server management.

---

## Sources

### GPT-5 Family
- [Introducing GPT-5 for developers](https://openai.com/index/introducing-gpt-5-for-developers/)
- [GPT-5 Model Docs](https://platform.openai.com/docs/models/gpt-5)
- [GPT-5 nano Model Docs](https://platform.openai.com/docs/models/gpt-5-nano)
- [GPT-5 mini Model Docs](https://platform.openai.com/docs/models/gpt-5-mini)
- [GPT-5 for Vision: 80+ Real-World Tests](https://blog.roboflow.com/gpt-5-vision-multimodal-evaluation/)
- [GPT-5 Technical Breakdown](https://encord.com/blog/gpt-5-a-technical-breakdown/)

### GPT-5.2 (Latest)
- [Introducing GPT-5.2](https://openai.com/index/introducing-gpt-5-2/)
- [GPT-5.2 Model Docs](https://platform.openai.com/docs/models/gpt-5.2)

### Pricing & Comparison
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [GPT-5 Pricing Calculator](https://livechatai.com/gpt-5-pricing-calculator)
- [GPT-5 Nano Pricing Guide](https://gptbreeze.io/blog/gpt-5-nano-pricing-guide/)
- [LLM API Pricing Comparison 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)

### Cloudflare
- [Cloudflare Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [Workers & Pages Pricing](https://www.cloudflare.com/plans/developer-platform/)
