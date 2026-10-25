# FieldTrack — Retail Pilot Onboarding Guide

Welcome to the **FieldTrack Controlled Pilot**. FieldTrack is an enterprise-grade, privacy-first field operations platform that connects retail managers and field representatives for efficient store audits, route planning, and verified compliance reporting.

---

## Part 1: System Concepts & Core Entities

| Concept | Description |
| :--- | :--- |
| **Organization (Tenant)** | An isolated workspace for your retail business (e.g. Acme Retailers). All data (stores, trips, visits, audit logs) is strictly isolated using PostgreSQL Row-Level Security. |
| **Store Directory** | The list of physical retail locations your team services, including address, region, and geographic coordinates. |
| **Trip** | A planned multi-stop journey assigned to a field representative for a designated date window (e.g. "Q4 Shelf Audit Route"). |
| **Trip Stop** | An individual store destination within a trip, sequenced in planned execution order. |
| **Store Visit** | The live execution record created when a field representative checks in to a store stop, capturing arrival timestamps, checklists, and photo evidence. |
| **Audit Trail** | An append-only, tamper-proof historical log recording every key status transition and manager decision. |

---

## Part 2: Field Representative Guide

### 2.1 First-Time Setup on Your Mobile Device
1. **Accept Your Invitation:** Check your email for an invitation link from your organization administrator. Click the link to set your password and activate your profile.
2. **Access FieldTrack in Your Mobile Browser:**
   - **Android:** Open Google Chrome and navigate to the FieldTrack URL. Tap the three dots menu (top right) and select **"Install app"** or **"Add to Home screen"**.
   - **iOS (iPhone):** Open Safari, navigate to the FieldTrack URL, tap the **Share** button (box with upward arrow), and select **"Add to Home Screen"**.
3. **Grant Permissions:**
   - **Location:** When prompted during check-in, tap **"Allow While Using App"**. FieldTrack records your location *only at point-of-check-in and point-of-checkout*, never continuous background tracking.
   - **Camera:** When prompted during evidence upload, tap **"Allow"** to capture live store photos directly.

### 2.2 Your Daily Field Workflow
1. **View Assigned Work:**
   - Open FieldTrack on your phone.
   - Go to **Trips** to see your approved itineraries for today.
   - Tap your trip to view the ordered list of store stops.
2. **Arrive & Check In:**
   - When you arrive at the store, tap **"Check In"** on the destination card.
   - The app captures your check-in timestamp and location coordinates.
   - The visit state transitions to `in_progress`.
3. **Execute the Store Audit:**
   - Complete all **Required Checklists** (e.g., verifying planogram alignment, cooler temperature, or promotional signage visibility).
   - If a compliance issue is observed, toggle the item and enter specific notes.
4. **Capture Photo Evidence:**
   - Tap **"Upload Photo"** under Visit Evidence.
   - Take a clear, well-lit photo of the display or problem area.
   - Add an optional caption (e.g., "Endcap Promotional Pricing Correct").
5. **Check Out & Complete:**
   - Review your checklist items to ensure all required fields are checked.
   - Enter your overall visit summary in the Field Notes box.
   - Tap **"Complete Check Out"**.
   - Your visit transitions to `submitted`, and the stop marks as `visited`.

### 2.3 Working Offline in Areas with Poor Connectivity
FieldTrack is engineered to work reliably in store basements or remote rural locations:
- **Automatic Local Storage:** As you complete checklist items and type notes, work is saved immediately to your phone's local storage.
- **Offline Indicator:** If cellular signal drops, an **"Offline"** badge appears in the top navigation bar.
- **Queued Mutations:** Your check-in, checklist answers, and notes are placed in a persistent queue.
- **Automatic Synchronization:** As soon as cellular or Wi-Fi connectivity returns, FieldTrack automatically synchronizes your queued actions to the server. You can also tap **"Sync Now"** in the sync banner.

---

## Part 3: Retail Manager Guide

