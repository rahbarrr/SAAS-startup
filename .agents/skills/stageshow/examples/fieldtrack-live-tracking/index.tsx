import { Stage, Phone, Roll, type Act } from '../../kit'
import { Navigation, Compass, MapPin, Radio, Shield, Clock, AlertCircle } from 'lucide-react'
import '../fieldtrack-common/fieldtrack.css'

interface State {
  progress: number
  speed: number
  distanceMeters: number
  insideGeofence: boolean
  hudText: string
  turnInstruction: string
  showPrompt: boolean
  syncSecondsAgo: number
}

const INITIAL: State = {
  progress: 0.15,
  speed: 38,
  distanceMeters: 620,
  insideGeofence: false,
  hudText: 'Trip GPS Active · Bailey Rd, Patna',
  turnInstruction: 'Continue 450m on Bailey Road',
  showPrompt: false,
  syncSecondsAgo: 18,
}

const POSTER: State = {
  progress: 0.94,
  speed: 0,
  distanceMeters: 118,
  insideGeofence: true,
  hudText: 'Inside 150m Geofence · Bailey Rd',
  turnInstruction: 'Arrived within 150m Boundary',
  showPrompt: true,
  syncSecondsAgo: 5,
}

const script = async (a: Act<State>) => {
  await a.wait(1000)
  a.mark('transit-patna')

  // En-route progression towards Bailey Road store
  const steps = [
    { p: 0.35, s: 32, d: 410, g: false, h: 'Bailey Rd, Patna · 60s Cadence', t: 'Turn slightly left past Canal Rd', prompt: false, sync: 24 },
    { p: 0.65, s: 22, d: 240, g: false, h: 'Approaching Store Perimeter', t: 'In 100m, destination on left', prompt: false, sync: 42 },
    { p: 0.85, s: 12, d: 158, g: false, h: 'Nearing 150m Boundary', t: 'Slow down for geofence arrival', prompt: false, sync: 58 },
    { p: 0.94, s: 0, d: 118, g: true, h: 'Inside 150m Store Boundary', t: 'Arrived at Mithila Super Bazaar', prompt: true, sync: 3 },
  ]

  for (const step of steps) {
    await a.wait(900)
    a.put({
      progress: step.p,
      speed: step.s,
      distanceMeters: step.d,
      insideGeofence: step.g,
      hudText: step.h,
      turnInstruction: step.t,
      showPrompt: step.prompt,
      syncSecondsAgo: step.sync,
    })
  }

  await a.wait(2400)
  a.mark('arrival-prompt-visible')
  await a.wait(1400)
  
  // Clean loop reset
  await a.snap(INITIAL)
  await a.wait(400)
}

