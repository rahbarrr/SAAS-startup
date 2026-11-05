import { useState } from 'react'
import { Stage, Phone, type Act } from '../../kit'
import { HomeScreenContent } from '../fieldtrack-home'
import { TripPlanningContent } from '../fieldtrack-trip-planning'
import { LiveTrackingContent } from '../fieldtrack-live-tracking'
import { StoreCheckinContent } from '../fieldtrack-store-checkin'
import { Compass, ArrowUpDown, Navigation, ShieldCheck } from 'lucide-react'
import '../fieldtrack-common/fieldtrack.css'

type ScreenId = 'all' | 'home' | 'trips' | 'tracking' | 'checkin'

interface State {
  selectedScreen: ScreenId
  homeState: Parameters<typeof HomeScreenContent>[0]['s']
  tripState: Parameters<typeof TripPlanningContent>[0]['s']
  trackingState: Parameters<typeof LiveTrackingContent>[0]['s']
  checkinState: Parameters<typeof StoreCheckinContent>[0]['s']
}

const INITIAL: State = {
  selectedScreen: 'all',
  homeState: {
    onDuty: true,
    mileage: 42.4,
    stopsCompleted: 2,
    navigating: false,
    activeTab: 'overview',
  },
  tripState: {
    optimized: false,
    totalKm: 78.4,
    totalTime: '5h 30m',
    savedKm: '0.0',
    statusText: 'Original Sequence',
    selectedStop: 3,
  },
  trackingState: {
    progress: 0.15,
    speed: 38,
    distanceMeters: 620,
    insideGeofence: false,
    hudText: 'Trip GPS Active · Bailey Rd, Patna',
    turnInstruction: 'Continue 450m on Bailey Road',
    showPrompt: false,
    syncSecondsAgo: 18,
  },
  checkinState: {
    checkedIn: false,
    timestamp: '',
    verifying: false,
    checklistCompleted: 0,
    activeStep: 1,
  },
}

const POSTER: State = {
  selectedScreen: 'all',
  homeState: {
    onDuty: true,
    mileage: 44.8,
    stopsCompleted: 3,
    navigating: true,
    activeTab: 'overview',
  },
  tripState: {
    optimized: true,
    totalKm: 64.2,
    totalTime: '4h 15m',
    savedKm: '14.2',
    statusText: 'Approved Sequence · Locked',
    selectedStop: 3,
  },
  trackingState: {
    progress: 0.94,
    speed: 0,
    distanceMeters: 118,
    insideGeofence: true,
    hudText: 'Inside 150m Geofence · Bailey Rd',
    turnInstruction: 'Arrived within 150m Boundary',
    showPrompt: true,
    syncSecondsAgo: 5,
  },
  checkinState: {
    checkedIn: true,
    timestamp: '11:32:10 AM IST',
    verifying: false,
    checklistCompleted: 1,
    activeStep: 2,
  },
}

const script = async (a: Act<State>) => {
  await a.wait(800)
  a.mark('trip-optimize')
  // Beat 1: Optimize trip for NH-22 corridor
  a.put((prev) => ({
    ...prev,
    tripState: {
      optimized: true,
      totalKm: 64.2,
      totalTime: '4h 15m',
      savedKm: '14.2',
      statusText: 'Approved Sequence · Synchronized',
      selectedStop: 3,
    },
  }))

  await a.wait(1200)
  a.mark('start-navigation')
  // Beat 2: Home rep starts navigation
  a.put((prev) => ({
    ...prev,
    homeState: {
      ...prev.homeState,
      navigating: true,
      mileage: 44.8,
    },
  }))

  await a.wait(1400)
  a.mark('gps-arrival')
  // Beat 3: Live tracking vehicle glides to 150m store geofence
  a.put((prev) => ({
    ...prev,
    trackingState: {
      progress: 0.94,
      speed: 0,
      distanceMeters: 118,
      insideGeofence: true,
      hudText: 'Inside 150m Store Boundary',
      turnInstruction: 'Arrived at Mithila Super Bazaar',
      showPrompt: true,
      syncSecondsAgo: 3,
    },
  }))

  await a.wait(1400)
  a.mark('store-checkin')
  // Beat 4: Rep confirms arrival check-in on-site
  a.put((prev) => ({
    ...prev,
    checkinState: {
      checkedIn: true,
      timestamp: '11:32:10 AM IST',
      verifying: false,
      checklistCompleted: 1,
      activeStep: 2,
    },
    homeState: {
      ...prev.homeState,
      stopsCompleted: 3,
    },
  }))

  await a.wait(3200)
  // Clean reset
  await a.snap(INITIAL)
  await a.wait(500)
}

