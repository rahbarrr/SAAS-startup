# FieldTrack — Modern UI/UX System

**Scope:** A visual and interaction refresh of the existing FieldTrack web application.  
**Implementation baseline:** Current repository structure and domain vocabulary on `main` (Next.js App Router, React 19, TypeScript, Supabase-backed modules). This document does not authorize replacing the application's data layer, route structure, role checks, or security controls.

## 1. Design direction

### Product character
FieldTrack should feel like a calm, premium operations console: precise, dependable, fast to scan, and easy to use while a team is moving between stores. It is not a generic HR dashboard and should not look like a dense ERP.

### Visual principles
1. **Operational clarity first.** Every screen has one clear page title, a short explanation, one primary action, then the work area.
2. **Quiet chrome.** Neutral canvas, white/elevated surfaces, hairline borders, restrained shadows, and a small number of brand accents. Avoid large gradients, heavy neumorphic shadows, decorative rings on every metric, and oversized empty space.
3. **Real data only.** Metrics, charts, activity and status labels must remain sourced from the existing server components, services, repositories and APIs. Never add mock numbers to make a dashboard look full.
4. **Progressive disclosure.** Put the most-used filters and decisions up front; move advanced filters and secondary metadata behind compact controls.
5. **Mobile is a first-class work surface.** Use a compact two-column metric layout, short labels, horizontally scrollable tables/tabs where necessary, bottom navigation, and sticky/high-visibility primary actions.
6. **Trust is visible.** Preserve tenant context, role scope, approval provenance, human-review labels for AI drafts, location freshness and sync/error states.