export function LiveTrackingContent({ s }: { s: State }) {
  const t = s.progress
  const vx = 50 + t * (230 - 50)
  const vy = 310 - t * (310 - 110)

  return (
    <div className="ft-phone-screen">
      {/* Simulation Watermark Banner */}
      <div className="ft-simulation-banner">
        <span>SIMULATED GPS MOVEMENT</span>
        <span>PATNA NH-22 CORRIDOR</span>
      </div>

      {/* Header HUD / Navigation Banner */}
      <div
        style={{
          padding: '10px 16px',
          background: 'var(--ft-forest)',
          color: 'var(--ft-ivory)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(36, 75, 60, 0.25)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(245, 242, 233, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Navigation size={15} color="var(--ft-ivory)" style={{ transform: 'rotate(45deg)' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{s.turnInstruction}</div>
            <div style={{ fontSize: 10, color: 'var(--ft-copper-light)', fontWeight: 500, marginTop: 2 }}>{s.hudText}</div>
          </div>
        </div>

        <div
          style={{
            background: s.insideGeofence ? 'var(--ft-copper)' : 'rgba(0, 0, 0, 0.25)',
            padding: '3px 8px',
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          {s.insideGeofence ? '150m IN' : 'TRIP GPS'}
        </div>
      </div>

      {/* Vector Topographical Map */}
      <div className="ft-map-container" style={{ flex: 1, position: 'relative' }}>
        <svg
          viewBox="0 0 320 380"
          style={{ width: '100%', height: '100%', display: 'block' }}
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="geofence-150m-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#244B3C" stopOpacity="0.25" />
              <stop offset="85%" stopColor="#244B3C" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#244B3C" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Patna Road Grid Simulation */}
          <line x1="20" y1="40" x2="20" y2="360" stroke="#DFD9C8" strokeWidth="3" />
          <line x1="90" y1="20" x2="90" y2="370" stroke="#DFD9C8" strokeWidth="4" />
          <line x1="170" y1="20" x2="170" y2="370" stroke="#DFD9C8" strokeWidth="3" />
          <line x1="250" y1="20" x2="250" y2="370" stroke="#DFD9C8" strokeWidth="4" />
          <line x1="10" y1="110" x2="310" y2="110" stroke="#DFD9C8" strokeWidth="4" />
          <line x1="10" y1="190" x2="310" y2="190" stroke="#DFD9C8" strokeWidth="3" />
          <line x1="10" y1="270" x2="310" y2="270" stroke="#DFD9C8" strokeWidth="4" />

          {/* Active Route Polyline Path (Bailey Road Corridor) */}
          <path
            d="M 50,310 L 90,310 L 90,230 L 170,230 L 170,110 L 230,110"
            fill="none"
            stroke="var(--ft-forest)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 50,310 L 90,310 L 90,230 L 170,230 L 170,110 L 230,110"
            fill="none"
            stroke="var(--ft-copper-light)"
            strokeWidth="2"
            strokeDasharray="8 6"
            strokeLinecap="round"
          />

          {/* Configured 150m Geofence Perimeter Zone at Destination (230, 110) */}
          <circle cx="230" cy="110" r="58" fill="url(#geofence-150m-glow)" />
          <circle
            cx="230"
            cy="110"
            r="54"
            className="ft-geofence-circle"
            style={{ stroke: s.insideGeofence ? 'var(--ft-forest)' : 'rgba(36, 75, 60, 0.45)' }}
          />

          {/* 150m Geofence Radius Label */}
          <text x="230" y="46" textAnchor="middle" fill="var(--ft-forest)" fontSize="9" fontWeight="700">
            150m Geofence Radius
          </text>

          {/* Destination Pin (Mithila Super Bazaar) */}
          <g transform="translate(230, 110)">
            <circle cx="0" cy="0" r="14" fill="var(--ft-forest)" />
            <circle cx="0" cy="0" r="18" fill="none" stroke="var(--ft-forest)" strokeWidth="1.5" opacity="0.4" />
            <text x="0" y="4" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold">
              #3
            </text>
          </g>

          {/* Moving Field Rep GPS Locator (Simulated) */}
          <g transform={`translate(${vx}, ${vy})`} style={{ transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
            <path d="M 0,0 L -16,-26 A 28,28 0 0,1 16,-26 Z" fill="rgba(36, 75, 60, 0.18)" />
            <circle cx="0" cy="0" r="14" fill="rgba(185, 130, 82, 0.25)" className="ft-pulse-dot" />
            <circle cx="0" cy="0" r="7" fill="var(--ft-forest)" stroke="#FFFFFF" strokeWidth="2" />
          </g>
        </svg>

        {/* Floating Distance Badge */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(250, 248, 243, 0.94)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--ft-ivory-border)',
            borderRadius: 8,
            padding: '5px 8px',
            boxShadow: 'var(--ft-shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <MapPin size={12} color="var(--ft-forest)" />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ft-charcoal)' }}>
              <Roll>{String(s.distanceMeters)}</Roll>m
            </div>
            <div style={{ fontSize: 9, color: 'var(--ft-charcoal-muted)' }}>To Store Center</div>
          </div>
        </div>

        {/* Compass Heading Widget */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'rgba(250, 248, 243, 0.94)',
            border: '1px solid var(--ft-ivory-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--ft-shadow-sm)',
          }}
        >
          <Compass size={16} color="var(--ft-forest)" />
        </div>
      </div>

      {/* Prompt-based Arrival Card or Standard Telemetry */}
      {s.showPrompt ? (
        <div style={{ padding: '10px 16px 14px', background: '#FFFFFF', borderTop: '1.5px solid var(--ft-forest)', zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ft-forest)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ARRIVAL DETECTED (WITHIN 150m)
            </span>
            <span style={{ fontSize: 10, background: 'var(--ft-forest-subtle)', color: 'var(--ft-forest)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
              118m From Store
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ft-charcoal)', marginBottom: 2 }}>
            You have arrived at Mithila Super Bazaar
          </div>
          <div style={{ fontSize: 10, color: 'var(--ft-charcoal-muted)', marginBottom: 10 }}>
            Device GPS is within the configured 150m geofence radius. Confirm to open store check-in.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="ft-btn ft-btn--forest"
              style={{ flex: 1, padding: '9px 12px', fontSize: 12, borderRadius: 8 }}
            >
              Confirm Arrival & Check In
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '12px 16px 16px',
            background: 'var(--ft-ivory-warm)',
            borderTop: '1px solid var(--ft-ivory-border)',
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Radio size={13} color="var(--ft-forest)" />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ft-forest)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                PERIODIC GPS (60s TARGET)
              </span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ft-charcoal-muted)' }}>
              Accuracy ±8m (Device GPS)
            </span>
          </div>

          <div className="ft-stat-grid" style={{ marginBottom: 8 }}>
            <div className="ft-stat-tile" style={{ background: '#FFFFFF' }}>
              <span className="ft-stat-label">Speed</span>
              <div className="ft-stat-value" style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <Roll>{String(s.speed)}</Roll>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ft-charcoal-muted)' }}>km/h</span>
              </div>
            </div>

            <div className="ft-stat-tile" style={{ background: '#FFFFFF' }}>
              <span className="ft-stat-label">Cadence</span>
              <div className="ft-stat-value" style={{ fontSize: 13, color: 'var(--ft-forest)' }}>
                Target 60s
              </div>
            </div>

            <div className="ft-stat-tile" style={{ background: '#FFFFFF' }}>
              <span className="ft-stat-label">150m Zone</span>
              <div className="ft-stat-value" style={{ fontSize: 12, color: s.insideGeofence ? 'var(--ft-forest)' : 'var(--ft-copper)' }}>
                {s.insideGeofence ? 'INSIDE' : 'OUTSIDE'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ft-caption" style={{ fontSize: 10 }}>Target: Mithila Super Bazaar · Bailey Rd</span>
            <span className="ft-meta" style={{ fontSize: 10 }}>Sync: {s.syncSecondsAgo}s ago</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FieldTrackLiveTrackingDemo() {
  return (
    <Stage<State>
      width={420}
      height={680}
      compact={{ below: 400, width: 358, height: 680 }}
      initial={INITIAL}
      poster={POSTER}
      script={script}
      cursor={{ at: { x: 210, y: 590 }, style: 'touch' }}
      className="ft-stage-canvas"
    >
      {(s) => (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', height: '100%', alignItems: 'center' }}>
          <Phone width={320} frame="pro" time="11:24" dark={false}>
            <LiveTrackingContent s={s} />
          </Phone>
        </div>
      )}
    </Stage>
  )
}
