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

function RingGauge({ pct, color = '#2558FF' }: { pct: number; color?: string }) {
  const r = 24
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#E8EAF0" strokeWidth="5.5" />
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
          color: '#11141D',
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
      bg="#FFFFFF"
    >
      {(s) => (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#FFFFFF',
            display: 'flex',
            fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
            color: '#11141D',
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
                    background: '#2558FF',
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
                <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>
                  FieldTrack
                </span>
              </div>

              {/* Greeting */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    letterSpacing: '-0.03em',
                    color: '#11141D',
                  }}
                >
                  Welcome Back,
                  <br />
                  Aarav!
                </div>
                <div style={{ fontSize: 11, color: '#8C94A6', marginTop: 4 }}>
                  Current field operations report
                </div>
              </div>

              {/* Home Nav */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#8C94A6',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                HOME
              </div>

              <div
                style={{
                  background: '#141720',
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
                <span style={{ opacity: 0.7 }}>⌄</span>
              </div>

              {['Live Tracking', 'Reports & Exports', 'AI Insights'].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#5A6275',
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
                    color: '#8C94A6',
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
                    background: '#2558FF',
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
                  background: '#F3F4F8',
                  borderRadius: 999,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#11141D',
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
                  color: '#5A6275',
                }}
              >
                Store Geofences (150m)
              </div>
            </div>

            {/* Bottom Royal Blue Promo Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1D4ED8 0%, #2558FF 52%, #3B82F6 100%)',
                borderRadius: 20,
                padding: 16,
                color: '#FFFFFF',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>
                Live GPS &amp;
                <br />
                Geofence Engine
              </div>
              <div style={{ fontSize: 11, opacity: 0.86, marginTop: 4, marginBottom: 12 }}>
                150m radius • 60s sync
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    background: '#10121A',
                    color: '#FFFFFF',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Open Live Map
                </span>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    color: '#11141D',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  ↗
                </span>
              </div>
            </div>
          </aside>

          {/* Right Main Column: Top Bar + Rounded Soft-Gray Canvas */}
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
                        background: active ? '#2558FF' : '#F3F4F8',
                        color: active ? '#FFFFFF' : '#5A6275',
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
                    background: '#F3F4F8',
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
                    background: '#F3F4F8',
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
                      background: '#2558FF',
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
                      background: '#6C92FF',
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
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#11141D' }}>
                      Aarav Sharma
                    </div>
                    <div style={{ fontSize: 10, color: '#8C94A6' }}>aarav@fieldtrack.in</div>
                  </div>
                </div>
              </div>
            </header>

            {/* Inset Rounded Soft-Gray Content Canvas (#F3F4F8) */}
            <div
              style={{
                flex: 1,
                background: '#F3F4F8',
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
                      color: '#11141D',
                    }}
                  >
                    Field Operations Overview
                  </div>
                  <div style={{ fontSize: 12, color: '#8C94A6', marginTop: 2 }}>
                    Overview &gt; Bihar North Distribution Network
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E8EAF0',
                      borderRadius: 999,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#11141D',
                    }}
                  >
                    + Export CSV
                  </div>
                  <div
                    style={{
                      background: '#2558FF',
                      borderRadius: 999,
                      padding: '8px 18px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#FFFFFF',
                      boxShadow: '0 6px 16px rgba(37, 88, 255, 0.28)',
                    }}
                  >
                    Plan New Trip
                  </div>
                </div>
              </div>

              {/* Hero Bento Grid (Obsidian Hero Card + White Live Activity Card) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.65fr 1fr',
                  gap: 16,
                }}
              >
                {/* Left: Dark Obsidian Hero Card */}
                <div
                  style={{
                    background:
                      'radial-gradient(circle at 86% 18%, rgba(37, 88, 255, 0.52) 0%, rgba(37, 88, 255, 0.14) 38%, rgba(16, 18, 26, 0) 68%), #10121A',
                    borderRadius: 24,
                    padding: 22,
                    color: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 250,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: '#6C92FF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                          border: '2px solid #10121A',
                        }}
                      >
                        AS
                      </div>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: '#8BA8FF',
                          color: '#10121A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                          marginLeft: -10,
                          border: '2px solid #10121A',
                        }}
                      >
                        FT
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>
                        Bihar Retail Fleet &amp; Managers
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.64)' }}>
                        18 active field trips • 150m geofencing
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)' }}>
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
                        color: 'rgba(255,255,255,0.68)',
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
                          background: '#2558FF',
                          borderRadius: 999,
                        }}
                      />
                      <div
                        style={{
                          width: `${100 - s.activePct}%`,
                          background: '#8BA8FF',
                          borderRadius: 999,
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.8)',
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
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#11141D' }}>
                        Activity
                      </div>
                      <div style={{ fontSize: 11, color: '#8C94A6' }}>
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
                      bg: '#8BA8FF',
                      title: 'Rajesh checked into Mithila Bazaar',
                      time: 'Just now • 118m radius',
                      delta: '+Verified',
                    },
                    {
                      init: 'PV',
                      bg: '#6C92FF',
                      title: 'Priya completed Bailey Rd Audit',
                      time: '12m ago • 4 photos',
                      delta: '+Synced',
                    },
                    {
                      init: 'AS',
                      bg: '#6C92FF',
                      title: 'Approved NH-22 Muzaffarpur Route',
                      time: '34m ago • 6 stops',
                      delta: '+Approved',
                    },
                    {
                      init: 'VK',
                      bg: '#8BA8FF',
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
                            color: '#FFFFFF',
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
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#11141D' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 10, color: '#8C94A6' }}>{item.time}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981' }}>
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
                    badgeBg: '#2558FF',
                    ring: '#2558FF',
                  },
                  {
                    title: 'Audit Compliance',
                    sub: '4-point checklist',
                    pct: 92,
                    val: '92%',
                    total: 'of 100% benchmark',
                    badgeBg: '#12151E',
                    ring: '#12151E',
                  },
                  {
                    title: 'Geofence Accuracy',
                    sub: '150m store doors',
                    pct: 96,
                    val: '142',
                    total: 'of 148 doors mapped',
                    badgeBg: '#2558FF',
                    ring: '#2558FF',
                  },
                  {
                    title: 'Approval Queue',
                    sub: 'SLA under 2h',
                    pct: 84,
                    val: '1.4h',
                    total: '3 pending review',
                    badgeBg: '#12151E',
                    ring: '#12151E',
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
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#11141D' }}>
                          {card.title}
                        </div>
                        <div style={{ fontSize: 10, color: '#8C94A6' }}>{card.sub}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <RingGauge pct={card.pct} color={card.ring} />
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#11141D' }}>
                          {card.val}
                        </div>
                        <div style={{ fontSize: 11, color: '#8C94A6' }}>{card.total}</div>
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
                          background: '#93B4FF',
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

