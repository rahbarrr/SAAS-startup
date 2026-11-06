import { Stage, type Act } from '../../kit'

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

function RingGauge({ pct, color = '#65A7C2' }: { pct: number; color?: string }) {
  const r = 24
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(199, 229, 242, 0.16)" strokeWidth="5.5" />
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
          color: '#C7E5F2',
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
      initial={INITIAL}
      poster={POSTER}
      script={script}
    >
      {(s) => (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(155deg, #216A85 0%, #093F52 38%, #042933 74%, #021D24 100%)',
            display: 'flex',
            fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
            color: '#C7E5F2',
            padding: 16,
            boxSizing: 'border-box',
            gap: 16,
          }}
        >
          {/* Left Abyss Gradient Sidebar */}
          <aside
            style={{
              width: 228,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '12px 12px',
              borderRadius: 24,
              background: 'linear-gradient(180deg, #021D24 0%, #042933 55%, #063442 100%)',
              border: '1px solid rgba(101, 167, 194, 0.28)',
              boxShadow: '0 16px 36px rgba(2, 29, 36, 0.48)',
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
                    background: 'linear-gradient(135deg, #65A7C2 0%, #216A85 100%)',
                    color: '#021D24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  F
                </div>
                <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: '#C7E5F2' }}>
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
                    color: '#C7E5F2',
                  }}
                >
                  Welcome back, Aarav
                </div>
                <div style={{ fontSize: 11, color: '#65A7C2', marginTop: 4 }}>
                  Current field operations report
                </div>
              </div>

              {/* Home Nav */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#65A7C2',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                HOME
              </div>

              <div
                style={{
                  background: 'linear-gradient(135deg, #216A85 0%, #093F52 100%)',
                  color: '#C7E5F2',
                  border: '1px solid rgba(199, 229, 242, 0.28)',
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
                <span style={{ opacity: 0.85, color: '#C7E5F2' }}>⌄</span>
              </div>

              {['Live Tracking', 'Reports & Exports', 'AI Insights'].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#65A7C2',
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
                    color: '#65A7C2',
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
                    background: 'linear-gradient(135deg, #65A7C2 0%, #216A85 100%)',
                    color: '#021D24',
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
                  background: 'linear-gradient(145deg, #063442 0%, #093F52 100%)',
                  border: '1px solid rgba(101, 167, 194, 0.25)',
                  borderRadius: 999,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#C7E5F2',
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
                  color: '#65A7C2',
                }}
              >
                Store Geofences (150m)
              </div>
            </div>

            {/* Bottom Abyss Ocean Teal Telemetry Status Card (Unslopped: 14px outer / 8px inner radius, flexShrink: 0) */}
            <div
              style={{
                flexShrink: 0,
                background: 'linear-gradient(145deg, #063442 0%, #093F52 100%)',
                borderRadius: 14,
                padding: '12px 14px',
                color: '#C7E5F2',
                border: '1px solid rgba(101, 167, 194, 0.28)',
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
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, color: '#C7E5F2' }}>
                  Live GPS &amp; Geofence
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#65A7C2', fontWeight: 400, lineHeight: 1.35 }}>
                150m store radius • 60s cadence
              </div>
              <div
                style={{
                  marginTop: 2,
                  background: '#042933',
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

          {/* Right Main Column: Top Bar + Rounded Abyss Gradient Canvas */}
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
                        background: active
                          ? 'linear-gradient(135deg, #65A7C2 0%, #C7E5F2 100%)'
                          : 'linear-gradient(145deg, #063442 0%, #042933 100%)',
                        color: active ? '#021D24' : '#C7E5F2',
                        border: active ? '1px solid #C7E5F2' : '1px solid rgba(101, 167, 194, 0.28)',
                        fontSize: 12,
                        fontWeight: active ? 800 : 600,
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
                    background: 'linear-gradient(145deg, #063442 0%, #042933 100%)',
                    border: '1px solid rgba(101, 167, 194, 0.28)',
                    color: '#C7E5F2',
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
                    background: 'linear-gradient(145deg, #063442 0%, #042933 100%)',
                    border: '1px solid rgba(101, 167, 194, 0.28)',
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
                      background: '#65A7C2',
                      color: '#021D24',
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
                      background: 'linear-gradient(135deg, #65A7C2 0%, #216A85 100%)',
                      color: '#021D24',
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
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#C7E5F2' }}>
                      Aarav Sharma
                    </div>
                    <div style={{ fontSize: 10, color: '#65A7C2' }}>aarav@fieldtrack.in</div>
                  </div>
                </div>
              </div>
            </header>

            {/* Inset Rounded Deep Abyss Ocean Content Canvas */}
            <div
              style={{
                flex: 1,
                background: 'linear-gradient(160deg, #093F52 0%, #063442 46%, #042933 82%, #021D24 100%)',
                border: '1px solid rgba(101, 167, 194, 0.3)',
                boxShadow: '0 20px 48px rgba(2, 29, 36, 0.52)',
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
                      color: '#C7E5F2',
                    }}
                  >
                    Field Operations Overview
                  </div>
                  <div style={{ fontSize: 12, color: '#65A7C2', marginTop: 2 }}>
                    Overview &gt; Bihar North Distribution Network
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      background: 'linear-gradient(145deg, #063442 0%, #042933 100%)',
                      border: '1px solid rgba(101, 167, 194, 0.35)',
                      borderRadius: 999,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#C7E5F2',
                    }}
                  >
                    + Export CSV
                  </div>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #65A7C2 0%, #C7E5F2 100%)',
                      borderRadius: 999,
                      padding: '8px 18px',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#021D24',
                      boxShadow: '0 6px 16px rgba(2, 29, 36, 0.45)',
                    }}
                  >
                    Plan New Trip
                  </div>
                </div>
              </div>

              {/* Hero Bento Grid (Abyss Hero Card + Abyss Gradient Live Activity Card) */}
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
                      'radial-gradient(circle at 86% 18%, rgba(199, 229, 242, 0.25) 0%, rgba(101, 167, 194, 0.28) 38%, rgba(2, 29, 36, 0) 68%), linear-gradient(135deg, #021D24 0%, #093F52 54%, #216A85 100%)',
                    borderRadius: 24,
                    padding: 22,
                    color: '#C7E5F2',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 250,
                    border: '1px solid rgba(199, 229, 242, 0.28)',
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
                          color: '#C7E5F2',
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
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#C7E5F2' }}>
                        Bihar Retail Fleet &amp; Managers
                      </div>
                      <div style={{ fontSize: 11, color: '#65A7C2' }}>
                        18 active field trips • 150m geofencing
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: '#65A7C2' }}>
                      Verified Store Visits Completed
                    </div>
                    <div
                      style={{
                        fontSize: 42,
                        fontWeight: 800,
                        letterSpacing: '-0.04em',
                        margin: '4px 0',
                        color: '#C7E5F2',
                      }}
                    >
                      {s.completedVisits} Visits
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#65A7C2',
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
                          background: 'linear-gradient(90deg, #65A7C2 0%, #C7E5F2 100%)',
                          borderRadius: 999,
                        }}
                      />
                      <div
                        style={{
                          width: `${100 - s.activePct}%`,
                          background: '#093F52',
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

                {/* Right: Abyss Gradient Live Activity Feed Card */}
                <div
                  style={{
                    background: 'linear-gradient(145deg, #063442 0%, #042933 65%, #021D24 100%)',
                    borderRadius: 24,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(101, 167, 194, 0.28)',
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
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#C7E5F2' }}>
                        Activity
                      </div>
                      <div style={{ fontSize: 11, color: '#65A7C2' }}>
                        Latest field check-ins &amp; decisions
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#C7E5F2',
                        background: '#093F52',
                        padding: '3px 9px',
                        borderRadius: 999,
                        border: '1px solid #65A7C2',
                      }}
                    >
                      ● Live
                    </span>
                  </div>

                  {[
                    {
                      init: 'RK',
                      bg: '#216A85',
                      fg: '#C7E5F2',
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
                      fg: '#C7E5F2',
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
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#C7E5F2' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 10, color: '#65A7C2' }}>{item.time}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#65A7C2' }}>
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
                    ring: '#65A7C2',
                  },
                  {
                    title: 'Audit Compliance',
                    sub: '4-point checklist',
                    pct: 92,
                    val: '92%',
                    total: 'of 100% benchmark',
                    badgeBg: '#093F52',
                    ring: '#C7E5F2',
                  },
                  {
                    title: 'Geofence Accuracy',
                    sub: '150m store doors',
                    pct: 96,
                    val: '142',
                    total: 'of 148 doors mapped',
                    badgeBg: '#216A85',
                    ring: '#65A7C2',
                  },
                  {
                    title: 'Approval Queue',
                    sub: 'SLA under 2h',
                    pct: 84,
                    val: '1.4h',
                    total: '3 pending review',
                    badgeBg: '#093F52',
                    ring: '#C7E5F2',
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    style={{
                      background: 'linear-gradient(145deg, #063442 0%, #042933 65%, #021D24 100%)',
                      borderRadius: 22,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                      border: '1px solid rgba(101, 167, 194, 0.28)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: card.badgeBg,
                          color: '#C7E5F2',
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
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#C7E5F2' }}>
                          {card.title}
                        </div>
                        <div style={{ fontSize: 10, color: '#65A7C2' }}>{card.sub}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <RingGauge pct={card.pct} color={card.ring} />
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#C7E5F2' }}>
                          {card.val}
                        </div>
                        <div style={{ fontSize: 11, color: '#65A7C2' }}>{card.total}</div>
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
                          background: '#093F52',
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
      )}
    </Stage>
  )
}
