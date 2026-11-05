import { Stage, Phone, type Act } from '../../kit'
import { Check, CheckCircle2, Camera, ClipboardCheck, Lock, MapPin, ShieldCheck, Store, UserCheck } from 'lucide-react'
import '../fieldtrack-common/fieldtrack.css'

interface State {
  checkedIn: boolean
  timestamp: string
  verifying: boolean
  checklistCompleted: number
  activeStep: number
}

const INITIAL: State = {
  checkedIn: false,
  timestamp: '',
  verifying: false,
  checklistCompleted: 0,
  activeStep: 1,
}

const POSTER: State = {
  checkedIn: true,
  timestamp: '11:32:10 AM IST',
  verifying: false,
  checklistCompleted: 1,
  activeStep: 2,
}

const script = async (a: Act<State>) => {
  await a.wait(1000)
  a.mark('tap-checkin')
  await a.click('checkin-btn')
  
  a.put({ verifying: true })
  await a.wait(800)

  // Verified check-in within 150m geofence
  a.put({
    checkedIn: true,
    verifying: false,
    timestamp: '11:32:10 AM IST',
    checklistCompleted: 1,
    activeStep: 2,
  })

  await a.wait(1800)
  a.mark('open-shelf-audit')
  await a.click('checklist-item-2')
  
  await a.wait(2400)
  // Clean loop reset
  await a.snap(INITIAL)
  await a.wait(400)
}

