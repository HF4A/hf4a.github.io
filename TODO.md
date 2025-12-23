## SHOWXATING
- [x] Snap a picture mode, when held over multiple cards, allows you to go back to seat and flip cards at your leisure.
- [x] Change the style of the card catalog to match belter theme
- [x] Start on dynamic, then open card catalog.  Have a setting to determine which displays when app is open.
- [x] Add a button to SYS to reset to "factory settings" but say it in a fun belter way.  after a confirmation, this clears local state storage, forces browser reload, and thus shows the welcome screen again.
- [x] Confirm that diagnostic pack includes actual images in slots, not just URLs.
- [x] Slots shouldn't display when no scan in them.
- [x] Add version to first time welcome screen.  
- [ ] match on text extraction + image match.
- [ ] change blow the airlock to wipe the core
- [ ] when polishing, make sure scanning shows as least briefly, maybe stagger a bit so they don't all MATCH at the same time, or show SCANNING - MATCH - then load card overlay, with a perceptable but still snappy-feeling delay to let the user know that is happening.
- [ ] Update SYS stats on number of manual corrections
- [x] keep a limited depth set of logs, add a logs display button to SYS page that shows them in a very Belter space ship system looking way
- [ ] move version number to bottom under 'okey let's go' button, small and unobtrusive, next to the beratna quote (not another line)
- [ ] Show the first time welcome screen to users on middle number version update (0.2.7 to 0.3.0 for example)
- [ ] Belter / HF4A inspired favicon?
- [ ] the back-side card is backwards!

## Key Handling
- [ ] evaluate switching to cloudflare - would allow more complex AI capabilities in future.  If not, come up with 'invite URL scheme' which allows sharing link in apple messages, which opens installed app and injects the API key - I don't expect people to copy and paste the key.

## Simplified First Launch
- [x] On first launch, have a scrollable welcome screen, explaining the app's purpose and how to use, possibly with simple low-res mockups of the screen, in language that is sprinkled with Belta Creole but understandable for the most part, sasa ke?

## Demo Video
- [ ] on first launch, welcome screen, play embedded video.  I'll record a quick walkthrough on iphone, move it into project directory, have Claude make a time-stamped Belta infused transcript, and then have elevenlabs narrate using this dialect: “Working-class spacefaring accent inspired by Lang Belta.  Light Caribbean cadence, Eastern European consonant hardness, pragmatic tone, restrained emotion.”

## Beyond
- [ ] after making sure basic app works, create a series of crew cards inspired by the TV show "The Expanse", complete with images.

---

## 🔴 PICKUP POINT (2025-12-23 ~1:15am)

### Current State: v0.2.16
OCR text extraction in correction modal is broken - always shows "(no text detected)"

### What We Tried Tonight (all failed):
1. **Tesseract.js** - Extracted garbage like "ay _3 d Thr" for "Thruster"
2. **Tesseract + preprocessing** - Binarization, scaling to 200px - still garbage
3. **OCR.space API** (free tier) - Returns no text at all, even with clear images

### Files Modified:
- `src/features/showxating/components/CapturedScanView.tsx` - OCR logic is in the `CorrectionModal` component's useEffect (~line 628-720)
- Removed Tesseract.js import, now using fetch to OCR.space API
- Type region defined: `CARD_REGIONS.type = { x: 0, y: 0, w: 50, h: 18 }` (top-left of card)

### Likely Issues to Investigate:
1. **CORS** - OCR.space may block browser requests (check Network tab)
2. **Demo API key** - `helloworld` may have limitations
3. **Image format** - Currently sending JPEG data URL, maybe needs different format
4. Check the **logs** in diagnostics export - added debug logging for API response

### Other Bugs Fixed Tonight:
- ✅ Type filter now shows ALL cards of selected type (was showing empty)
- ✅ Front side image after correction (was showing ? due to .png vs .webp)
- ✅ Robonaut is pink, Thruster is orange (not pink as I wrongly said)

### Options for Tomorrow:
1. Debug OCR.space - check network tab, get real API key
2. Try **Puter.js OCR** - free, no API key needed
3. Try **Google Cloud Vision** - very accurate, free tier 1000/month
4. Skip cloud OCR, use better local: **PaddleOCR** (15MB WASM) or **EasyOCR**
5. Hybrid: use dHash for matching, OCR only for disambiguation/verification

### Key Insight:
The card TYPE label (Thruster, Refinery, etc.) is at TOP of card in colored banner.
The card NAME (Re-Solar Moth, etc.) is at BOTTOM.
Currently extracting from type region (top) - should be easier to read.