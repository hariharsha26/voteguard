import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/ResultsCSP.css';
import {
  IconArrowLeft,
  IconVideo,
  IconChartBar,
  IconPhoto,
  IconFileText,
  IconDownload,
  IconAward,
  IconAdjustments,
  IconCheck,
  IconSchool,
  IconBook,
  IconPlayerPlay
} from '@tabler/icons-react';

// Lightweight, dependency-free count-up animation component
function AnimatedCounter({ value, duration = 1200, suffix = "" }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <>{count.toLocaleString()}{suffix}</>;
}

export default function ResultsCSP() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('A');
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Custom video controller state
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoMuted, setVideoMuted] = useState(false);
  const videoRef = useRef(null);

  // Simulator Allocation State
  const [allocations, setAllocations] = useState({
    flippedClassrooms: 25,
    infrastructure: 25,
    careerSeminars: 25,
    examCoaching: 25
  });

  const TOTAL_BUDGET = 100;
  const currentTotal = Object.values(allocations).reduce((a, b) => a + b, 0);
  const isBalanced = currentTotal === TOTAL_BUDGET;

  const handleSliderChange = (key, value) => {
    const intValue = parseInt(value) || 0;
    const oldVal = allocations[key];
    const diff = intValue - oldVal;

    // Check if adding this amount exceeds total budget
    if (currentTotal + diff <= TOTAL_BUDGET) {
      setAllocations({ ...allocations, [key]: intValue });
    } else {
      // Allocate the remaining budget to this slider
      const remaining = TOTAL_BUDGET - (currentTotal - oldVal);
      setAllocations({ ...allocations, [key]: remaining });
    }
  };

  // Live Simulated Metrics based on allocations
  const studentSatisfaction = Math.min(95, 50 + (allocations.flippedClassrooms * 0.8) + (allocations.infrastructure * 0.6));
  const examPreparedness = Math.min(98, 45 + (allocations.examCoaching * 1.2) + (allocations.flippedClassrooms * 0.4));
  const digitalReadiness = Math.min(100, 40 + (allocations.infrastructure * 1.0) + (allocations.careerSeminars * 0.6));

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Video Playback Custom Actions
  const handlePlayVideo = () => {
    if (videoRef.current) {
      if (videoPlaying) {
        videoRef.current.pause();
        setVideoPlaying(false);
      } else {
        videoRef.current.play();
        setVideoPlaying(true);
      }
    }
  };

  const handleScrubChange = (e) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setVideoTime(time);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setVideoMuted(videoRef.current.muted);
    }
  };

  const seekToMilestone = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setVideoPlaying(true);
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '0:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Custom data arrays
  const learningPreferences = [
    { label: 'Practical Lab Sessions', val: 92 },
    { label: 'Online Learning Platforms', val: 85 },
    { label: 'Video-based Learning', val: 78 },
    { label: 'Self-study', val: 72 },
    { label: 'Traditional Classroom Teaching', val: 38 }
  ];

  const collegeServices = [
    { label: 'Academic Guidance & Teaching', val: 90 },
    { label: 'Faculty Support/Approachability', val: 88 },
    { label: 'Career Counseling Seminars', val: 85 },
    { label: 'Competitive Exam Coaching', val: 54 },
    { label: 'Industry Exposure / Internships', val: 40 }
  ];

  const careerInfluencers = [
    { label: 'Parents / Family Expectations', val: 60 },
    { label: 'Friends / Peer Trends', val: 20 },
    { label: 'Teachers / Academic Advisory', val: 15 },
    { label: 'Self-Directed / Personal Interest', val: 5 }
  ];

  const streamPreferences = [
    { label: 'Computer Science Engineering (CSE)', val: 82 },
    { label: 'Electronics & Communication (ECE)', val: 58 },
    { label: 'Electrical Engineering (EEE)', val: 32 },
    { label: 'Mechanical Engineering (MECH)', val: 28 },
    { label: 'Civil Engineering (CIVIL)', val: 12 },
    { label: 'AI & Data Science (Low awareness)', val: 8 }
  ];

  const concernsList = [
    { label: 'Entrance Examinations (IIT, NEET, EAPCET)', val: 94 },
    { label: 'College Admissions & Placements', val: 88 },
    { label: 'Career Selection Uncertainty', val: 72 },
    { label: 'Financial / Scholarship Constraints', val: 45 }
  ];

  // 16 Sections Data
  const juniorSections = [
    { name: 'Jr. MPC-A', count: 23, track: 'Engineering' },
    { name: 'Jr. MPC-B', count: 22, track: 'Engineering' },
    { name: 'Jr. BiPC-A', count: 22, track: 'Medical' },
    { name: 'Jr. BiPC-B', count: 23, track: 'Medical' },
    { name: 'Jr. CEC-A', count: 23, track: 'Business' },
    { name: 'Jr. CEC-B', count: 22, track: 'Business' },
    { name: 'Jr. MEC-A', count: 22, track: 'Hybrid' },
    { name: 'Jr. MEC-B', count: 23, track: 'Hybrid' }
  ];

  const seniorSections = [
    { name: 'Sr. MPC-A', count: 35, track: 'Engineering' },
    { name: 'Sr. MPC-B', count: 35, track: 'Engineering' },
    { name: 'Sr. BiPC-A', count: 36, track: 'Medical' },
    { name: 'Sr. BiPC-B', count: 34, track: 'Medical' },
    { name: 'Sr. CEC-A', count: 35, track: 'Business' },
    { name: 'Sr. CEC-B', count: 35, track: 'Business' },
    { name: 'Sr. MEC-A', count: 34, track: 'Hybrid' },
    { name: 'Sr. MEC-B', count: 36, track: 'Hybrid' }
  ];

  const galleryItems = [
    {
      img: '/CSP_PROJECT/Image1.jpg',
      title: 'Student Awareness & Orientation',
      desc: 'Explaining the secure online voting workflow and survey objectives to the student cohorts.'
    },
    {
      img: '/CSP_PROJECT/image2.jpeg',
      title: 'Executive Review',
      desc: 'Presenting the verified analytical findings under the review of the Principal.'
    },
    {
      img: '/CSP_PROJECT/Certificate.png',
      title: 'Official Completion Certificate',
      desc: 'Official certificate recognizing the success of the VoteGuard Community Service Project.',
      isCertificate: true
    }
  ];

  return (
    <div className="results-csp-container">
      {/* HEADER */}
      <header className="csp-header">
        <div className="csp-header-left">
          <button className="btn-back-home" onClick={() => navigate('/')}>
            <IconArrowLeft size={16} /> Home
          </button>
          <div className="csp-header-title">VoteGuard CSP Analytics</div>
        </div>
        <div className="csp-header-right">
          <ThemeToggle />
        </div>
      </header>

      {/* HERO & VIDEO DASHBOARD */}
      <section className="csp-section">
        <div className="csp-hero-grid">
          <div className="csp-hero-intro">
            <div className="csp-eyebrow">
              <span className="badge-dot" style={{ backgroundColor: 'var(--gold)' }}></span>
              Community Service Project (CSP) 2026
            </div>
            <h1 className="csp-hero-title">
              VoteGuard Community Service Project <em>Analytics Dashboard</em>
            </h1>
            <p className="csp-hero-desc">
              Explore the raw research data and strategic analytics generated during our 4-week field
              internship at Sri Gayatri Junior College. Driven by the VoteGuard survey framework, 
              this portal reveals crucial patterns across 460 student participants, bridging the gap 
              between academic goals and modern digital infrastructure.
            </p>
          </div>

          {/* Interactive Video Deck */}
          <div className="csp-video-deck-wrap">
            <div className="csp-hero-video-card">
              <video
                ref={videoRef}
                src="/CSP_PROJECT/Video_CSP.mp4"
                className="csp-video"
                preload="metadata"
                playsInline
                loop
                muted={videoMuted}
                onTimeUpdate={(e) => setVideoTime(e.target.currentTime)}
                onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
              />
            </div>
            
            {/* Custom Control Deck */}
            <div className="csp-video-control-deck">
              <div className="csp-video-scrub-row">
                <input
                  type="range"
                  min="0"
                  max={videoDuration || 100}
                  step="0.1"
                  value={videoTime}
                  className="csp-video-scrubber"
                  onChange={handleScrubChange}
                  style={{ '--slider-percentage': `${(videoTime / (videoDuration || 1)) * 100}%` }}
                />
              </div>
              <div className="csp-video-controls-row">
                <button className="btn-control-play" onClick={handlePlayVideo} title={videoPlaying ? "Pause" : "Play"}>
                  {videoPlaying ? "⏸" : "▶"}
                </button>
                <span className="csp-video-time-label">
                  {formatTime(videoTime)} / {formatTime(videoDuration)}
                </span>
                <button className="btn-control-mute" onClick={toggleMute} title={videoMuted ? "Unmute" : "Mute"}>
                  {videoMuted ? "🔇" : "🔊"}
                </button>
              </div>

              {/* Milestones seeking */}
              <div className="csp-video-milestones">
                <span className="csp-milestones-title">Jump to Time Milestones:</span>
                <div className="csp-milestones-btns">
                  <button className="btn-milestone" onClick={() => seekToMilestone(0)}>0:00 Setup</button>
                  <button className="btn-milestone" onClick={() => seekToMilestone(15)}>0:15 Survey</button>
                  <button className="btn-milestone" onClick={() => seekToMilestone(35)}>0:35 Review</button>
                  <button className="btn-milestone" onClick={() => seekToMilestone(55)}>0:55 Results</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DATA ANALYTICS HUB */}
      <section className="csp-section">
        <div className="csp-section-title">
          <IconChartBar size={24} /> Interactive Data Analytics Hub <span>N = 460 Students</span>
        </div>

        {/* HIGH-LEVEL KPI CARDS WITH COUNT-UP */}
        <div className="csp-kpi-grid">
          <div className="csp-kpi-card juniors">
            <span className="csp-kpi-label">Junior Cohort</span>
            <div className="csp-kpi-value">
              <AnimatedCounter value={180} />
            </div>
            <span className="csp-kpi-sub">First-Year Students</span>
          </div>
          <div className="csp-kpi-card seniors">
            <span className="csp-kpi-label">Senior Cohort</span>
            <div className="csp-kpi-value">
              <AnimatedCounter value={280} />
            </div>
            <span className="csp-kpi-sub">Second-Year Students</span>
          </div>
          <div className="csp-kpi-card sections">
            <span className="csp-kpi-label">Monitored Sections</span>
            <div className="csp-kpi-value">
              <AnimatedCounter value={16} />
            </div>
            <span className="csp-kpi-sub">8 Junior + 8 Senior Classes</span>
          </div>
          <div className="csp-kpi-card satisfaction">
            <span className="csp-kpi-label">Overall Completion</span>
            <div className="csp-kpi-value">
              <AnimatedCounter value={100} suffix="%" />
            </div>
            <span className="csp-kpi-sub">Tally & Survey Success</span>
          </div>
        </div>

        {/* SECTION SWITCHER */}
        <div className="csp-tabs-bar">
          <button
            className={`csp-tab-btn ${activeTab === 'A' ? 'active' : ''}`}
            onClick={() => setActiveTab('A')}
          >
            Section A: Student Focus & Learning
          </button>
          <button
            className={`csp-tab-btn ${activeTab === 'B' ? 'active' : ''}`}
            onClick={() => setActiveTab('B')}
          >
            Section B: College Support & Sections
          </button>
          <button
            className={`csp-tab-btn ${activeTab === 'C' ? 'active' : ''}`}
            onClick={() => setActiveTab('C')}
          >
            Section C: Personal Focus & Simulator
          </button>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'A' && (
          <div className="csp-tab-content-panel csp-analytics-grid">
            {/* Learning Preferences */}
            <div className="csp-card">
              <h3 className="csp-card-title">Preferred Learning Formats Tally</h3>
              <div className="chart-bar-list">
                {learningPreferences.map((pref, i) => (
                  <div className="chart-bar-item" key={i}>
                    <div className="chart-bar-info">
                      <span className="chart-bar-label">{pref.label}</span>
                      <span className="chart-bar-value">{pref.val}%</span>
                    </div>
                    <div className="chart-bar-outer">
                      <div 
                        className="chart-bar-inner" 
                        style={{ '--target-percentage': `${pref.val}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mindset Comparison */}
            <div className="csp-card">
              <h3 className="csp-card-title">Mindset Comparison: First Year vs Second Year</h3>
              <div className="csp-compare-table">
                <div className="csp-compare-row">
                  <div className="csp-compare-col">
                    <span className="csp-compare-lbl">First-Year Mindset</span>
                    <span className="csp-compare-val">
                      <strong>Exploration Mode:</strong> High uncertainty; actively searching for pathways.
                    </span>
                  </div>
                  <div className="csp-compare-col">
                    <span className="csp-compare-lbl">Second-Year Mindset</span>
                    <span className="csp-compare-val">
                      <strong>Execution Mode:</strong> Urgency to perform; focus on admissions & competitive exams.
                    </span>
                  </div>
                </div>
                <div className="csp-compare-row">
                  <div className="csp-compare-col">
                    <span className="csp-compare-lbl">Key Challenge</span>
                    <span className="csp-compare-val">Career ambiguity and academic stream alignment.</span>
                  </div>
                  <div className="csp-compare-col">
                    <span className="csp-compare-lbl">Key Challenge</span>
                    <span className="csp-compare-val">Exam pressure, time management, and acute stress.</span>
                  </div>
                </div>
                <div className="csp-compare-row">
                  <div className="csp-compare-col">
                    <span className="csp-compare-lbl">Learning Shift</span>
                    <span className="csp-compare-val">Highly receptive to self-study & digital video platforms.</span>
                  </div>
                  <div className="csp-compare-col">
                    <span className="csp-compare-lbl">Learning Shift</span>
                    <span className="csp-compare-val">Dependent on structured coaching & strategic exam tools.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'B' && (
          <div className="csp-tab-content-panel csp-analytics-grid">
            {/* College Support Quality */}
            <div className="csp-card">
              <h3 className="csp-card-title">College Services Appreciation Rate</h3>
              <div className="chart-bar-list">
                {collegeServices.map((service, i) => (
                  <div className="chart-bar-item" key={i}>
                    <div className="chart-bar-info">
                      <span className="chart-bar-label">{service.label}</span>
                      <span className="chart-bar-value">{service.val}%</span>
                    </div>
                    <div className="chart-bar-outer">
                      <div 
                        className="chart-bar-inner" 
                        style={{ '--target-percentage': `${service.val}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Top Infrastructure Upgrade Requests:</h4>
                <div className="infra-request-grid">
                  <div className="infra-request-item">
                    <div className="infra-request-icon"><IconSchool size={16} /></div>
                    <span className="infra-request-name">Smart Classrooms</span>
                  </div>
                  <div className="infra-request-item">
                    <div className="infra-request-icon"><IconBook size={16} /></div>
                    <span className="infra-request-name">Practical Resources</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section Count Details */}
            <div className="csp-card">
              <h3 className="csp-card-title">Monitored Classroom Layouts</h3>
              
              <div style={{ marginBottom: '12px' }}>
                <span className="csp-kpi-label" style={{ display: 'block', marginBottom: '8px' }}>First-Year Sections (Avg: 22.5 students | Total: 180)</span>
                <div className="section-dot-grid">
                  {juniorSections.map((sec, i) => (
                    <div className="section-dot-card junior" key={i} title={`${sec.name} - ${sec.track} Track`}>
                      <span className="section-dot-label">{sec.name.replace('Jr. ', '')}</span>
                      <span className="section-dot-count">{sec.count}</span>
                      <span className="section-dot-indicator"></span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <span className="csp-kpi-label" style={{ display: 'block', marginBottom: '8px' }}>Second-Year Sections (Avg: 35 students | Total: 280)</span>
                <div className="section-dot-grid">
                  {seniorSections.map((sec, i) => (
                    <div className="section-dot-card senior" key={i} title={`${sec.name} - ${sec.track} Track`}>
                      <span className="section-dot-label">{sec.name.replace('Sr. ', '')}</span>
                      <span className="section-dot-count">{sec.count}</span>
                      <span className="section-dot-indicator"></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'C' && (
          <div className="csp-tab-content-panel">
            <div className="csp-analytics-grid">
              {/* Influencers */}
              <div className="csp-card">
                <h3 className="csp-card-title">Primary Career Decisions Influencer</h3>
                <div className="chart-bar-list">
                  {careerInfluencers.map((inf, i) => (
                    <div className="chart-bar-item" key={i}>
                      <div className="chart-bar-info">
                        <span className="chart-bar-label">{inf.label}</span>
                        <span className="chart-bar-value">{inf.val}%</span>
                      </div>
                      <div className="chart-bar-outer">
                        <div 
                          className="chart-bar-inner" 
                          style={{ '--target-percentage': `${inf.val}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Engineering Streams Preferred */}
              <div className="csp-card">
                <h3 className="csp-card-title">MPC Student Engineering Stream Preference</h3>
                <div className="chart-bar-list">
                  {streamPreferences.map((str, i) => (
                    <div className="chart-bar-item" key={i}>
                      <div className="chart-bar-info">
                        <span className="chart-bar-label">{str.label}</span>
                        <span className="chart-bar-value">{str.val}%</span>
                      </div>
                      <div className="chart-bar-outer">
                        <div 
                          className="chart-bar-inner" 
                          style={{ '--target-percentage': `${str.val}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Major Concerns */}
              <div className="csp-card">
                <h3 className="csp-card-title">Biggest Academic Concerns</h3>
                <div className="chart-bar-list">
                  {concernsList.map((con, i) => (
                    <div className="chart-bar-item" key={i}>
                      <div className="chart-bar-info">
                        <span className="chart-bar-label">{con.label}</span>
                        <span className="chart-bar-value">{con.val}%</span>
                      </div>
                      <div className="chart-bar-outer">
                        <div 
                          className="chart-bar-inner" 
                          style={{ '--target-percentage': `${con.val}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Insight */}
              <div className="csp-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h3 className="csp-card-title">Key Survey Insight</h3>
                <blockquote style={{
                  borderLeft: '4px solid var(--gold)',
                  paddingLeft: '16px',
                  fontStyle: 'italic',
                  color: 'var(--text2)',
                  fontSize: '14.5px',
                  lineHeight: '1.6'
                }}>
                  "Students are highly concerned about their future careers but lack structured career guidance. 
                  They prefer self-learning, practical experiences, and career-oriented support rather than traditional 
                  classroom teaching. Programs hosted on VoteGuard bridge this gap by enabling data-driven 
                  institutional insights."
                </blockquote>
              </div>
            </div>

            {/* ACTION PLANNER SIMULATOR */}
            <div className="csp-card" style={{ marginTop: '28px' }}>
              <h3 className="csp-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconAdjustments size={20} /> Institutional Action Planner Simulator
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text2)', marginBottom: '24px' }}>
                Simulate how allocating budget/resource points across key survey pain points affects key institutional performance metrics.
              </p>

              <div className="csp-simulator-container">
                <div className="csp-sim-sliders">
                  {/* Slider 1 */}
                  <div className="csp-slider-group">
                    <div className="csp-slider-header">
                      <span className="csp-slider-lbl">Flipped Classroom Model</span>
                      <span className="csp-slider-val">{allocations.flippedClassrooms}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={allocations.flippedClassrooms}
                      className="csp-range-input"
                      style={{ '--slider-percentage': `${allocations.flippedClassrooms}%` }}
                      onChange={(e) => handleSliderChange('flippedClassrooms', e.target.value)}
                    />
                  </div>

                  {/* Slider 2 */}
                  <div className="csp-slider-group">
                    <div className="csp-slider-header">
                      <span className="csp-slider-lbl">Infrastructure & Smart Classrooms</span>
                      <span className="csp-slider-val">{allocations.infrastructure}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={allocations.infrastructure}
                      className="csp-range-input"
                      style={{ '--slider-percentage': `${allocations.infrastructure}%` }}
                      onChange={(e) => handleSliderChange('infrastructure', e.target.value)}
                    />
                  </div>

                  {/* Slider 3 */}
                  <div className="csp-slider-group">
                    <div className="csp-slider-header">
                      <span className="csp-slider-lbl">Career Seminars & Counselling</span>
                      <span className="csp-slider-val">{allocations.careerSeminars}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={allocations.careerSeminars}
                      className="csp-range-input"
                      style={{ '--slider-percentage': `${allocations.careerSeminars}%` }}
                      onChange={(e) => handleSliderChange('careerSeminars', e.target.value)}
                    />
                  </div>

                  {/* Slider 4 */}
                  <div className="csp-slider-group">
                    <div className="csp-slider-header">
                      <span className="csp-slider-lbl">Competitive Exam Coaching</span>
                      <span className="csp-slider-val">{allocations.examCoaching}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={allocations.examCoaching}
                      className="csp-range-input"
                      style={{ '--slider-percentage': `${allocations.examCoaching}%` }}
                      onChange={(e) => handleSliderChange('examCoaching', e.target.value)}
                    />
                  </div>
                </div>

                {/* Micro-Interaction Interdependence balanced-glow */}
                <div className={`csp-sim-metrics-box ${isBalanced ? 'balanced-glow' : ''}`}>
                  <div className="csp-sim-metrics-title">
                    <span>Live Output Impact Metrics</span>
                    <span className="csp-sim-budget-indicator">
                      {isBalanced ? (
                        <span style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <IconCheck size={14} /> Allocation Balanced
                        </span>
                      ) : (
                        `Unallocated Points: ${TOTAL_BUDGET - currentTotal} / ${TOTAL_BUDGET}`
                      )}
                    </span>
                  </div>

                  {/* Metric 1 */}
                  <div className="csp-sim-metric-item">
                    <div className="csp-sim-metric-info">
                      <span className="csp-sim-metric-lbl">Live Student Satisfaction</span>
                      <span className="csp-sim-metric-val" style={{ color: 'var(--teal)' }}>
                        {studentSatisfaction.toFixed(0)}%
                      </span>
                    </div>
                    <div className="csp-sim-metric-bar-outer">
                      <div
                        className="csp-sim-metric-bar-inner"
                        style={{ width: `${studentSatisfaction}%`, backgroundColor: 'var(--teal)' }}
                      ></div>
                    </div>
                  </div>

                  {/* Metric 2 */}
                  <div className="csp-sim-metric-item">
                    <div className="csp-sim-metric-info">
                      <span className="csp-sim-metric-lbl">Live Exam Preparedness</span>
                      <span className="csp-sim-metric-val" style={{ color: 'var(--violet)' }}>
                        {examPreparedness.toFixed(0)}%
                      </span>
                    </div>
                    <div className="csp-sim-metric-bar-outer">
                      <div
                        className="csp-sim-metric-bar-inner"
                        style={{ width: `${examPreparedness}%`, backgroundColor: 'var(--violet)' }}
                      ></div>
                    </div>
                  </div>

                  {/* Metric 3 */}
                  <div className="csp-sim-metric-item">
                    <div className="csp-sim-metric-info">
                      <span className="csp-sim-metric-lbl">Live Digital Readiness</span>
                      <span className="csp-sim-metric-val" style={{ color: 'var(--gold)' }}>
                        {digitalReadiness.toFixed(0)}%
                      </span>
                    </div>
                    <div className="csp-sim-metric-bar-outer">
                      <div
                        className="csp-sim-metric-bar-inner"
                        style={{ width: `${digitalReadiness}%`, backgroundColor: 'var(--gold)' }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* PROJECT GALLERY & FIELDWORK SHOWCASE */}
      <section className="csp-section">
        <div className="csp-section-title">
          <IconPhoto size={24} /> Fieldwork Showcase & Project Milestones
        </div>

        <div className="csp-gallery-grid">
          {galleryItems.map((item, i) => (
            <div
              className={`csp-gallery-card ${item.isCertificate ? 'certificate' : ''}`}
              key={i}
              onClick={() => setSelectedImage(item)}
            >
              <div className="csp-gallery-img-wrapper">
                <img src={item.img} alt={item.title} className="csp-gallery-img" />
              </div>
              <div className="csp-gallery-info">
                <div className="csp-gallery-title">{item.title}</div>
                <div className="csp-gallery-desc">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DOCUMENT REPOSITORY */}
      <section className="csp-section">
        <div className="csp-section-title">
          <IconFileText size={24} /> Document Repository & Report Viewer
        </div>

        <div className="csp-doc-card">
          <div className="csp-doc-info">
            <span className="csp-doc-badge">Official Submission Report</span>
            <h3 className="csp-doc-title">VoteGuard CSP Report 2026</h3>
            <p className="csp-doc-summary">
              Access the formal, comprehensive Community Service Project report. This document details
              the operational workflows, raw questionnaire tallies, full administrative security audits, 
              and institutional roadmap submitted to Sri Gayatri Junior College management.
            </p>

            <div className="csp-doc-meta">
              <div className="csp-doc-meta-item">
                <span>File Name:</span>
                <span style={{ color: 'var(--text)' }}>VoteGuard_CSP_Report_2026_Group_1.pdf</span>
              </div>
              <div className="csp-doc-meta-item">
                <span>Size:</span>
                <span style={{ color: 'var(--text)' }}>2.88 MB</span>
              </div>
              <div className="csp-doc-meta-item">
                <span>Verification:</span>
                <span style={{ color: 'var(--green)' }}>Verified PDF</span>
              </div>
            </div>

            <div className="csp-doc-actions">
              <a
                href="/CSP_PROJECT/VoteGuard_CSP_Report_2026_Group_1.pdf"
                download="VoteGuard_CSP_Report_2026_Group_1.pdf"
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
              >
                <IconDownload size={16} /> Download Report PDF
              </a>
            </div>
          </div>

          <div className="csp-pdf-viewer-wrap">
            <iframe
              src="/CSP_PROJECT/VoteGuard_CSP_Report_2026_Group_1.pdf"
              title="VoteGuard CSP Report View"
              className="pdf-frame-style"
            >
              <div className="csp-pdf-fallback">
                <IconFileText size={48} style={{ color: 'var(--gold)' }} />
                <h3>PDF Direct Embed Not Supported</h3>
                <p>Your browser or device does not support embedded PDF files.</p>
                <a
                  href="/CSP_PROJECT/VoteGuard_CSP_Report_2026_Group_1.pdf"
                  download="VoteGuard_CSP_Report_2026_Group_1.pdf"
                  className="btn-primary"
                >
                  Download PDF Report
                </a>
              </div>
            </iframe>
          </div>
        </div>
      </section>

      {/* LIGHTBOX MODAL */}
      {selectedImage && (
        <div className="csp-lightbox" onClick={() => setSelectedImage(null)}>
          <div className="csp-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="csp-lightbox-close" onClick={() => setSelectedImage(null)}>
              ✕
            </button>
            <div className="csp-lightbox-img-wrapper">
              <img src={selectedImage.img} alt={selectedImage.title} className="csp-lightbox-img" />
            </div>
            <div className="csp-lightbox-details">
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{selectedImage.title}</h4>
              <p style={{ fontSize: '13px', color: 'var(--text2)' }}>{selectedImage.desc}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