export function StoreCheckinContent({ s }: { s: State }) {
  return (
    <div className="ft-phone-screen">
      {/* Simulation Watermark Banner */}
      <div className="ft-simulation-banner">
        <span>SIMULATED STORE VISIT</span>
        <span>PATNA · 150m GEOFENCE</span>
      </div>

      {/* Header */}
      <div className="ft-app-header">
        <div className="ft-brand-mark">
          <div className="ft-brand-logo" style={{ background: 'var(--ft-forest)' }}>
            <Store size={15} color="#F5F2E9" />
          </div>
          <div>
            <div className="ft-brand-title">Store Visit</div>
            <div className="ft-brand-sub">Store #BR-1042 · On-Site Audit</div>
          </div>
        </div>
        <div className="ft-status-pill ft-status-pill--active">
          <ShieldCheck size={11} />
          <span>Inside 150m</span>
        </div>
      </div>

      {/* Store Information Card */}
      <div style={{ padding: '10px 16px 6px' }}>
        <div className="ft-card ft-card--copper" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div>
              <h2 className="ft-h2" style={{ fontSize: 15 }}>Mithila Super Bazaar</h2>
              <div className="ft-caption" style={{ fontSize: 10, marginTop: 2 }}>
                Bailey Road, Danapur, Patna, Bihar
              </div>
            </div>
            <span style={{ fontSize: 9, background: 'var(--ft-forest)', color: '#FAF8F3', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
              PRIORITY
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--ft-copper-border)' }}>
            <div>
              <div className="ft-meta" style={{ fontSize: 9 }}>STORE LEAD</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ft-charcoal)' }}>Sunil Mehta</div>
            </div>
            <div>
              <div className="ft-meta" style={{ fontSize: 9 }}>TERRITORY</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ft-charcoal)' }}>Patna Central</div>
            </div>
            <div>
              <div className="ft-meta" style={{ fontSize: 9 }}>TARGET WINDOW</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ft-forest)' }}>11:30 - 12:15 IST</div>
            </div>
          </div>
        </div>
      </div>

      {/* GPS Geofence Verification Status Card & Check-in Action */}
      <div style={{ padding: '4px 16px 8px' }}>
        {s.checkedIn ? (
          <div
            className="ft-card"
            style={{
              background: 'var(--ft-forest)',
              color: 'var(--ft-ivory)',
              padding: '10px 12px',
              borderColor: 'var(--ft-forest)',
              boxShadow: '0 3px 10px rgba(36, 75, 60, 0.22)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} color="var(--ft-copper-light)" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>Arrival Verified in 150m Geofence</span>
              </div>
              <span style={{ fontSize: 9, background: 'rgba(255, 255, 255, 0.18)', padding: '2px 5px', borderRadius: 4, fontWeight: 600 }}>
                {s.timestamp}
              </span>
            </div>
            <div style={{ fontSize: 10, opacity: 0.9, paddingLeft: 22 }}>
              Distance: 48m from store center (Accuracy ±6m) · Log #VIS-BR-8842
            </div>
          </div>
        ) : (
          <button
            data-target="checkin-btn"
            className="ft-btn ft-btn--forest"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
              <ShieldCheck size={16} color="var(--ft-copper-light)" />
              <span>{s.verifying ? 'Recording Geofence Timestamp...' : 'Confirm 150m Geofence Check-in'}</span>
            </div>
            <span style={{ fontSize: 9, opacity: 0.85, fontWeight: 400 }}>
              Device GPS: 48m from entrance (Configured radius: 150m)
            </span>
          </button>
        )}
      </div>

      {/* Visit Execution Workflow Checklist */}
      <div style={{ padding: '2px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="ft-meta" style={{ textTransform: 'uppercase', fontSize: 10 }}>VISIT AUDIT WORKFLOW</span>
          <span className="ft-meta" style={{ color: 'var(--ft-forest)', fontWeight: 700, fontSize: 10 }}>
            {s.checklistCompleted} of 4 Completed
          </span>
        </div>

        {/* Step 1: Geofence Seal */}
        <div className="ft-check-item" data-checked={s.checkedIn}>
          <div className="ft-checkbox-disc">
            {s.checkedIn ? <Check size={11} strokeWidth={3} /> : <MapPin size={9} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>1. 150m Geofence Arrival Check-in</div>
            <div className="ft-caption" style={{ fontSize: 9 }}>
              {s.checkedIn ? `Confirmed at ${s.timestamp} · 48m within boundary` : 'Prompt requires location within 150m'}
            </div>
          </div>
          {s.checkedIn && (
            <span style={{ fontSize: 9, color: 'var(--ft-forest)', fontWeight: 700 }}>VERIFIED</span>
          )}
        </div>

        {/* Step 2: Shelf Inventory Audit */}
        <div
          data-target="checklist-item-2"
          className="ft-check-item"
          style={{
            borderColor: s.activeStep === 2 ? 'var(--ft-forest)' : 'var(--ft-ivory-border)',
            background: s.activeStep === 2 ? '#FFFFFF' : 'var(--ft-ivory-card)',
            boxShadow: s.activeStep === 2 ? '0 2px 6px rgba(36, 75, 60, 0.1)' : 'none',
          }}
        >
          <div className="ft-checkbox-disc" style={{ borderColor: s.activeStep === 2 ? 'var(--ft-forest)' : undefined }}>
            <ClipboardCheck size={9} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>2. FMCG Shelf Availability & Facing Audit</div>
            <div className="ft-caption" style={{ fontSize: 9 }}>
              {s.checkedIn ? 'Ready to log · 6 Category SKUs' : 'Unlocks after check-in confirmation'}
            </div>
          </div>
          {s.checkedIn ? (
            <span style={{ fontSize: 9, background: 'var(--ft-copper-subtle)', color: 'var(--ft-copper-deep)', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>
              START
            </span>
          ) : (
            <Lock size={11} color="var(--ft-charcoal-light)" />
          )}
        </div>

        {/* Step 3: Photo Evidence */}
        <div className="ft-check-item">
          <div className="ft-checkbox-disc">
            <Camera size={9} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>3. Storefront & Display Rack Photo</div>
            <div className="ft-caption" style={{ fontSize: 9 }}>Capture FMCG promotional endcap</div>
          </div>
          <Lock size={11} color="var(--ft-charcoal-light)" />
        </div>

        {/* Step 4: Manager Sign-off */}
        <div className="ft-check-item">
          <div className="ft-checkbox-disc">
            <UserCheck size={9} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>4. Store Manager Sign-off: Sunil Mehta</div>
            <div className="ft-caption" style={{ fontSize: 9 }}>Sign on glass: Sunil Mehta (Store Lead)</div>
          </div>
          <Lock size={11} color="var(--ft-charcoal-light)" />
        </div>
      </div>

      <div style={{ height: 14 }} />
    </div>
  )
}

export default function FieldTrackStoreCheckinDemo() {
  return (
    <Stage<State>
      width={420}
      height={680}
      compact={{ below: 400, width: 358, height: 680 }}
      initial={INITIAL}
      poster={POSTER}
      script={script}
      cursor={{ at: { x: 210, y: 310 }, style: 'touch' }}
      className="ft-stage-canvas"
    >
      {(s) => (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', height: '100%', alignItems: 'center' }}>
          <Phone width={320} frame="pro" time="11:32" dark={false}>
            <StoreCheckinContent s={s} />
          </Phone>
        </div>
      )}
    </Stage>
  )
}
