import { Stage, Phone, Roll, type Act } from '../../kit'
import { ArrowUpDown, Check, CheckCircle2, ChevronRight, Clock, Compass, MapPin, Sparkles, UserCheck } from 'lucide-react'
import '../fieldtrack-common/fieldtrack.css'

interface State {
  optimized: boolean
  totalKm: number
  totalTime: string
  savedKm: string
  statusText: string
  selectedStop: number
}

const INITIAL: State = {
  optimized: false,
  totalKm: 78.4,
  totalTime: '5h 30m',
  savedKm: '0.0',
  statusText: 'Original Sequence',
  selectedStop: 3,
}

const POSTER: State = {
  optimized: true,
  totalKm: 64.2,
  totalTime: '4h 15m',
  savedKm: '14.2',
  statusText: 'Approved Sequence · Locked',
  selectedStop: 3,
}

const script = async (a: Act<State>) => {
  await a.wait(1000)
  a.mark('tap-optimize')
  await a.click('optimize-btn')
  
  a.put({ statusText: 'Reordering stops for NH-22...' })
  await a.wait(700)
  
  a.put({
    optimized: true,
    totalKm: 64.2,
    totalTime: '4h 15m',
    savedKm: '14.2',
    statusText: 'Approved Sequence · Synchronized',
  })
  
  await a.wait(1800)
  a.mark('inspect-stop')
  await a.click('stop-row-4')
  a.put({ selectedStop: 4 })

  await a.wait(2200)
  // Clean loop reset
  await a.snap(INITIAL)
  await a.wait(400)
}

