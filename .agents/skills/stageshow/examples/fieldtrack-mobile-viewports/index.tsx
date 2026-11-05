import { Stage, Phone, type Act } from '../../kit'

interface MobileViewportMatrixState {
  activeScreen: string
}

const INITIAL: MobileViewportMatrixState = { activeScreen: 'matrix' }
const POSTER: MobileViewportMatrixState = { activeScreen: 'matrix' }

const script = async (a: Act<MobileViewportMatrixState>) => {
  await a.wait(800)
  a.mark('viewport-verified')
}

const VIEWPORTS = [
  { width: 320, label: '320px · iPhone SE / Small Android' },
  { width: 360, label: '360px · Standard Android' },
  { width: 375, label: '375px · iPhone 13 Mini / SE 3' },
  { width: 390, label: '390px · iPhone 14 / 15' },
  { width: 414, label: '414px · iPhone Plus / Pixel' },
  { width: 430, label: '430px · iPhone 15 Pro Max' },
]

export default function FieldTrackMobileViewportMatrix() {
  return (
    <Stage
      width={1440}
      height={1120}
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
          {/* Top Header */}
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
                FieldTrack Unslop Mobile Design System • Responsive Viewport Matrix
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#11141D' }}>
                320px · 360px · 375px · 390px · 414px · 430px Smartphone Verification
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                style={{
                  background: '#ECFDF5',
                  color: '#065F46',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid #A7F3D0',
                }}
              >
                ✓ Zero Horizontal Overflow (320px–430px)
              </span>
              <span
                style={{
                  background: '#EEF3FF',
                  color: '#2558FF',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 999,
                }}
              >
                2-Column Compact KPI Grid
              </span>
            </div>
          </div>

          {/* 6 Smartphone Viewports Grid (3x2) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 18,
              flex: 1,
            }}
          >
            {VIEWPORTS.map((vp, idx) => (
              <div
                key={vp.width}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 20,
                  padding: 14,
                  border: '1px solid #E8EAF0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#11141D' }}>{vp.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#2558FF',
                      background: '#EEF3FF',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {idx % 2 === 0 ? 'Dashboard' : 'Trips & Analytics'}
                  </span>
                </div>

                {/* Simulated Exact Viewport Container */}
                <div
                  style={{
                    width: Math.min(vp.width, 396),
                    flex: 1,
                    background: '#F3F4F8',
                    borderRadius: 16,
                    padding: vp.width <= 320 ? '10px 10px 8px' : '12px 14px 10px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid #D5D9E4',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Compact Mobile Bar */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#FFFFFF',
                        padding: '7px 10px',
                        borderRadius: 12,
                      }}
                    >
                      <span style={{ fontSize: 11.5, fontWeight: 800 }}>
                        {idx % 2 === 0 ? 'Operations Dashboard' : 'Field Trips'}
                      </span>
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
                        Patna HQ
                      </span>
                    </div>

                    {/* 2-Column Compact KPI Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {[
                        {
                          t: idx % 2 === 0 ? 'Active Trips' : 'Planned Trips',
                          v: idx % 2 === 0 ? '4' : '12',
                          p: '80%',
                          c: '#2558FF',
                        },
                        {
                          t: idx % 2 === 0 ? 'Visits Done' : 'In Progress',
                          v: idx % 2 === 0 ? '5/6' : '4',
                          p: '83%',
                          c: '#10B981',
                        },
                        {
                          t: 'Approvals',
                          v: '2',
                          p: '40%',
                          c: '#12151E',
                        },
                        {
                          t: idx % 2 === 0 ? 'Distance' : 'Geofence',
                          v: idx % 2 === 0 ? '64.2 km' : '150m',
                          p: '100%',
                          c: '#2558FF',
                        },
                      ].map((k) => (
                        <div
                          key={k.t}
                          style={{
                            background: '#FFFFFF',
                            borderRadius: 12,
                            padding: vp.width <= 320 ? '7px 8px' : '8px 10px',
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
                              border: `2.5px solid ${k.c}`,
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
                              {k.t}
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#11141D' }}>{k.v}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Section 3: Compact Fleet Obsidian Card or Compact Filter + Trip Card */}
                    {idx % 2 === 0 ? (
                      <div
                        style={{
                          background: '#10121A',
                          borderRadius: 14,
                          padding: '10px 12px',
                          color: '#FFFFFF',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#8BA8FF', fontWeight: 700 }}>
                          <span>FLEET PROGRESS</span>
                          <span style={{ color: '#10B981' }}>● 60s GPS</span>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, margin: '2px 0' }}>
                          5 / 6 Store Visits Verified
                        </div>
                        <div style={{ display: 'flex', gap: 4, height: 5, marginTop: 4 }}>
                          <div style={{ width: '83%', background: '#2558FF', borderRadius: 999 }} />
                          <div style={{ flex: 1, background: '#8BA8FF', borderRadius: 999 }} />
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: '#FFFFFF',
                          borderRadius: 12,
                          padding: '9px 10px',
                          border: '1px solid #E8EAF0',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 800 }}>Patna Central Retail Audit</span>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontWeight: 700,
                              background: '#EEF3FF',
                              color: '#2558FF',
                              padding: '2px 6px',
                              borderRadius: 999,
                            }}
                          >
                            IN PROGRESS
                          </span>
                        </div>
                        <div style={{ fontSize: 9.5, color: '#5A6275', marginTop: 3 }}>
                          📅 2026-11-06 • Aarav Sharma • 4 stops (150m)
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Safe-Area Mobile Bottom Nav */}
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
                    <span style={{ color: idx % 2 === 0 ? '#2558FF' : '#8C94A6' }}>Overview</span>
                    <span style={{ color: '#8C94A6' }}>Live Map</span>
                    <span style={{ color: idx % 2 === 1 ? '#2558FF' : '#8C94A6' }}>Trips</span>
                    <span style={{ color: '#8C94A6' }}>Visits</span>
                    <span style={{ color: '#8C94A6' }}>Team</span>
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