### Inspiration reviewed
- Pinterest reference currently open in the connected browser: [HR Management Mobile App UI Design](https://in.pinterest.com/pin/638596422191393762/), linked to [Behance project](https://www.behance.net/gallery/197927065/HR-Management-Mobile-App-UI-Design). Used as a reference for compact mobile hierarchy and card rhythm only.
- [Field Service Management Dashboard — Oripio](https://dribbble.com/search/field-service-management-dashboard) for the map/dispatch + job queue composition.
- [SaaS dashboard design examples and trends (2026)](https://adminlte.io/blog/saas-dashboard-design/) and [sidebar navigation patterns](https://www.setproduct.com/blog/sidebar-navigation-patterns) for calm information density, responsive navigation and predictable dashboard structure.

These are visual references, not product requirements. FieldTrack’s existing route model and workflows remain authoritative.

## 2. Design tokens

The refresh uses a restrained blue operations palette and retains the current CSS theme switching.

| Token | Light theme | Dark theme | Intended use |
|---|---|---|---|
| Canvas | `#F6F8FC` | `#080D17` | Main application background |
| Surface | `#FFFFFF` | `#111A2B` | Cards, dialogs, filters |
| Raised surface | `#FFFFFF` | `#172338` | Menus, drawers, selected panels |
| Primary | `#2458D3` | `#6D96FF` | Primary actions, active navigation, links |
| Primary soft | `#EEF4FF` | `rgba(73, 121, 230, .16)` | Selected rows, secondary emphasis |
| Text | `#172033` | `#F3F6FC` | Main headings and values |
| Muted text | `#667085` | `#A3AEC2` | Descriptions and metadata |
| Border | `#E5EAF2` | `#26344B` | Dividers and card outlines |
| Success | `#15803D` | `#4ADE80` | Approved, completed, synced |
| Warning | `#B45309` | `#FBBF24` | Pending, delayed, attention |
| Danger | `#B91C1C` | `#F87171` | Rejected, failed, overdue |
| AI accent | `#7257D6` | `#A99AFF` | AI-generated content, clearly labelled |

Typography remains **Inter** for interface text and **Space Grotesk** for headings and prominent numeric values. Use 24–30px page titles on desktop, 21–24px on phones, 14–16px primary body text, and 12–13px supporting text. Keep status colors semantic rather than using them decoratively.

### Layout measurements
- Expanded sidebar: 256–264px; collapsed rail: existing collapsed-width token.
- Top application header: approximately 64px.
- Desktop content: max-width 1,500px, 24–32px outer padding.
- Desktop card radius: 14–16px; controls: 9–11px.
- Grid gap: 16–20px desktop; 10–12px phone.
- Touch targets: minimum 44px for primary interactive controls.
- Phone content: 12–16px horizontal padding with bottom safe-area space for the five-item navigation.

## 3. Global application shell

### Desktop
- Keep the existing left sidebar and role-aware navigation.
- Keep workspace switcher, verified role, notifications, theme control and user menu in the top bar.
- Active navigation uses a soft blue surface and clear icon/text contrast; avoid a large glowing pill.
- The content header follows a consistent pattern: breadcrumb, page title and description, right-aligned primary/secondary actions.

### Tablet and phone
- Use the existing mobile drawer for the complete navigation.
- Use the existing five-item bottom navigation for the most common operational routes.
- Keep the top bar short: menu, current page context, notification and profile affordances.
- Avoid two simultaneous navigation systems competing for attention.
- Make the current workspace and role discoverable in the drawer/profile context.

## 4. Role-aware dashboards

### Admin / Manager — Operations Overview
The top-to-bottom order should be:
1. Page heading with workspace context and date/filter controls.
2. Four compact operational KPI cards: submitted trips awaiting approval, approved/in-progress trips, completed visits, and exceptions requiring attention. Use the actual reporting service values and definitions.
3. A primary operations area: active field activity/map summary alongside recent activity or approvals.
4. A pending approval queue with employee, trip title, submission date, store count when available, and one clear review action.
5. Current in-progress trips with progress and overdue/attention indicators.
6. Recent visit evidence/activity and audit events.
7. Secondary analytics and export actions.

The dashboard must preserve current role scoping and the existing metric definitions. A field employee must never see organization-wide aggregates merely because the same visual component is reused.

### Field Employee — My Field Operations
- Lead with today's/next trip and the next required action.
- Show trip status and a concise stop-progress summary.
- Keep Check In / Continue Visit / Complete Checklist actions prominent when permitted by the existing trip/visit state.
- Show personal recent visits, approval decisions and sync/connection status.
- Do not show manager approval queues or organization-wide comparisons.

### Live Map
- Map is the dominant panel; filters and operator roster are supporting panels.
- Make freshness explicit: fresh, delayed, stale or offline, with a last-updated timestamp.
- Selecting an operator reveals only the details already returned by the current location feed.
- Provide a compact mobile filter row and a bottom/detail sheet pattern rather than squeezing a full roster beside the map.
- Preserve the current Realtime subscription and fallback refresh behavior; no UI-only “live” animation should imply new data.

## 5. Screen-by-screen layout patterns

| Screen | Primary content | Primary action | Supporting components |
|---|---|---|---|
| Overview | Operational KPIs, activity, approvals, active trips, exceptions | Plan New Trip / Review Queue | KPI cards, activity feed, progress, empty/error states |
| Live Map | Team map and location freshness | Refresh / inspect operator | Map, filters, operator list, selected operator panel |
| Trips | Trip list, lifecycle status, stop progress | Plan New Trip | Search, status filters, view toggle, trip cards/table |
| Trip detail | Route/stops, trip timeline, approval state | State-appropriate trip action | Stop list, timeline, map, audit information |
| Approvals | Submitted trips awaiting manager decision | Review / approve / request changes / reject | Approval cards, decision dialog, notes, status badge |
| Store Visits | Visits, status, check-in/out, evidence summary | Open visit / view trip | Compact KPI tiles, filters, visit list, evidence indicators |
| Visit execution | Check-in/out, checklist and evidence | Continue / submit visit | Stepper, checklist, upload progress, consent and sync states |
| Stores & Territories | Searchable store directory and location details | Add / import store (when authorized) | Store table, region filters, map/location details |
| Team Directory | Members, roles and membership state | Invite member (when authorized) | Member table, role/status badges, invite panel |
| Reports & Analytics | Date-scoped operational trends and records | Export CSV | Filter bar, summary metrics, charts, paginated tables |
| AI Insights | AI report drafts and reviewed outputs | Generate / review draft | Provenance badge, draft sections, review editor, usage states |
| Notifications | Event-derived notification stream and read receipts | Open related record / mark read | Notification list, unread state, category/date filters |
| Audit Logs | Immutable operational history | Filter / inspect record | Event table, actor/action/resource metadata |
| Settings | Workspace and account configuration | Save settings | Grouped settings sections, form validation, permission notice |

All pages keep their existing routes and real service/API calls. Page-specific actions must follow the existing domain state machine and authorization, not merely button visibility.

## 6. Shared component system

Use the existing components as the foundation; extend or style them rather than creating duplicate versions.

| Component | Responsibility | Required states / behavior |
|---|---|---|
| AppShell / SidebarNav | Global navigation and workspace context | expanded, collapsed, mobile drawer, active route, role-filtered |
| PageHeader | Page title, description, breadcrumbs and actions | desktop row, mobile stacked actions |
| KpiCard / GoalRingCard | Single operational metric | normal, loading, unavailable, compact mobile |
| StatusBadge | Semantic lifecycle, membership and sync state | success, warning, danger, info, neutral; accessible label |
| FilterBar | Search, status and date filters | desktop inline; mobile collapsible/stacked |
| DataTable | Sortable/paginated operational records | loading, empty, error, selected, narrow-screen horizontal scroll |
| ActivityFeed | Recent audit/visit activity | timestamp, actor, event, related-record link |
| ProgressIndicator | Trip stop and checklist completion | percentage/count with textual equivalent |
| ApprovalCard / DecisionPanel | Manager review and decision | pending, decision in-flight, completed, validation error |
| MapPanel / OperatorList | Current team location | fresh, delayed, stale, offline, selected |
| EvidenceGallery | Images/documents associated with a visit | upload, progress, retry, preview, signed-link error |
| EmptyState / LoadingState / ErrorState | Consistent data-state communication | actionable empty state, skeleton, safe error + retry |
| AIReviewPanel | Draft/review separation | generated draft, edited draft, accepted/reviewed, unavailable |

### Component rules
- Prefer a single primary action per card or section.
- Keep labels sentence-case; avoid long uppercase labels in dense cards.
- Use icons to reinforce meaning, never as the only label for a critical action.
- Show counts next to queues and filters only when derived from actual data.
- Buttons with a destructive result require a confirmation step.
- Every interactive control needs disabled/loading behavior and an accessible name.
- Tables should keep row actions available on mobile via a compact action menu or detail route, not force tiny inline buttons.

## 7. Responsive behavior

### Desktop (≥ 1,024px)
- Sidebar + top bar + content canvas.
- Four-column KPI grid when the available width supports it.
- Two-column bento or operations layouts.
- Full table density with readable row height and column spacing.

### Tablet (768–1,023px)
- Sidebar may collapse; content uses two-column KPI grid.
- Bento layouts stack when map/detail content would be cramped.
- Filter controls wrap without hiding their selected values.

### Phone (≤ 767px)
- Two-column KPI grid; each card uses a compact title, value and one supporting line.
- Large charts simplify to one compact chart or a scrollable summary; never shrink labels until illegible.
- Tables scroll horizontally within their own surface or switch to record cards where that screen already has an appropriate card pattern.
- Keep filter controls stacked/collapsible.
- Keep actions 44px high where practical; do not reduce touch targets to achieve visual density.
- Map and operator details stack vertically; selected operator details appear below or in a sheet.
- Reserve safe-area padding beneath the fixed bottom navigation.

### Very narrow phones (≤ 360px)
- Preserve a two-column grid only for short KPI labels and values; allow a specific long metric to span both columns.
- Hide decorative secondary labels before hiding actionable information.
- Prevent page-level horizontal overflow.

## 8. Data states and accessibility

Every data-backed screen must deliberately render:
- **Loading:** skeletons shaped like the final content; no jumping page layout.
- **Empty:** explain what is absent and offer one relevant next step.
- **Error:** clear message, safe retry when available, no raw stack traces or secrets.
- **Success:** update the affected panel and announce important state changes accessibly.
- **Offline / delayed:** distinguish unsynced work from stale read-only data.

Accessibility requirements:
- WCAG 2.1 AA contrast for text and controls.
- Visible focus indicators and logical keyboard order.
- Correct heading order and landmarks.
- Status badges include text and accessible labels; color alone is insufficient.
- Progress has a textual value, not only a colored ring/bar.
- Reduced-motion preferences are respected.
- Map-only information has a companion list/detail representation.

## 9. Implementation boundaries and acceptance checklist

This is a presentation-layer refresh. Do not change:
- authentication/session handling, organization resolution or role checks;
- Supabase RLS, database migrations, or tenant boundaries;
- trip/visit lifecycle rules or self-approval prevention;
- location permission, GPS collection cadence, geofence radius or retention;
- evidence storage/signing/upload authorization;
- AI prompt policy, human-review requirement, quotas or secret handling;
- existing API contracts, repository/domain/service logic or CSV security.

Before merging, verify:
- every current dashboard route renders with real data and with empty/error states;
- manager/admin and field_employee views remain distinct;
- the sidebar, mobile drawer and bottom navigation work at 320px, 375px, 768px, 1,024px and desktop widths;
- no horizontal page overflow, clipped dialog, overlapping fixed nav or inaccessible icon-only action;
- light and dark themes retain semantic status contrast;
- keyboard navigation, focus and screen-reader labels remain usable;
- all existing typecheck, lint, unit and integration tests pass;
- visual checks include Overview, Live Map, Trips, Approvals, Store Visits, Visit detail, Stores, Team, Reports, AI Insights, Notifications, Audit and Settings.

**Important:** The uploaded October architecture prompt is an earlier blueprint. The codebase's actual route/domain names and current implementation are the source of truth for this refresh. Do not reintroduce its older monorepo/Next.js/Expo assumptions into this web UI task.
