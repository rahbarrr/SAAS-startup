import { Stage, type Act, type Layout } from '../../kit'

type ModuleTab = 'Dashboard' | 'Analytics' | 'Field Trips' | 'Store Visits' | 'Live Radar' | 'Approvals'

interface State {
  activeTab: ModuleTab
  completedVisits: number
  distanceKm: string
  activePct: number
  selectedViewport: 'desktop' | 'tablet' | 'mobile'
}

const INITIAL: State = {
  activeTab: 'Dashboard',
  completedVisits: 48,
  distanceKm: '1,420 km',
  activePct: 68,
  selectedViewport: 'desktop',
}

const POSTER: State = {
  activeTab: 'Dashboard',
  completedVisits: 52,
  distanceKm: '1,548 km',
  activePct: 74,
  selectedViewport: 'desktop',
}

const script = async (a: Act<State>) => {
  await a.wait(900)
  a.mark('sync-telemetry')
  a.put((s) => ({
    ...s,
    completedVisits: 52,
    distanceKm: '1,548 km',
    activePct: 74,
  }))
  await a.wait(1200)
  a.mark('switch-live-radar')
  a.put((s) => ({
    ...s,
    activeTab: 'Live Radar',
  }))
  await a.wait(1200)
  a.mark('return-dashboard')
  a.put((s) => ({
    ...s,
    activeTab: 'Dashboard',
  }))
}

function RingGauge({ pct, color = '#216A85' }: { pct: number; color?: string }) {
  const r = 24
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#D8EAF2" strokeWidth="5.5" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 30 30)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          color: '#021D24',
        }}
      >
        {pct}%
      </div>
    </div>
  )
}

