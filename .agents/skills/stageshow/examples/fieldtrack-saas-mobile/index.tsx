import { Stage, Phone, type Act } from '../../kit'

interface MobileShowcaseState {
  checkedIn: boolean
  visitsCompleted: number
  distanceMeters: number
}

const INITIAL: MobileShowcaseState = {
  checkedIn: false,
  visitsCompleted: 4,
  distanceMeters: 112,
}

const POSTER: MobileShowcaseState = {
  checkedIn: true,
  visitsCompleted: 5,
  distanceMeters: 42,
}

const script = async (a: Act<MobileShowcaseState>) => {
  await a.wait(1000)
  a.mark('geofence-arrival')
  a.put({
    checkedIn: true,
    visitsCompleted: 5,
    distanceMeters: 42,
  })
}

export default function FieldTrackSaasMobileDemo() {
  return (
    <Stage
      width={1080}
      height={760}
      initial={INITIAL}
      poster={POSTER}
      script={script}
      bg="#F3F4F8"
    >
      {(s) => (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 44,
            fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
            background: '#F3F4F8',
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          {/* Left Phone: Mobile Web Responsive Dashboard (375px) */}
          <Phone width={320} height={660} bg="#F3F4F8">
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: '#F3F4F8',
                padding: '12px 14px 10px',
                boxSizing: 'border-box',
                color: '#11141D',
              }}
            >
              <div>
                {/* Section 1: Greeting / Identity + Organization Indicator + Summary */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#FFFFFF',
                    borderRadius: 14,
                    padding: '9px 12px',
                    marginBottom: 10,
                    border: '1px solid #E8EAF0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: '#2558FF',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      F
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.15 }}>
                        Operations Dashboard
                      </div>
                      <div style={{ fontSize: 10, color: '#5A6275' }}>
                        Aarav Sharma • 150m Geofence
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#2558FF',
                      background: '#EEF3FF',
                      padding: '4px 8px',
                      borderRadius: 999,
                    }}
                  >
                    ● Patna HQ
                  </span>
                </div>

                {/* Section 2: Compact 2-Column KPI Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  {[
                    {
                      label: 'Active Trips',
                      value: '4',
                      pct: '80%',
                      sub: 'of 5 scheduled',
                      color: '#2558FF',
                    },
                    {
                      label: 'Completed Visits',
                      value: `${s.visitsCompleted}/6`,
                      pct: `${Math.round((s.visitsCompleted / 6) * 100)}%`,
                      sub: '150m verified',
                      color: '#2558FF',
                    },
                    {
                      label: 'Pending Approvals',
                      value: '2',
                      pct: '40%',
                      sub: 'Awaiting review',
                      color: '#12151E',
                    },
                    {
                      label: 'Distance Today',
                      value: '64.2 km',
                      pct: '92%',
                      sub: '60s GPS sync',
                      color: '#10B981',
                    },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      style={{
                        background: '#FFFFFF',
                        borderRadius: 14,
                        padding: '10px 11px',
                        border: '1px solid #E8EAF0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 5,
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#11141D' }}>
                        {kpi.label}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 999,
                            border: `3px solid ${kpi.color}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 8.5,
                            fontWeight: 800,
                            color: '#11141D',
                            flexShrink: 0,
                          }}
                        >
                          {kpi.pct}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#11141D', lineHeight: 1.1 }}>
                            {kpi.value}
                          </div>
                          <div style={{ fontSize: 9.5, color: '#8C94A6' }}>{kpi.sub}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Section 3: Compact Fleet Progress Card + Tracking Status + Recent Activity */}
                <div
                  style={{
                    background:
                      'radial-gradient(circle at 85% 20%, rgba(37, 88, 255, 0.5) 0%, rgba(16, 18, 26, 0) 65%), #10121A',
                    borderRadius: 16,
                    padding: '12px 14px',
                    color: '#FFFFFF',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9.5, color: '#8BA8FF', fontWeight: 700 }}>
                      FLEET PROGRESS • PATNA HQ
                    </span>
                    <span style={{ fontSize: 9.5, color: '#10B981', fontWeight: 700 }}>
                      ● 60s GPS Live
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, margin: '3px 0 2px' }}>
                    {s.visitsCompleted} / 6 Store Visits
                  </div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.68)', marginBottom: 8 }}>
                    83% completion index • 150m geofence active
                  </div>
                  <div style={{ display: 'flex', gap: 5, height: 6 }}>
                    <div
                      style={{
                        width: `${Math.round((s.visitsCompleted / 6) * 100)}%`,
                        background: '#2558FF',
                        borderRadius: 999,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        background: '#8BA8FF',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>

                {/* Compact Recent Activity Panel */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 14,
                    padding: '10px 12px',
                    border: '1px solid #E8EAF0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 800 }}>Recent Activity</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: '#10B981' }}>
                      ● Live
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
                    Mithila Super Bazaar • Bailey Rd
                  </div>
                  <div style={{ fontSize: 10, color: '#5A6275' }}>
                    {s.checkedIn
                      ? 'Checked in at 11:32 AM IST (42m from door)'
                      : 'Approaching store geofence (112m)'}
                  </div>
                </div>
              </div>

              {/* Mobile Bottom Navigation Bar */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 999,
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  border: '1px solid #E8EAF0',
                }}
              >
                {['Home', 'Radar', 'Trips', 'Visits', 'Team'].map((item, i) => (
                  <span
                    key={item}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: i === 0 ? '#2558FF' : '#8C94A6',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </Phone>

          {/* Right Phone: Native iOS & Android Companion App */}
          <Phone width={320} height={660} bg="#F3F4F8">
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: '#F3F4F8',
                padding: '12px 14px 12px',
                boxSizing: 'border-box',
                color: '#11141D',
              }}
            >
              <div>
                {/* Native Top Nav */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      background: '#EEF3FF',
                      color: '#2558FF',
                      padding: '5px 10px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    ← Change Trip
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#5A6275' }}>
                    iOS &amp; Android Native
                  </span>
                </div>

                {/* Native Obsidian Active Route Card */}
                <div
                  style={{
                    background: '#10121A',
                    borderRadius: 20,
                    padding: 15,
                    color: '#FFFFFF',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#8BA8FF' }}>
                    ACTIVE ROUTE TELEMETRY
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
                    NH-22 Patna–Muzaffarpur
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>
                    Status: IN PROGRESS • 6 Planned Stops
                  </div>
                </div>

                {/* Native Live GPS Bar */}
                <div
                  style={{
                    background: '#EEF3FF',
                    border: '1px solid #8BA8FF',
                    borderRadius: 14,
                    padding: '9px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#11141D' }}>
                      ● Live GPS Sharing Active
                    </div>
                    <div style={{ fontSize: 9, color: '#5A6275' }}>
                      60s cadence • Accuracy ±8m (Simulated)
                    </div>
                  </div>
                  <span
                    style={{
                      background: '#FFFFFF',
                      color: '#DC2626',
                      border: '1px solid #DC2626',
                      borderRadius: 999,
                      padding: '3px 9px',
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    Stop
                  </span>
                </div>

                {/* Stop Card + 150m Geofence Check-in Prompt */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 18,
                    padding: 14,
                    border: '1px solid #E8EAF0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#2558FF',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      3
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>Mithila Super Bazaar</div>
                      <div style={{ fontSize: 10, color: '#5A6275' }}>
                        Bailey Road, Patna • {s.distanceMeters}m away
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#F3F4F8',
                      borderRadius: 12,
                      padding: 10,
                      fontSize: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: '#5A6275' }}>Geofence Radius:</span>
                      <span style={{ fontWeight: 700 }}>150 meters</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#5A6275' }}>Status:</span>
                      <span style={{ fontWeight: 700, color: '#10B981' }}>
                        {s.checkedIn ? '✓ Checked In (11:32 AM IST)' : 'Inside 150m Boundary'}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: s.checkedIn ? '#10B981' : '#2558FF',
                      color: '#FFFFFF',
                      borderRadius: 999,
                      padding: '10px 14px',
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {s.checkedIn ? '✓ Visit Check-In Recorded' : 'Confirm GPS Check-In'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: '#8C94A6',
                  textAlign: 'center',
                }}
              >
                Unified FieldTrack Design System • Web &amp; Native Mobile
              </div>
            </div>
          </Phone>
        </div>
      )}
    </Stage>
  )
}

