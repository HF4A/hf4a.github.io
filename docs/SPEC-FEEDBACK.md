# SPEC-FEEDBACK.md - Feedback & Diagnostics Collection System

## Overview

Add server-side feedback collection via Cloudflare R2 (free tier: 10GB storage, 10M ops/month). Two submission paths:

1. **Report Issue Modal** - Quick feedback during correction flow
2. **Upload Diagnostics** - Full diagnostic ZIP from SysPanel

Both route to the same R2 bucket for centralized retrieval.

---

## 1. Report Issue Modal

### Trigger Points
- New "REPORT" button in CorrectionModal header (next to CANCEL)
- Appears after user selects a correction (optional: before selection too)

### Pre-populated Data
From `IdentifiedCard`:
- `apiReturnedType` - What API detected (100% accurate)
- `extractedText` - OCR text from cloud API
- `computedHash` - Image fingerprint
- `originalCardId` + `originalConfidence` - Original match
- `topMatches` - Why it matched wrong

From `CapturedScan`:
- Cropped card image (derived from corners + imageDataUrl)
- `scanId`, `timestamp`
- `gridRows`, `gridCols`

From device context:
- App version, build hash
- Platform, user agent

### User Input
- Text area: "What went wrong?" (optional, 500 char max)
- Selected correction (if made): `correctedCardId`

### UI Flow
```
[CANCEL]                    [REPORT]
         IDENTIFY CARD

+---------------------------+---------------------------+
|  SCANNED REGION:          |  CANDIDATES (24):         |
|  [cropped image]          |  [scrollable list]        |
|                           |                           |
|  EXTRACTED TEXT:          |                           |
|  "thruster: de laval..."  |                           |
|                           |                           |
+---------------------------+---------------------------+

       ↓ User taps REPORT ↓

+-------------------------------------------------------+
|                   REPORT AN ISSUE                      |
+-------------------------------------------------------+
|  What the scanner saw:                                 |
|  [cropped image]  "UNKNOWN THRUSTER"                  |
|                                                        |
|  API detected: thruster                                |
|  Original match: thruster-02 (45%)                    |
|  Your correction: thruster-05                          |
|                                                        |
|  What went wrong? (optional)                          |
|  +--------------------------------------------------+ |
|  | The card name was hallucinated - it said         | |
|  | "Fissioned Engine" but that doesn't exist        | |
|  +--------------------------------------------------+ |
|                                                        |
|  [CANCEL]                              [SUBMIT REPORT] |
+-------------------------------------------------------+
```

---

## 2. Diagnostics Upload (SysPanel)

### Current State
- "SEND DIAGNOSTICS" creates ZIP locally, uses Web Share API
- Falls back to download if share unavailable

### New Behavior
- Primary: POST to `/feedback/diagnostics` endpoint
- Show comments field before upload
- Fallback: Keep existing share/download for offline use
- Show progress: "UPLOADING..." → "UPLOADED" / "UPLOAD FAILED"

### Data Sent
- Full diagnostics ZIP (already created by `exportDiagnosticsZip()`)
- User comments (optional, 500 char max)
- ~1-5MB typical size

---

## 3. Worker Endpoints

### POST `/feedback/report`
**Auth**: Bearer token (same as /scan)

**Request body**:
```json
{
  "type": "correction_report",
  "scanId": "scan-1735267928570",
  "cardIndex": 2,
  "apiReturnedType": "thruster",
  "extractedText": "thruster: de laval nozzle",
  "computedHash": "a1b2c3d4e5f6...",
  "originalCardId": "thruster-02",
  "originalConfidence": 0.45,
  "correctedCardId": "thruster-05",
  "topMatches": [{"cardId": "thruster-02", "distance": 12}, ...],
  "userComment": "Name was hallucinated",
  "croppedImage": "data:image/jpeg;base64,...",
  "metadata": {
    "appVersion": "0.5.12",
    "buildHash": "ABC123",
    "platform": "iPhone",
    "userAgent": "..."
  }
}
```

**Response**:
```json
{
  "success": true,
  "feedbackId": "fb-1735267928570-abc123",
  "message": "Report submitted"
}
```

**Storage**: R2 key `reports/{YYYY-MM}/{feedbackId}.json`

### POST `/feedback/diagnostics`
**Auth**: Bearer token

