import { Stage, type Act } from '../../kit'

interface ModulesSuiteState {
  ready: boolean
}

const INITIAL: ModulesSuiteState = { ready: true }
const POSTER: ModulesSuiteState = { ready: true }

const script = async (a: Act<ModulesSuiteState>) => {
  await a.wait(800)
  a.mark('modules-verified')
}

const MODULES = [
  {
    name: '1. Mobile Dashboard (375px)',
    eyebrow: 'Overview > Patna HQ',
    kpis: [
      { l: 'Active Trips', v: '4', p: '80%' },
      { l: 'Completed Visits', v: '18', p: '90%' },
      { l: 'Approvals', v: '2', p: '33%' },
      { l: 'Distance', v: '64.2 km', p: '92%' },
    ],
    cardTitle: 'Patna HQ Fleet • 83% Index',
    cardSub: '150m Geofence • 60s GPS Sync • Zero Overflow',
    dark: true,
    activeNav: 0,
  },
  {
    name: '2. Mobile Trips (390px)',
    eyebrow: 'Field Travel Logistics',
    kpis: [
      { l: 'Total Planned', v: '12', p: '100%' },
      { l: 'Awaiting Approval', v: '2', p: '17%' },
      { l: 'In Progress', v: '4', p: '33%' },
      { l: 'Completed', v: '6', p: '50%' },
    ],
    cardTitle: 'Patna & Muzaffarpur Retail Route',
    cardSub: 'Nov 06 • Rep: Aarav • Collapsible Filters',
    dark: false,
    activeNav: 2,
  },
  {
    name: '3. Mobile Analytics & Reports (390px)',
    eyebrow: 'Window: 7d | 30d | Quarter | YTD',
    kpis: [
      { l: 'Visit Execution', v: '92%', p: '92%' },
      { l: 'Audit Compliance', v: '96%', p: '96%' },
      { l: 'Field Hours', v: '38.5h', p: '88%' },
      { l: 'Evidence Rate', v: '100%', p: '100%' },
    ],
    cardTitle: 'Store Visit Velocity & Territory Health',
    cardSub: 'Patna Central: 18/19 doors (95%) • Clean CSV',
    dark: false,
    activeNav: 0,
  },
  {
    name: '4. Store Visits & Execution (375px)',
    eyebrow: 'On-Site Execution • 150m Radius',
    kpis: [
      { l: 'Total Visits', v: '24', p: '100%' },
      { l: 'Completed', v: '18', p: '75%' },
      { l: 'In Progress', v: '4', p: '17%' },
      { l: 'Auto Geofenced', v: '21', p: '88%' },
    ],
    cardTitle: 'Mithila Super Bazaar • #8f41c20a',
    cardSub: '● Auto Geofence (150m) • 42 mins duration',
    dark: false,
    activeNav: 3,
  },
  {
    name: '5. Live GPS Tracking (414px)',
    eyebrow: 'Live 60s Cadence • 150m Geofence',
    kpis: [
      { l: 'Tracked Reps', v: '6', p: '100%' },
      { l: 'Fresh Signal', v: '5', p: '83%' },
      { l: 'Delayed', v: '1', p: '17%' },
      { l: 'Store Doors', v: '42', p: '100%' },
    ],
    cardTitle: 'Interactive Map + Operator Sheet',
    cardSub: 'Aarav Sharma (±8m GPS) • Kankarbagh Hub',
    dark: true,
    activeNav: 1,
  },
  {
    name: '6. Approvals & Team Directory (430px)',
    eyebrow: 'Governance & RBAC Directory',
    kpis: [
      { l: 'Pending Review', v: '2', p: '20%' },
      { l: 'Approved', v: '8', p: '80%' },
      { l: 'Team Members', v: '18', p: '100%' },
      { l: 'Field Reps', v: '14', p: '78%' },
    ],
    cardTitle: 'Manager Inbox & RLS Team Roster',
    cardSub: 'Self-approval guard active • 44px touch actions',
    dark: false,
    activeNav: 4,
  },
]

export default function FieldTrackMobileModulesSuite() {
  return (
    <Stage
      width={1440}
      height={1080}
      initial={INITIAL}
      poster={POSTER}
      script={script}
      bg="#F3F4F8"
    >
      {() => (
        <div
          style={{
            width: '100%',
            height: '100%',
            padding: '24px 32px',
            boxSizing: 'border-box',
            fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
            color: '#11141D',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#FFFFFF',
              padding: '14px 20px',
              borderRadius: 18,
              border: '1px solid #E8EAF0',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#2558FF' }}>
                FieldTrack Unslop Mobile Design System • All Modules Verified
              </div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                Dashboard · Trips · Reports · Store Visits · Live Tracking · Approvals &amp; Team
              </div>
            </div>
            <span
              style={{
                background: '#10121A',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: 999,
              }}
            >
              Desktop (&gt;= 1024px) Protected • Mobile Optimized
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 18,
              flex: 1,
            }}
          >
            {MODULES.map((m) => (
              <div
                key={m.name}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 20,
                  padding: 14,
                  border: '1px solid #E8EAF0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#11141D' }}>{m.name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#065F46',
                      background: '#ECFDF5',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    Verified
                  </span>
                </div>

                <div
                  style={{
                    flex: 1,
                    background: '#F3F4F8',
                    borderRadius: 16,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid #E8EAF0',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        background: '#FFFFFF',
                        borderRadius: 12,
                        padding: '8px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#5A6275' }}>{m.eyebrow}</span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: '#2558FF',
                          background: '#EEF3FF',
                          padding: '2px 7px',
                          borderRadius: 999,
                        }}
                      >
                        + Action
                      </span>
                    </div>

                    {/* 2-Column KPI Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {m.kpis.map((k, i) => (
                        <div
                          key={k.l}
                          style={{
                            background: '#FFFFFF',
                            borderRadius: 12,
                            padding: '8px 9px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 999,
                              border: `2.5px solid ${i % 2 === 0 ? '#2558FF' : '#10121A'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 7.5,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {k.p}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: '#5A6275',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {k.l}
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#11141D' }}>{k.v}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Primary Module Card */}
                    <div
                      style={{
                        background: m.dark ? '#10121A' : '#FFFFFF',
                        color: m.dark ? '#FFFFFF' : '#11141D',
                        borderRadius: 14,
                        padding: '10px 12px',
                        border: m.dark ? 'none' : '1px solid #E8EAF0',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{m.cardTitle}</div>
                      <div
                        style={{
                          fontSize: 10,
                          color: m.dark ? 'rgba(255,255,255,0.72)' : '#5A6275',
                          marginTop: 3,
                        }}
                      >
                        {m.cardSub}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Nav */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: 999,
                      padding: '6px 10px',
                      display: 'flex',
                      justifyContent: 'space-around',
                      border: '1px solid #E8EAF0',
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {['Overview', 'Live Map', 'Trips', 'Visits', 'Team'].map((nav, idx) => (
                      <span
                        key={nav}
                        style={{ color: idx === m.activeNav ? '#2558FF' : '#8C94A6' }}
                      >
                        {nav}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Stage>
  )
}

