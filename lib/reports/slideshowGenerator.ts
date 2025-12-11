import { format } from 'date-fns';
import type { ReportContent } from './aiReportGenerator';
import type { WeeklyReportData, MonthlyReportData, ForecastReportData } from './dataAggregator';

interface SlideshowConfig {
  projectName: string;
  reportType: 'weekly' | 'monthly' | 'forecast';
  dateRange: string;
  content: ReportContent;
  data: WeeklyReportData | MonthlyReportData | ForecastReportData;
  projectMembers: Array<{ id: string; name: string | null }>;
}

/**
 * Generate HTML slideshow
 */
export function generateSlideshowHTML(config: SlideshowConfig): string {
  const reportTypeLabel = config.reportType.charAt(0).toUpperCase() + config.reportType.slice(1);
  
  const slides: string[] = [];

  // Slide 1: Title
  slides.push(`
    <div class="slide active">
      <div class="slide-content">
        <h1 class="slide-title">${escapeHtml(config.projectName)}</h1>
        <h2 class="slide-subtitle">${reportTypeLabel} Report</h2>
        <p class="slide-date">${config.dateRange}</p>
        <p class="slide-generated">Generated: ${format(new Date(), 'MMM d, yyyy')}</p>
      </div>
    </div>
  `);

  // Slide 2: Executive Summary
  slides.push(`
    <div class="slide">
      <div class="slide-content">
        <h2 class="slide-heading">Executive Summary</h2>
        <p class="slide-text">${escapeHtml(config.content.executiveSummary)}</p>
      </div>
    </div>
  `);

  // Slide 3: Key Insights
  slides.push(`
    <div class="slide">
      <div class="slide-content">
        <h2 class="slide-heading">Key Insights</h2>
        <ul class="slide-list">
          ${config.content.keyInsights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `);

  // Slide 4: Metrics
  if ('metrics' in config.data) {
    const metrics = config.data.metrics;
    slides.push(`
      <div class="slide">
        <div class="slide-content">
          <h2 class="slide-heading">Metrics Overview</h2>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-value">${metrics.total}</div>
              <div class="metric-label">Total Tasks</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${metrics.completed}</div>
              <div class="metric-label">Completed</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${metrics.inProgress}</div>
              <div class="metric-label">In Progress</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${metrics.todo}</div>
              <div class="metric-label">Todo</div>
            </div>
            ${metrics.overdue > 0 ? `
            <div class="metric-card metric-warning">
              <div class="metric-value">${metrics.overdue}</div>
              <div class="metric-label">Overdue</div>
            </div>
            ` : ''}
            ${metrics.upcomingDeadlines > 0 ? `
            <div class="metric-card">
              <div class="metric-value">${metrics.upcomingDeadlines}</div>
              <div class="metric-label">Upcoming (7d)</div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `);
  }

  // Slide 5: Risks (if any)
  if (config.content.risks.length > 0) {
    slides.push(`
      <div class="slide">
        <div class="slide-content">
          <h2 class="slide-heading slide-heading-warning">Risks & Concerns</h2>
          <ul class="slide-list">
            ${config.content.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `);
  }

  // Slide 6: Recommendations
  slides.push(`
    <div class="slide">
      <div class="slide-content">
        <h2 class="slide-heading">Recommendations</h2>
        <ul class="slide-list">
          ${config.content.recommendations.map((rec) => `<li>${escapeHtml(rec)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `);

  // Slide 7: Team Workload
  if (config.content.teamWorkload) {
    slides.push(`
      <div class="slide">
        <div class="slide-content">
          <h2 class="slide-heading">Team Workload Analysis</h2>
          <p class="slide-text">${escapeHtml(config.content.teamWorkload)}</p>
        </div>
      </div>
    `);
  }

  // Combine all slides with HTML structure
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTypeLabel} Report - ${escapeHtml(config.projectName)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      background: #000;
      color: #E0E0E0;
      overflow: hidden;
      height: 100vh;
    }

    .slideshow-container {
      position: relative;
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }

    .slide {
      display: none;
      width: 100%;
      height: 100vh;
      padding: 60px;
      animation: fadeIn 0.5s ease-in;
    }

    .slide.active {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .slide-content {
      max-width: 1200px;
      width: 100%;
    }

    .slide-title {
      font-size: 4rem;
      font-weight: 700;
      background: #C9354A;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
      text-align: center;
    }

    .slide-subtitle {
      font-size: 2.5rem;
      color: #C9354A;
      margin-bottom: 1rem;
      text-align: center;
      font-weight: 600;
    }

    .slide-date {
      font-size: 1.5rem;
      color: #B0B0B0;
      text-align: center;
      margin-bottom: 0.5rem;
    }

    .slide-generated {
      font-size: 1rem;
      color: #808080;
      text-align: center;
    }

    .slide-heading {
      font-size: 3rem;
      color: #C9354A;
      margin-bottom: 2rem;
      font-weight: 600;
    }

    .slide-heading-warning {
      color: #E91E63;
    }

    .slide-text {
      font-size: 1.5rem;
      line-height: 1.8;
      color: #E0E0E0;
    }

    .slide-list {
      list-style: none;
      font-size: 1.5rem;
      line-height: 2.5;
    }

    .slide-list li {
      padding-left: 2rem;
      position: relative;
      margin-bottom: 1rem;
    }

    .slide-list li:before {
      content: '•';
      position: absolute;
      left: 0;
      color: #C9354A;
      font-size: 2rem;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2rem;
      margin-top: 2rem;
    }

    .metric-card {
      background: rgba(0, 229, 255, 0.1);
      border: 1px solid rgba(0, 229, 255, 0.3);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
    }

    .metric-card.metric-warning {
      background: rgba(233, 30, 99, 0.1);
      border-color: rgba(233, 30, 99, 0.3);
    }

    .metric-value {
      font-size: 3rem;
      font-weight: 700;
      color: #C9354A;
      margin-bottom: 0.5rem;
    }

    .metric-card.metric-warning .metric-value {
      color: #E91E63;
    }

    .metric-label {
      font-size: 1rem;
      color: #B0B0B0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .navigation {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 1rem;
      z-index: 1000;
    }

    .nav-button {
      background: rgba(0, 229, 255, 0.2);
      border: 1px solid rgba(0, 229, 255, 0.5);
      color: #C9354A;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.3s;
    }

    .nav-button:hover {
      background: rgba(0, 229, 255, 0.3);
      transform: translateY(-2px);
    }

    .nav-button:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .slide-indicators {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 0.5rem;
      z-index: 1000;
    }

    .indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: rgba(0, 229, 255, 0.3);
      cursor: pointer;
      transition: all 0.3s;
    }

    .indicator.active {
      background: #C9354A;
      transform: scale(1.2);
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @media (max-width: 768px) {
      .slide {
        padding: 40px 20px;
      }

      .slide-title {
        font-size: 2.5rem;
      }

      .slide-subtitle {
        font-size: 1.8rem;
      }

      .slide-heading {
        font-size: 2rem;
      }

      .slide-text,
      .slide-list {
        font-size: 1.2rem;
      }

      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="slideshow-container">
    ${slides.join('')}
  </div>

  <div class="slide-indicators">
    ${slides.map((_, index) => `<div class="indicator ${index === 0 ? 'active' : ''}" data-slide="${index}"></div>`).join('')}
  </div>

  <div class="navigation">
    <button class="nav-button" id="prevBtn" onclick="previousSlide()">Previous</button>
    <button class="nav-button" id="nextBtn" onclick="nextSlide()">Next</button>
  </div>

  <script>
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    const indicators = document.querySelectorAll('.indicator');
    const totalSlides = slides.length;

    function showSlide(n) {
      if (n >= totalSlides) {
        currentSlide = 0;
      } else if (n < 0) {
        currentSlide = totalSlides - 1;
      } else {
        currentSlide = n;
      }

      slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === currentSlide);
      });

      indicators.forEach((indicator, index) => {
        indicator.classList.toggle('active', index === currentSlide);
      });

      document.getElementById('prevBtn').disabled = currentSlide === 0;
      document.getElementById('nextBtn').disabled = currentSlide === totalSlides - 1;
    }

    function nextSlide() {
      showSlide(currentSlide + 1);
    }

    function previousSlide() {
      showSlide(currentSlide - 1);
    }

    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => showSlide(index));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        previousSlide();
      }
    });

    // Initialize
    showSlide(0);
  </script>
</body>
</html>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