**Request**: multipart/form-data with ZIP file + optional comment field

**Response**:
```json
{
  "success": true,
  "feedbackId": "diag-1735267928570-abc123",
  "size": 2456789
}
```

**Storage**: R2 key `diagnostics/{YYYY-MM}/{feedbackId}.zip`

### GET `/feedback/list`
**Auth**: Admin only (ADMIN_TOKEN secret)

**Query params**: `?type=report|diagnostics&limit=50&after=cursor`

**Response**:
```json
{
  "items": [
    {
      "feedbackId": "fb-...",
      "type": "correction_report",
      "timestamp": "2025-12-26T...",
      "inviteCode": "ROSS2024",
      "apiReturnedType": "thruster",
      "hasImage": true
    }
  ],
  "cursor": "next-page-token"
}
```

### GET `/feedback/{feedbackId}`
**Auth**: Admin only

**Response**: Full JSON or ZIP download

---

## 4. R2 Storage Structure

```
hf4a-feedback-data/
├── reports/
│   └── 2025-12/
│       ├── fb-1735267928570-abc123.json
│       └── fb-1735267928571-def456.json
└── diagnostics/
    └── 2025-12/
        ├── diag-1735267928570-abc123.zip
        └── diag-1735267928571-def456.zip
```

**Metadata on each object**:
- `inviteCode` - Who submitted
- `timestamp` - When submitted
- `appVersion` - App version at submission
- `platform` - Device type
- `userComment` - User's description (if provided)

---

## 5. Implementation Plan

### Phase 1: Worker + R2 Setup
1. Create R2 bucket `hf4a-feedback-data` in Cloudflare dashboard
2. Add to `wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "HF4A_FEEDBACK"
   bucket_name = "hf4a-feedback-data"
   ```
3. Add `HF4A_FEEDBACK: R2Bucket` to Env interface
4. Implement `/feedback/report` endpoint
5. Implement `/feedback/diagnostics` endpoint
6. Deploy worker

### Phase 2: Report Issue Modal
1. Add `ReportIssueModal` component in `CapturedScanView.tsx`
2. Add "REPORT" button to CorrectionModal header
3. Wire up submission to `/feedback/report`
4. Add success/error feedback UI

### Phase 3: Diagnostics Upload
1. Add `uploadDiagnostics()` function to `exportDiagnostics.ts`
2. Update SysPanel button to show comments modal, then upload
3. Add upload progress/status indicators

### Phase 4: Admin Retrieval (Future)
1. Add `/feedback/list` and `/feedback/{id}` endpoints
2. Simple CLI tool or web UI to browse feedback
3. Export to CSV for analysis

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `workers/wrangler.toml` | Add R2 bucket binding |
| `workers/src/index.ts` | Add feedback endpoints, Env interface, rate limiting |
| `src/features/showxating/components/CapturedScanView.tsx` | Add ReportIssueModal, REPORT button |
| `src/features/showxating/services/exportDiagnostics.ts` | Add uploadDiagnostics() |
| `src/components/SysPanel.tsx` | Wire upload button with comments modal |
| `src/services/feedbackService.ts` | NEW: API client for feedback endpoints |

---

## 7. Cost Analysis

**Free tier limits** (more than sufficient):
- 10GB storage → ~2000-5000 reports with images
- 10M requests/month → ~300K reports/month
- 1GB egress → ~200-500 admin downloads/month

**If exceeded** (unlikely):
- Storage: $0.015/GB/month
- Requests: $0.36/million

---

## 8. Privacy Considerations

- No PII collected (no names, emails, locations)
- Device fingerprint (user agent) is coarse
- Invite codes are pseudonymous
- Images contain only game cards (not personal photos)
- 1-year auto-deletion policy via R2 lifecycle rules

---

## 9. Decisions (Confirmed)

1. **Admin auth**: Separate admin token (hardcoded secret `ADMIN_TOKEN` in worker secrets)
2. **Rate limiting**: Tied to invite code tier
   - Existing invites (ROSS2024, etc.): 100 submissions/day
   - New invite codes: 10 submissions/day per device
   - Track via KV: `RATE:{inviteCode}:{YYYY-MM-DD}` → count
3. **Retention**: 1 year auto-delete via R2 lifecycle rules
4. **Notifications**: Skip for v1 (manual dashboard checks)