export default function FieldTrackShowcase() {
  const [activeView, setActiveView] = useState<ScreenId>('all')

  return (
    <Stage<State>
      width={1320}
      height={820}
      compact={{ below: 1100, width: 358, height: 820 }}
      initial={INITIAL}
      poster={POSTER}
      script={script}
      className="ft-stage-canvas"
    >
      {(s) => (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: '16px 24px' }}>
          {/* Executive Showcase Top Bar */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--ft-forest)',
                  color: 'var(--ft-ivory)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 16,
                  boxShadow: '0 3px 10px rgba(36, 75, 60, 0.25)',
                }}
              >
                FT
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ft-forest)', letterSpacing: -0.3 }}>
                  FieldTrack Mobile Platform · Bihar Operations
                </div>
                <div style={{ fontSize: 11, color: 'var(--ft-charcoal-muted)', fontWeight: 500, marginTop: 2 }}>
                  Patna & Muzaffarpur Corridors · 150m Configured Geofence · 60s Update Target
                </div>
              </div>
            </div>

            {/* Design Tokens Pill Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255, 255, 255, 0.75)', padding: '5px 12px', borderRadius: 30, border: '1px solid var(--ft-ivory-border)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ft-charcoal-muted)', textTransform: 'uppercase' }}>
                Forest & Ivory:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#244B3C', display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#244B3C' }}>#244B3C</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#F5F2E9', display: 'inline-block', border: '1px solid #D5CEBD' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6A6559' }}>#F5F2E9</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#252B27', display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#252B27' }}>#252B27</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#B98252', display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#96663E' }}>#B98252</span>
              </div>
            </div>

            {/* View Selector Tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(36, 75, 60, 0.08)', padding: 3, borderRadius: 8 }}>
              {[
                { id: 'all', label: 'All 4 Screens' },
                { id: 'home', label: '1. Dashboard' },
                { id: 'trips', label: '2. Route Plan' },
                { id: 'tracking', label: '3. Live GPS' },
                { id: 'checkin', label: '4. Check-in' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as ScreenId)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: activeView === tab.id ? 'var(--ft-forest)' : 'transparent',
                    color: activeView === tab.id ? 'var(--ft-ivory)' : 'var(--ft-charcoal)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          {/* Demonstration Canvas */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {activeView === 'all' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 305px)', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
                {/* 1. Home Dashboard */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ft-forest)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Compass size={13} /> 1. Home Dashboard
                  </div>
                  <Phone width={300} frame="pro" time="11:15" dark={false}>
                    <HomeScreenContent s={s.homeState} />
                  </Phone>
                </div>

                {/* 2. Route Planning */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ft-forest)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ArrowUpDown size={13} color="var(--ft-copper)" /> 2. Trip Optimization
                  </div>
                  <Phone width={300} frame="pro" time="11:18" dark={false}>
                    <TripPlanningContent s={s.tripState} />
                  </Phone>
                </div>

                {/* 3. Live GPS Tracking */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ft-forest)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Navigation size={13} /> 3. Live GPS (60s Cadence)
                  </div>
                  <Phone width={300} frame="pro" time="11:24" dark={false}>
                    <LiveTrackingContent s={s.trackingState} />
                  </Phone>
                </div>

                {/* 4. Store Visit & Check-in */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ft-forest)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ShieldCheck size={13} color="var(--ft-forest)" /> 4. 150m Geofence Check-in
                  </div>
                  <Phone width={300} frame="pro" time="11:32" dark={false}>
                    <StoreCheckinContent s={s.checkinState} />
                  </Phone>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                {activeView === 'home' && (
                  <Phone width={320} frame="pro" time="11:15" dark={false}>
                    <HomeScreenContent s={s.homeState} />
                  </Phone>
                )}
                {activeView === 'trips' && (
                  <Phone width={320} frame="pro" time="11:18" dark={false}>
                    <TripPlanningContent s={s.tripState} />
                  </Phone>
                )}
                {activeView === 'tracking' && (
                  <Phone width={320} frame="pro" time="11:24" dark={false}>
                    <LiveTrackingContent s={s.trackingState} />
                  </Phone>
                )}
                {activeView === 'checkin' && (
                  <Phone width={320} frame="pro" time="11:32" dark={false}>
                    <StoreCheckinContent s={s.checkinState} />
                  </Phone>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Stage>
  )
}