export default function FieldTrackSaasPlatformDemo() {
  return (
    <Stage
      width={1280}
      height={780}
      compact={{ below: 768, width: 375, height: 740 }}
      initial={INITIAL}
      poster={POSTER}
      script={script}
    >
      {(s, _rect, layout: Layout) => {
        if (layout === 'compact') {
          return (
            <div
              style={{
                width: 375,
                height: 740,
                background: '#FFFFFF',
                fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
                color: '#021D24',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Phone Chrome: Status bar with Dynamic Island */}
              <div
                style={{
                  height: 44,
                  padding: '0 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#021D24',
                  flexShrink: 0,
                }}
              >
                <span>9:41</span>
                <div style={{ width: 106, height: 26, background: '#021D24', borderRadius: 20 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700 }}>
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Mobile Header: Brand + Greeting + Tenant Pill */}
              <div
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #E8ECF4',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #216A85 0%, #093F52 100%)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    F
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>Operations Dashboard</div>
                    <div style={{ fontSize: 11, color: '#456B7C' }}>Aarav Sharma • 150m Geofence</div>
                  </div>
                </div>
                <div
                  style={{
                    background: '#F1F7FA',
                    border: '1px solid #D8EAF2',
                    borderRadius: 999,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#216A85',
                  }}
                >
                  Patna HQ
                </div>
              </div>

              {/* Scrollable Mobile Body */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Compact 2-Column KPI Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #D8EAF2',
                      borderRadius: 16,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 8,
                      boxShadow: '0 2px 8px rgba(2, 29, 36, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#456B7C' }}>Active Trips</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <RingGauge pct={80} color="#216A85" />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#021D24' }}>4</div>
                        <div style={{ fontSize: 10, color: '#456B7C' }}>of 5 active</div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #D8EAF2',
                      borderRadius: 16,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 8,
                      boxShadow: '0 2px 8px rgba(2, 29, 36, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#456B7C' }}>Store Visits</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#216A85', background: '#F1F7FA', padding: '1px 6px', borderRadius: 999 }}>{s.activePct}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <RingGauge pct={s.activePct} color="#042933" />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#021D24' }}>{s.completedVisits}</div>
                        <div style={{ fontSize: 10, color: '#456B7C' }}>of 70 planned</div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #D8EAF2',
                      borderRadius: 16,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 8,
                      boxShadow: '0 2px 8px rgba(2, 29, 36, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#456B7C' }}>Pending Approvals</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#F59E0B' }}>SLA 2h</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <RingGauge pct={40} color="#216A85" />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#021D24' }}>2</div>
                        <div style={{ fontSize: 10, color: '#456B7C' }}>awaiting</div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #D8EAF2',
                      borderRadius: 16,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 8,
                      boxShadow: '0 2px 8px rgba(2, 29, 36, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#456B7C' }}>GPS Distance</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#216A85' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <RingGauge pct={92} color="#042933" />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#021D24' }}>{s.distanceKm}</div>
                        <div style={{ fontSize: 10, color: '#456B7C' }}>60s sync</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Obsidian Dark Card */}
                <div
                  style={{
                    background: 'linear-gradient(145deg, #021D24 0%, #042933 60%, #063442 100%)',
                    borderRadius: 18,
                    padding: 14,
                    color: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    boxShadow: '0 8px 24px rgba(2, 29, 36, 0.25)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#C7E5F2', letterSpacing: '0.04em' }}>FLEET PROGRESS • PATNA HQ</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#65A7C2', fontWeight: 600 }}>• 60s GPS Live</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{s.completedVisits} / 70 Store Visits</div>
                    <div style={{ fontSize: 11, color: '#C7E5F2', marginTop: 2 }}>
                      {s.activePct}% completion index • 150m verified radius
                    </div>
                  </div>
                  {/* Progress Split Bar */}
                  <div style={{ height: 6, background: '#021D24', borderRadius: 999, display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: `${s.activePct}%`, background: 'linear-gradient(90deg, #216A85 0%, #65A7C2 100%)' }} />
                    <div style={{ width: `${100 - s.activePct}%`, background: '#093F52' }} />
                  </div>
                </div>

                {/* Recent Activity Card */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 18,
                    padding: 14,
                    border: '1px solid #D8EAF2',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#021D24' }}>Recent Live Activity</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981' }}>● Live</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F7FA' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#021D24' }}>Mithila Super Bazaar</div>
                      <div style={{ fontSize: 10, color: '#456B7C' }}>Rajesh C. • Verified 118m</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981', background: '#ECFDF5', padding: '2px 8px', borderRadius: 999 }}>+Verified</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#021D24' }}>Bailey Rd Retail Hub</div>
                      <div style={{ fontSize: 10, color: '#456B7C' }}>Priya K. • 4 photos synced</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#216A85', background: '#F1F7FA', padding: '2px 8px', borderRadius: 999 }}>+Synced</span>
                  </div>
                </div>
              </div>

              {/* Mobile Bottom Navigation Bar (56px height) */}
              <div
                style={{
                  height: 56,
                  background: 'rgba(255, 255, 255, 0.96)',
                  backdropFilter: 'blur(12px)',
                  borderTop: '1px solid #E8ECF4',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {[
                  { label: 'Overview', icon: '⊞', active: s.activeTab === 'Dashboard' },
                  { label: 'Radar', icon: '◎', active: s.activeTab === 'Live Radar' },
                  { label: 'Trips', icon: '↗', active: false },
                  { label: 'Visits', icon: '✓', active: false },
                  { label: 'Team', icon: '👥', active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      color: item.active ? '#216A85' : '#456B7C',
                      fontSize: 10,
                      fontWeight: item.active ? 800 : 600,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#FFFFFF',
            display: 'flex',
            fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
            color: '#021D24',
            padding: 16,
            boxSizing: 'border-box',
            gap: 16,
          }}
        >
          {/* Left White Sidebar */}
          <aside
            style={{
              width: 228,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '6px 4px',
            }}
          >
            <div>
              {/* Brand */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: 'linear-gradient(135deg, #216A85 0%, #093F52 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  F
                </div>
                <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: '#021D24' }}>
                  FieldTrack
                </span>
              </div>

              {/* Greeting */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    letterSpacing: '-0.02em',
                    color: '#021D24',
                  }}
                >
                  Welcome back, Aarav
                </div>
                <div style={{ fontSize: 11, color: '#456B7C', marginTop: 4 }}>
                  Current field operations report
                </div>
              </div>

              {/* Home Nav */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#456B7C',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                HOME
              </div>

              <div
                style={{
                  background: '#042933',
                  color: '#FFFFFF',
                  borderRadius: 999,
                  padding: '9px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span>Overview</span>
                <span style={{ opacity: 0.7, color: '#C7E5F2' }}>⌄</span>
              </div>

              {['Live Tracking', 'Reports & Exports', 'AI Insights'].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#093F52',
                  }}
                >
                  {item}
                </div>
              ))}

              {/* Field Operations */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#456B7C',
                    letterSpacing: '0.08em',
                  }}
                >
                  FIELD OPERATIONS
                </span>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#216A85',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  +
                </span>
              </div>

              <div
                style={{
                  background: '#EAF5FA',
                  borderRadius: 999,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#021D24',
                  marginBottom: 4,
                }}
              >
                Trips &amp; Routes
              </div>
              <div
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#093F52',
                }}
              >
                Store Geofences (150m)
              </div>
            </div>

            {/* Bottom Abyss Ocean Teal Telemetry Status Card (Unslopped: 14px outer / 8px inner radius, flexShrink: 0) */}
            <div
              style={{
                flexShrink: 0,
                background: 'linear-gradient(135deg, #042933 0%, #093F52 48%, #216A85 100%)',
                borderRadius: 14,
                padding: '12px 14px',
                color: '#C7E5F2',
                border: '1px solid rgba(101, 167, 194, 0.28)',
                boxShadow: '0 10px 24px -6px rgba(4, 41, 51, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: '#10B981',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, color: '#FFFFFF' }}>
                  Live GPS &amp; Geofence
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#C7E5F2', fontWeight: 400, lineHeight: 1.35 }}>
                150m store radius • 60s cadence
              </div>
              <div
                style={{
                  marginTop: 2,
                  background: '#021D24',
                  border: '1px solid rgba(101, 167, 194, 0.24)',
                  color: '#C7E5F2',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Open Live Map</span>
                <span>→</span>
              </div>
            </div>
          </aside>

          {/* Right Main Column: Top Bar + Rounded Ice-Mist Canvas */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Top Bar */}
            <header
              style={{
                height: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px 10px',
              }}
            >
              {/* Floating Pill Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(
                  [
                    'Dashboard',
                    'Analytics',
                    'Field Trips',
                    'Store Visits',
                    'Live Radar',
                    'Approvals',
                  ] as ModuleTab[]
                ).map((pill) => {
                  const active = s.activeTab === pill
                  return (
                    <div
                      key={pill}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 999,
                        background: active ? '#216A85' : '#EDF5F9',
                        color: active ? '#FFFFFF' : '#093F52',
                        fontSize: 12,
                        fontWeight: active ? 700 : 600,
                      }}
                    >
                      {pill}
                    </div>
                  )
                })}
              </div>

              {/* Right Utility & Profile */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#EDF5F9',
                    color: '#093F52',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                  }}
                >
                  ⚙
                </div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#EDF5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    position: 'relative',
                  }}
                >
                  🔔
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#216A85',
                      color: '#FFFFFF',
                      fontSize: 9,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    3
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #216A85 0%, #093F52 100%)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    AS
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#021D24' }}>
                      Aarav Sharma
                    </div>
                    <div style={{ fontSize: 10, color: '#456B7C' }}>aarav@fieldtrack.in</div>
                  </div>
                </div>
              </div>
            </header>

            {/* Inset Rounded Soft Ice-Mist Content Canvas (#F1F7FA) */}
            <div
              style={{
                flex: 1,
                background: '#F1F7FA',
                borderRadius: 28,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Canvas Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                      color: '#021D24',
                    }}
                  >
                    Field Operations Overview
                  </div>
                  <div style={{ fontSize: 12, color: '#456B7C', marginTop: 2 }}>
                    Overview &gt; Bihar North Distribution Network
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #D8EAF2',
                      borderRadius: 999,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#021D24',
                    }}
                  >
                    + Export CSV
                  </div>
                  <div
                    style={{
                      background: '#216A85',
                      borderRadius: 999,
                      padding: '8px 18px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#FFFFFF',
                      boxShadow: '0 6px 16px rgba(33, 106, 133, 0.28)',
                    }}
                  >
                    Plan New Trip
                  </div>
                </div>
              </div>

              {/* Hero Bento Grid (Abyss Hero Card + White Live Activity Card) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.65fr 1fr',
                  gap: 16,
                }}
              >
                {/* Left: Deep Abyss Hero Card */}
                <div
                  style={{
                    background:
                      'radial-gradient(circle at 86% 18%, rgba(33, 106, 133, 0.56) 0%, rgba(101, 167, 194, 0.2) 38%, rgba(2, 29, 36, 0) 68%), linear-gradient(145deg, #021D24 0%, #042933 58%, #063442 100%)',
                    borderRadius: 24,
                    padding: 22,
                    color: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 250,
                    border: '1px solid rgba(199, 229, 242, 0.16)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: '#216A85',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                          border: '2px solid #021D24',
                        }}
                      >
                        AS
                      </div>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: '#C7E5F2',
                          color: '#021D24',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                          marginLeft: -10,
                          border: '2px solid #021D24',
                        }}
                      >
                        FT
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>
                        Bihar Retail Fleet &amp; Managers
                      </div>
                      <div style={{ fontSize: 11, color: '#C7E5F2' }}>
                        18 active field trips • 150m geofencing
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: '#C7E5F2' }}>
                      Verified Store Visits Completed
                    </div>
                    <div
                      style={{
                        fontSize: 42,
                        fontWeight: 800,
                        letterSpacing: '-0.04em',
                        margin: '4px 0',
                      }}
                    >
                      {s.completedVisits} Visits
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'rgba(199, 229, 242, 0.78)',
                        marginBottom: 14,
                      }}
                    >
                      {s.activePct}% of 70 planned store visits • {s.distanceKm} covered
                    </div>

                    {/* Two-segment Progress Bar */}
                    <div style={{ display: 'flex', gap: 6, height: 10, marginBottom: 10 }}>
                      <div
                        style={{
                          width: `${s.activePct}%`,
                          background: '#216A85',
                          borderRadius: 999,
                        }}
                      />
                      <div
                        style={{
                          width: `${100 - s.activePct}%`,
                          background: '#65A7C2',
                          borderRadius: 999,
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        color: '#C7E5F2',
                      }}
                    >
                      <span>● Completed Visits • {s.completedVisits} ({s.activePct}%)</span>
                      <span>● Active En-Route • 18 ({100 - s.activePct}%)</span>
                    </div>
                  </div>
                </div>

                {/* Right: White Live Activity Feed Card */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 24,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid #D8EAF2',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#021D24' }}>
                        Activity
                      </div>
                      <div style={{ fontSize: 11, color: '#456B7C' }}>
                        Latest field check-ins &amp; decisions
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#10B981',
                      }}
                    >
                      ● Live
                    </span>
                  </div>

                  {[
                    {
                      init: 'RK',
                      bg: '#216A85',
                      fg: '#FFFFFF',
                      title: 'Rajesh checked into Mithila Bazaar',
                      time: 'Just now • 118m radius',
                      delta: '+Verified',
                    },
                    {
                      init: 'PV',
                      bg: '#C7E5F2',
                      fg: '#021D24',
                      title: 'Priya completed Bailey Rd Audit',
                      time: '12m ago • 4 photos',
                      delta: '+Synced',
                    },
                    {
                      init: 'AS',
                      bg: '#093F52',
                      fg: '#FFFFFF',
                      title: 'Approved NH-22 Muzaffarpur Route',
                      time: '34m ago • 6 stops',
                      delta: '+Approved',
                    },
                    {
                      init: 'VK',
                      bg: '#65A7C2',
                      fg: '#021D24',
                      title: 'Vikram started Kankarbagh Trip',
                      time: '1h ago • 60s GPS active',
                      delta: '+En Route',
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: item.bg,
                            color: item.fg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {item.init}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#021D24' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 10, color: '#456B7C' }}>{item.time}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#216A85' }}>
                        {item.delta}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom 4 Circular Ring KPI Cards Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 14,
                }}
              >
                {[
                  {
                    title: 'Visit Execution',
                    sub: 'Today target',
                    pct: s.activePct,
                    val: `${s.completedVisits}`,
                    total: 'of 70 planned',
                    badgeBg: '#216A85',
                    ring: '#216A85',
                  },
                  {
                    title: 'Audit Compliance',
                    sub: '4-point checklist',
                    pct: 92,
                    val: '92%',
                    total: 'of 100% benchmark',
                    badgeBg: '#021D24',
                    ring: '#042933',
                  },
                  {
                    title: 'Geofence Accuracy',
                    sub: '150m store doors',
                    pct: 96,
                    val: '142',
                    total: 'of 148 doors mapped',
                    badgeBg: '#216A85',
                    ring: '#216A85',
                  },
                  {
                    title: 'Approval Queue',
                    sub: 'SLA under 2h',
                    pct: 84,
                    val: '1.4h',
                    total: '3 pending review',
                    badgeBg: '#021D24',
                    ring: '#042933',
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: 22,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                      border: '1px solid #D8EAF2',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: card.badgeBg,
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        ✓
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#021D24' }}>
                          {card.title}
                        </div>
                        <div style={{ fontSize: 10, color: '#456B7C' }}>{card.sub}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <RingGauge pct={card.pct} color={card.ring} />
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#021D24' }}>
                          {card.val}
                        </div>
                        <div style={{ fontSize: 11, color: '#456B7C' }}>{card.total}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 4, height: 5 }}>
                      <div
                        style={{
                          width: `${card.pct}%`,
                          background: card.ring,
                          borderRadius: 999,
                        }}
                      />
                      <div
                        style={{
                          width: `${100 - card.pct}%`,
                          background: '#65A7C2',
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )
      }}
    </Stage>
  )
}