export function TripPlanningContent({ s }: { s: State }) {
  return (
    <div className="ft-phone-screen">
      {/* Simulation Watermark Banner */}
      <div className="ft-simulation-banner">
        <span>SIMULATED ROUTE PLANNING</span>
        <span>PATNA - MUZAFFARPUR BEAT</span>
      </div>

      {/* Header */}
      <div className="ft-app-header">
        <div className="ft-brand-mark">
          <div className="ft-brand-logo" style={{ background: 'var(--ft-forest)' }}>
            <ArrowUpDown size={15} color="#F5F2E9" />
          </div>
          <div>
            <div className="ft-brand-title">Trip Route Plan</div>
            <div className="ft-brand-sub">Trip #BR-4092 · 5 Stops</div>
          </div>
        </div>
        <div className="ft-status-pill ft-status-pill--active">
          <UserCheck size={11} />
          <span>Approved</span>
        </div>
      </div>

      {/* Approval & Distance Summary */}
      <div style={{ padding: '10px 16px 6px' }}>
        <div className="ft-card ft-card--copper" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ft-copper-deep)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              APPROVED BY PRIYA SHARMA (MGR)
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ft-charcoal-muted)' }}>
              {s.statusText}
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ft-forest)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <Roll>{s.totalKm.toFixed(1)}</Roll>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ft-charcoal-muted)' }}>km</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ft-charcoal-muted)', marginTop: 2 }}>Est. Travel: {s.totalTime} IST</div>
            </div>

            {s.optimized && (
              <div style={{ background: 'var(--ft-forest)', color: '#FAF8F3', padding: '4px 8px', borderRadius: 6, textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.85 }}>SAMPLE DATA</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  -{s.savedKm} km (Sample)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sequence Waypoint List */}
      <div style={{ padding: '4px 16px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span className="ft-meta" style={{ textTransform: 'uppercase', fontSize: 10 }}>WAYPOINT SEQUENCE · 150m GEOFENCE</span>
          <span className="ft-meta" style={{ color: 'var(--ft-copper)', fontWeight: 600, fontSize: 10 }}>
            {s.optimized ? 'NH-22 Sequence' : 'Standard Sequence'}
          </span>
        </div>

        {/* Stop 1 - Done */}
        <div className="ft-stop-row" data-completed="true" style={{ padding: '7px 10px' }}>
          <div className="ft-stop-num" style={{ background: 'var(--ft-forest)', color: '#fff' }}>
            <Check size={11} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ft-charcoal)' }}>Patliputra Retail Hub</div>
            <div className="ft-caption" style={{ fontSize: 10 }}>Boring Rd, Patna · Visited 09:30 AM IST</div>
          </div>
          <span style={{ fontSize: 10, color: 'var(--ft-forest)', fontWeight: 700 }}>VERIFIED</span>
        </div>

        {/* Stop 2 - Done */}
        <div className="ft-stop-row" data-completed="true" style={{ padding: '7px 10px' }}>
          <div className="ft-stop-num" style={{ background: 'var(--ft-forest)', color: '#fff' }}>
            <Check size={11} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ft-charcoal)' }}>Kankarbagh Kirana Mart</div>
            <div className="ft-caption" style={{ fontSize: 10 }}>Kankarbagh, Patna · Visited 10:45 AM IST</div>
          </div>
          <span style={{ fontSize: 10, color: 'var(--ft-forest)', fontWeight: 700 }}>VERIFIED</span>
        </div>

        {/* Stop 3 - Active Next */}
        <div className="ft-stop-row" data-active="true" style={{ padding: '8px 10px' }}>
          <div className="ft-stop-num" style={{ background: 'var(--ft-forest)', color: '#FAF8F3' }}>
            3
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ft-forest)' }}>Mithila Super Bazaar</span>
              <span style={{ fontSize: 9, background: 'var(--ft-copper-subtle)', color: 'var(--ft-copper-deep)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                150m GEOFENCE
              </span>
            </div>
            <div className="ft-caption" style={{ fontSize: 10 }}>Bailey Rd, Patna · Target 11:30 AM IST</div>
          </div>
          <span className="ft-pulse-dot" style={{ color: 'var(--ft-forest)' }} />
        </div>

        {/* Stop 4 & Stop 5 (Dynamic Order depending on optimization) */}
        <div
          data-target="stop-row-4"
          className="ft-stop-row"
          data-active={s.selectedStop === 4}
          style={{
            padding: '7px 10px',
            borderColor: s.optimized ? 'var(--ft-forest-border)' : 'var(--ft-ivory-border)',
          }}
        >
          <div className="ft-stop-num">{s.optimized ? '4' : '5'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {s.optimized ? 'Muzaffarpur FMCG Depot' : 'Tirhut Wholesale Kendra'}
            </div>
            <div className="ft-caption" style={{ fontSize: 10 }}>
              {s.optimized ? 'Club Rd, Muzaffarpur · ETA 01:30 PM IST' : 'Saraiya Ganj, Muzaffarpur · ETA 03:00 PM IST'}
            </div>
          </div>
          {s.optimized && (
            <span style={{ fontSize: 9, background: 'rgba(36, 75, 60, 0.08)', color: 'var(--ft-forest)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
              Direct NH-22
            </span>
          )}
        </div>

        <div className="ft-stop-row" style={{ padding: '7px 10px' }}>
          <div className="ft-stop-num">{s.optimized ? '5' : '4'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {s.optimized ? 'Tirhut Wholesale Kendra' : 'Muzaffarpur FMCG Depot'}
            </div>
            <div className="ft-caption" style={{ fontSize: 10 }}>
              {s.optimized ? 'Saraiya Ganj · ETA 03:00 PM IST · Audit' : 'Club Rd · ETA 02:15 PM IST'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div style={{ padding: '8px 16px 20px', background: 'var(--ft-ivory)', borderTop: '1px solid var(--ft-ivory-border)' }}>
        <button
          data-target="optimize-btn"
          className={`ft-btn ${s.optimized ? 'ft-btn--forest' : 'ft-btn--copper'}`}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12 }}
        >
          {s.optimized ? <CheckCircle2 size={15} /> : <ArrowUpDown size={15} />}
          <span>{s.optimized ? 'Sequence Synchronized with Dispatch' : 'Apply Optimized Corridor Sequence'}</span>
        </button>
      </div>
    </div>
  )
}

export default function FieldTrackTripPlanningDemo() {
  return (
    <Stage<State>
      width={420}
      height={680}
      compact={{ below: 400, width: 358, height: 680 }}
      initial={INITIAL}
      poster={POSTER}
      script={script}
      cursor={{ at: { x: 210, y: 560 }, style: 'touch' }}
      className="ft-stage-canvas"
    >
      {(s) => (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', height: '100%', alignItems: 'center' }}>
          <Phone width={320} frame="pro" time="11:18" dark={false}>
            <TripPlanningContent s={s} />
          </Phone>
        </div>
      )}
    </Stage>
  )
}