### 3.1 Trip Planning & Scheduling
1. **Navigate to Trips:** Open the **Trips** module and click **"New Trip"**.
2. **Select Stops:** Add active retail stores from the directory to build the itinerary.
3. **AI Trip Planning Assistant:**
   - Click **"AI Route Insights"** inside the trip detail.
   - The AI Assistant evaluates stop sequences, detects scheduling conflicts with existing team assignments, and calculates potential travel savings.
   - **Human-in-the-Loop:** All recommendations are suggestions only. To apply a reordered sequence, review the proposed order and click **"Apply Recommended Sequence"**.
4. **Submit for Approval:** Submit the finalized trip plan.

### 3.2 Reviewing & Approving Trips (Approval Inbox)
1. **Open Approvals Inbox:** Go to `/approvals` to view trips submitted by field representatives.
2. **Review Itinerary:** Examine planned stores, appointment times, and driving feasibility.
3. **Make Decision:**
   - **Approve:** Authorizes the representative to begin field execution.
   - **Request Changes:** Sends the trip back to `draft` with mandatory feedback notes detailing required adjustments.
   - **Reject:** Declines the trip with an explanatory reason.
   - *Security Note: Self-approval is strictly forbidden by database security rules. Managers cannot approve their own trips.*

### 3.3 Visit Quality Review & Reporting
1. **Inspect Completed Visits:** Go to **Visits** to inspect field submissions.
2. **Review Evidence:** Inspect high-resolution photo evidence and checklist responses.
3. **Mark Reviewed:** Click **"Sign Off / Mark Reviewed"** to record formal managerial sign-off in the audit trail.
4. **Territory Analytics:** Go to **Reports** to track store coverage percentages, completed visits by region, and compliance trends.
5. **Export Data:** Export verified CSV reports for executive distribution via **"Export CSV"**.

### 3.4 Manager Daily Briefing
- Open **AI Insights** (`/ai-insights`) each morning.
- The system generates an executive summary highlighting:
  - Overdue visits requiring urgent manager intervention.
  - Pending approval requests awaiting decision.
  - Visits submitted with missing photo evidence.
- Click **"Accept"** or **"Dismiss"** on individual recommended action items.

---

## Part 4: Privacy, Data Security & Mobile Device Realities

### 4.1 Point-in-Time Location vs. Continuous Tracking
- FieldTrack **never** tracks employee movements continuously in the background.
- Coordinates are recorded only when the user explicitly triggers **Check-In**, **Check-Out**, or records a waypoint during an `in_progress` trip.
- Coordinates are stored as unverified device telemetry, not forensic proof of location truth.

### 4.2 Mobile Browser Constraints & Best Practices
- **Background Tab Suspension:** Mobile operating systems (especially iOS) suspend background browser tabs after 30–60 seconds. When in the store, keep FieldTrack open in the foreground while executing audits.
- **Battery Optimization:** Android aggressive battery-saver modes can throttle network requests. If sync appears delayed, opening FieldTrack in the foreground immediately initiates queue dispatch.
- **Photo Upload Size:** FieldTrack automatically compresses and uploads photos up to 25 MB using progressive streaming. In weak cellular conditions (1 bar / E), allow a few moments for photo upload confirmation before locking your device.

---

## Part 5: Pilot Support & Troubleshooting

| Issue | Resolution |
| :--- | :--- |
| **Check-In button says "Location Permission Denied"** | In your mobile browser settings, enable Location permissions for the FieldTrack site, refresh the page, and tap Check-In again. |
| **Cannot Check Out ("Required checklist incomplete")** | Ensure all checklist items marked with a red asterisk have been completed before tapping Check Out. |
| **"Session Expired" during offline work** | Your work remains safely preserved in your phone's local storage. Reconnect to the internet, sign back in, and tap "Sync Pending". |
| **Cannot approve trip** | The manager who created or owns a trip cannot approve it. A different manager or organization administrator must review and approve the trip. |

For technical support during the pilot, contact your dedicated FieldTrack Pilot Lead or submit an issue via the internal pilot feedback portal.
