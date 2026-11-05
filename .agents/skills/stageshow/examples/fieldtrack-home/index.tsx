import { Stage, Phone, Roll, type Act } from '../../kit'
import { Navigation, MapPin, CheckCircle2, ShieldCheck, Compass, Clock, ChevronRight, UserCheck } from 'lucide-react'
import '../fieldtrack-common/fieldtrack.css'

interface State {
  onDuty: boolean
  mileage: number
  stopsCompleted: number
  navigating: boolean
  activeTab: 'overview' | 'route' | 'history'
}

const INITIAL: State = {
  onDuty: true,
  mileage: 42.4,
  stopsCompleted: 2,
  navigating: false,
  activeTab: 'overview',
}

const POSTER: State = {
  onDuty: true,
  mileage: 44.8,
  stopsCompleted: 3,
  navigating: true,
  activeTab: 'overview',
}

const script = async (a: Act<State>) => {
  await a.wait(1000)
  a.mark('tap-start-nav')
  await a.click('start-nav-btn')
  a.put({ navigating: true })
  
  // Odometer increments as representative travels on Bailey Road
  await a.wait(800)
  for (let m = 42.4; m <= 44.8; m += 0.6) {
    await a.wait(220)
    a.put({ mileage: parseFloat(m.toFixed(1)) })
  }

  await a.wait(1200)
  a.mark('arrival')
  a.put({ stopsCompleted: 3 })
  
  await a.wait(2400)
  // Clean loop reset
  await a.snap(INITIAL)
  await a.wait(400)
}

export function HomeScreenContent({ s }: { s: State }) {
  return (
    <div className="ft-phone-screen">
      {/* Simulation Watermark Banner */}
      <div className="ft-simulation-banner">
        <span>SIMULATED ROUTE PLAYBACK</span>
        <span>GPS CADENCE: 60s TARGET</span>
      </div>

      {/* FieldTrack Mobile App Bar */}
      <div className="ft-app-header">
        <div className="ft-brand-mark">
          <div className="ft-brand-logo">FT</div>
          <div>
            <div className="ft-brand-title">FieldTrack</div>
            <div className="ft-brand-sub">Bihar Div · Patna Central</div>
          </div>
        </div>
        <div className="ft-status-pill ft-status-pill--active">
          <span className="ft-pulse-dot" />
          <span>{s.onDuty ? 'Trip GPS Active' : 'Standby'}</span>
        </div>
      </div>

      {/* Rep Greeting & Shift Brief */}
      <div style={{ padding: '12px 16px 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="ft-meta" style={{ marginBottom: 4 }}>FIELD OFFICER · FT-BR-104</div>
            <h1 className="ft-h1">Aakash Verma</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="ft-meta" style={{ marginBottom: 4 }}>SHIFT ELAPSED</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ft-forest)' }}>4h 15m IST</span>
          </div>
        </div>
      </div>

      {/* Shift KPI Grid */}
      <div style={{ padding: '8px 16px 10px' }}>
        <div className="ft-stat-grid">
          <div className="ft-stat-tile">
            <span className="ft-stat-label">Stops Done</span>
            <div className="ft-stat-value" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Roll>{String(s.stopsCompleted)}</Roll>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ft-charcoal-muted)' }}>/ 5</span>
            </div>
          </div>
          <div className="ft-stat-tile">
            <span className="ft-stat-label">Trip Distance</span>
            <div className="ft-stat-value" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Roll>{s.mileage.toFixed(1)}</Roll>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ft-charcoal-muted)' }}>km</span>
            </div>
          </div>
          <div className="ft-stat-tile">
            <span className="ft-stat-label">Geofence</span>
            <div className="ft-stat-value" style={{ color: 'var(--ft-forest)', fontSize: 14 }}>
              150m
            </div>
          </div>
        </div>
      </div>

      {/* Active Route Hero Card */}
      <div style={{ padding: '0 16px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="ft-card ft-card--forest" style={{ position: 'relative', overflow: 'hidden', padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: 'var(--ft-copper-light)', textTransform: 'uppercase' }}>
              APPROVED TRIP · IN PROGRESS
            </span>
            <span style={{ fontSize: 10, background: 'rgba(245, 242, 233, 0.18)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              TRIP #BR-4092
            </span>
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, color: '#FAF8F3', marginBottom: 2 }}>
            Patna - Muzaffarpur Retail Beat
          </div>
          <div style={{ fontSize: 11, color: 'rgba(245, 242, 233, 0.85)', marginBottom: 10 }}>
            Approved by Priya Sharma (Territory Mgr) · 08:30 AM IST
          </div>

          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map((num) => (
              <div
                key={num}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: num <= s.stopsCompleted ? 'var(--ft-copper-light)' : 'rgba(255, 255, 255, 0.22)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* Next Stop Highlight */}
          <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={15} color="var(--ft-copper-light)" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>Mithila Super Bazaar</div>
                <div style={{ fontSize: 10, color: 'rgba(245, 242, 233, 0.75)' }}>Bailey Rd, Patna · 150m Geofence</div>
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ft-copper-light)' }}>
              Stop 3
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          data-target="start-nav-btn"
          className={`ft-btn ${s.navigating ? 'ft-btn--copper' : 'ft-btn--forest'}`}
          style={{ width: '100%', padding: '11px 16px', borderRadius: 12 }}
        >
          <Navigation size={15} />
          <span>{s.navigating ? 'Simulated Route Active · En Route' : 'Start Transit to Mithila Super Bazaar'}</span>
        </button>

        {/* Next Upcoming Waypoint Preview */}
        <div style={{ marginTop: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="ft-meta" style={{ textTransform: 'uppercase', fontSize: 10 }}>NEXT IN QUEUE</span>
            <span className="ft-meta" style={{ color: 'var(--ft-forest)', fontWeight: 600 }}>2 Pending</span>
          </div>
          <div className="ft-stop-row" style={{ padding: '8px 10px' }}>
            <div className="ft-stop-num">4</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Muzaffarpur FMCG Depot</div>
              <div className="ft-caption" style={{ fontSize: 10 }}>Club Road · ETA 01:30 PM IST · Audit</div>
            </div>
            <ChevronRight size={14} color="var(--ft-charcoal-light)" />
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div style={{ borderTop: '1px solid var(--ft-ivory-border)', padding: '8px 24px 14px', background: 'var(--ft-ivory)', display: 'flex', justifyContent: 'space-around' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'var(--ft-forest)' }}>
          <Compass size={16} />
          <span style={{ fontSize: 10, fontWeight: 700 }}>Today</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'var(--ft-charcoal-light)' }}>
          <CheckCircle2 size={16} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>Visits</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'var(--ft-charcoal-light)' }}>
          <UserCheck size={16} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>Approvals</span>
        </div>
      </div>
    </div>
  )
}

export default function FieldTrackHomeDemo() {
  return (
    <Stage<State>
      width={420}
      height={680}
      compact={{ below: 400, width: 358, height: 680 }}
      initial={INITIAL}
      poster={POSTER}
      script={script}
      cursor={{ at: { x: 210, y: 535 }, style: 'touch' }}
      className="ft-stage-canvas"
    >
      {(s) => (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', height: '100%', alignItems: 'center' }}>
          <Phone width={320} frame="pro" time="11:15" dark={false}>
            <HomeScreenContent s={s} />
          </Phone>
        </div>
      )}
    </Stage>
  )
}
