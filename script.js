// =====================================================
// script.js — SSPOE Physics PWA Engine
// =====================================================
// Handles: routing, language, SSPOE cycle, PWA install
// Supports: multiple prediction questions, comprehension quiz with scoring
// =====================================================

(function () {
  'use strict';

  // ── State ──
  const state = {
    lang: localStorage.getItem('sspoe-lang') || 'fr',
    theme: localStorage.getItem('sspoe-theme') || 'dark',
    currentView: 'home',       // home | courses | player
    currentLevel: null,        // level object
    currentCourse: null,       // course object
    currentActivity: null,     // activity object
    sspoeStep: 0,              // 0=prediction, 1=observation, 2=explanation, 3=quiz
    selectedAnswer: null,      // user's current prediction answer
    predictionIndex: 0,        // current prediction question index
    predictionAnswers: [],     // answers for all prediction questions
    quizAnswers: {},           // user's quiz answers { questionIndex: answerId }
    quizSubmitted: false,      // whether quiz has been submitted
    quizScore: 0,              // quiz score
    simFullscreen: false
  };

  // ── DOM refs ──
  const $app = document.getElementById('app');
  const $navTitle = document.getElementById('nav-title');
  const $btnBack = document.getElementById('btn-back');
  const $btnTheme = document.getElementById('btn-theme');
  const $btnLang = document.getElementById('btn-lang');
  const $langLabel = document.getElementById('lang-label');
  const $installBanner = document.getElementById('install-banner');
  const $btnInstall = document.getElementById('btn-install');
  const $installText = document.getElementById('install-text');

  // ── Helpers ──
  function t(obj) {
    if (!obj) return '';
    return obj[state.lang] || obj.fr || '';
  }

  function tReplace(obj, replacements) {
    let text = t(obj);
    for (const [key, value] of Object.entries(replacements)) {
      text = text.replace(`{${key}}`, value);
    }
    return text;
  }

  function setLang(lang) {
    state.lang = lang;
    localStorage.setItem('sspoe-lang', lang);
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'fr';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $langLabel.textContent = t(APP_DATA.ui.language);
    $installText.textContent = t(APP_DATA.ui.installApp);
    render();
  }

  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem('sspoe-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    // Toggle icons
    const $sun = $btnTheme.querySelector('.theme-sun');
    const $moon = $btnTheme.querySelector('.theme-moon');
    if (theme === 'light') {
      $sun.style.display = 'block';
      $moon.style.display = 'none';
    } else {
      $sun.style.display = 'none';
      $moon.style.display = 'block';
    }
  }

  function showBackBtn(visible) {
    $btnBack.style.visibility = visible ? 'visible' : 'hidden';
  }

  // Simple markdown-like bold parser for explanation text
  function formatText(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[img:(.*?)\]/g, '<img src="$1" class="responsive-img" loading="lazy">')
      .replace(/\n/g, '<br>');
  }

  // Get predictions array (backward compatible with old single prediction format)
  function getPredictions(activity) {
    if (activity.predictions && Array.isArray(activity.predictions)) {
      return activity.predictions;
    }
    if (activity.prediction) {
      return [activity.prediction];
    }
    return [];
  }

  // Check if activity has a quiz
  function hasQuiz(activity) {
    return activity.quiz && activity.quiz.questions && activity.quiz.questions.length > 0;
  }

  // Render an image block (returns HTML string)
  // Handles single image {src, caption} or array of images
  function renderImageBlock(imageData) {
    if (!imageData) return '';

    // Single image
    if (imageData.src) {
      const caption = imageData.caption ? t(imageData.caption) : '';
      return `
                <figure class="course-image">
                    <img src="${imageData.src}" alt="${caption}" 
                         loading="lazy" 
                         onerror="this.parentElement.style.display='none'">
                    ${caption ? `<figcaption>${caption}</figcaption>` : ''}
                </figure>
            `;
    }

    // Array of images
    if (Array.isArray(imageData)) {
      return `<div class="course-images-gallery">
                ${imageData.map(img => {
        const cap = img.caption ? t(img.caption) : '';
        return `
                        <figure class="course-image">
                            <img src="${img.src}" alt="${cap}" 
                                 loading="lazy" 
                                 onerror="this.parentElement.style.display='none'">
                            ${cap ? `<figcaption>${cap}</figcaption>` : ''}
                        </figure>
                    `;
      }).join('')}
            </div>`;
    }

    return '';
  }

  // ── Render Router ──
  function render() {
    switch (state.currentView) {
      case 'home':
        renderHome();
        break;
      case 'courses':
        renderCourses();
        break;
      case 'player':
        renderPlayer();
        break;
    }
  }

  // ── HOME SCREEN ──
  function renderHome() {
    showBackBtn(false);
    $navTitle.textContent = t(APP_DATA.app.title);

    const levelsHTML = APP_DATA.levels.map((level) => {
      const otherLang = state.lang === 'fr' ? 'ar' : 'fr';
      return `
        <div class="level-card" data-level="${level.id}" style="--level-color: ${level.color}">
          <div class="level-icon">${level.icon}</div>
          <div class="level-info">
            <div class="level-name">${t(level.name)}</div>
            <div class="level-name-ar">${level.name[otherLang]}</div>
          </div>
          <svg class="level-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="${state.lang === 'ar' ? '15 18 9 12 15 6' : '9 6 15 12 9 18'}"></polyline>
          </svg>
        </div>
      `;
    }).join('');

    const otherLang = state.lang === 'fr' ? 'ar' : 'fr';

    $app.innerHTML = `
      <div class="home-screen">
        <div class="home-hero">
          <div class="home-icon">
            <img src="icons/icon-192.svg" alt="App Icon" class="home-img-svg">
            <img src="icons/logo.ico" alt="App Logo" class="home-img-ico">
          </div>
          <h2 class="home-title">${t(APP_DATA.app.title)}</h2>
          <p class="home-subtitle">${t(APP_DATA.app.subtitle)}</p>
          <span class="home-ar-subtitle">${APP_DATA.app.subtitle[otherLang]}</span>
        </div>
        <p class="home-welcome">${t(APP_DATA.app.welcome)}</p>
        <div class="levels-grid">
          ${levelsHTML}
        </div>
      </div>
    `;

    // Bind level clicks
    $app.querySelectorAll('.level-card').forEach((card) => {
      card.addEventListener('click', () => {
        const levelId = card.dataset.level;
        state.currentLevel = APP_DATA.levels.find((l) => l.id === levelId);
        state.currentView = 'courses';
        render();
      });
    });
  }

  // ── COURSES LIST ──
  function renderCourses() {
    const level = state.currentLevel;
    showBackBtn(true);
    $navTitle.textContent = t(level.shortName) + ' — ' + t(APP_DATA.ui.courses);

    if (!level.courses || level.courses.length === 0) {
      $app.innerHTML = `
        <div class="course-list">
          <div class="section-header">
            <h2 class="section-title">${t(level.name)}</h2>
            <p class="section-subtitle">${level.name[state.lang === 'fr' ? 'ar' : 'fr']}</p>
          </div>
          <div class="no-courses">
            <span class="no-courses-icon">📚</span>
            <p>${t(APP_DATA.ui.noCourses)}</p>
          </div>
        </div>
      `;
      return;
    }

    const coursesHTML = level.courses.map((course) => {
      // Build activities list
      const activitiesHTML = course.activities.map((act, idx) => `
        <div class="activity-card" data-course="${course.id}" data-activity="${act.id}">
          <div class="activity-number" style="background: ${level.color}">${idx + 1}</div>
          <span class="activity-name">${t(act.title)}</span>
          <svg class="course-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="${state.lang === 'ar' ? '15 18 9 12 15 6' : '9 6 15 12 9 18'}"></polyline>
          </svg>
        </div>
      `).join('');

      return `
        <div class="course-card-wrapper">
          <div class="course-card" style="pointer-events: none;">
            <div class="course-icon">${course.icon}</div>
            <div class="course-info">
              <div class="course-title">${t(course.title)}</div>
              <div class="course-desc">${t(course.description)}</div>
            </div>
          </div>
          <div class="activities-section">
            ${activitiesHTML}
          </div>
        </div>
      `;
    }).join('');

    $app.innerHTML = `
      <div class="course-list">
        <div class="section-header">
          <h2 class="section-title">${t(level.name)}</h2>
          <p class="section-subtitle">${level.name[state.lang === 'fr' ? 'ar' : 'fr']}</p>
        </div>
        <div class="courses-grid">
          ${coursesHTML}
        </div>
      </div>
    `;

    // Bind activity clicks
    $app.querySelectorAll('.activity-card').forEach((card) => {
      card.addEventListener('click', () => {
        const courseId = card.dataset.course;
        const activityId = card.dataset.activity;
        const course = level.courses.find((c) => c.id === courseId);
        const activity = course.activities.find((a) => a.id === activityId);

        state.currentCourse = course;
        state.currentActivity = activity;
        state.sspoeStep = 0;
        state.selectedAnswer = null;
        state.predictionIndex = 0;
        state.predictionAnswers = [];
        state.quizAnswers = {};
        state.quizSubmitted = false;
        state.quizScore = 0;
        state.currentView = 'player';
        render();
      });
    });
  }

  // ── SSPOE PLAYER ──
  function renderPlayer() {
    const activity = state.currentActivity;
    showBackBtn(true);
    $navTitle.textContent = t(activity.title);

    const showQuiz = hasQuiz(activity);

    const steps = [
      { label: t(APP_DATA.ui.stepPrediction), icon: '🤔' },
      { label: t(APP_DATA.ui.stepObservation), icon: '🔍' },
      { label: t(APP_DATA.ui.stepExplanation), icon: '💡' }
    ];

    if (showQuiz) {
      steps.push({ label: t(APP_DATA.ui.stepQuiz), icon: '📝' });
    }

    const progressHTML = steps.map((step, idx) => {
      let dotClass = '';
      if (idx < state.sspoeStep) dotClass = 'completed';
      else if (idx === state.sspoeStep) dotClass = 'active';

      const lineHTML = idx < steps.length - 1
        ? `<div class="step-line ${idx < state.sspoeStep ? 'completed' : ''}"></div>`
        : '';

      return `
        <div class="step-indicator">
          <div class="step-dot ${dotClass}">
            <div class="step-circle">${step.icon}</div>
            <span class="step-label">${step.label}</span>
          </div>
          ${lineHTML}
        </div>
      `;
    }).join('');

    let stepContentHTML = '';

    // ── STEP 0: PREDICTION ──
    if (state.sspoeStep === 0) {
      stepContentHTML = renderPrediction(activity);
    }
    // ── STEP 1: OBSERVATION ──
    else if (state.sspoeStep === 1) {
      stepContentHTML = renderObservation(activity);
    }
    // ── STEP 2: EXPLANATION ──
    else if (state.sspoeStep === 2) {
      stepContentHTML = renderExplanation(activity);
    }
    // ── STEP 3: QUIZ ──
    else if (state.sspoeStep === 3) {
      stepContentHTML = renderQuiz(activity);
    }

    $app.innerHTML = `
      <div class="sspoe-player">
        <div class="step-progress">
          ${progressHTML}
        </div>
        ${stepContentHTML}
      </div>
    `;

    // Bind step-specific events
    if (state.sspoeStep === 0) {
      bindPredictionEvents(activity);
    } else if (state.sspoeStep === 1) {
      bindObservationEvents(activity);
    } else if (state.sspoeStep === 2) {
      bindExplanationEvents(activity);
    } else if (state.sspoeStep === 3) {
      bindQuizEvents(activity);
    }
  }

  // ── PREDICTION RENDERING (Multi-question) ──
  function renderPrediction(activity) {
    const predictions = getPredictions(activity);
    const total = predictions.length;
    const current = state.predictionIndex;
    const pred = predictions[current];

    // Pagination indicator
    const paginationHTML = total > 1 ? `
      <div class="question-pagination">
        <span class="question-counter">${tReplace(APP_DATA.ui.questionOf, { current: current + 1, total: total })}</span>
        <div class="question-dots">
          ${predictions.map((_, i) => `
            <span class="question-dot ${i === current ? 'active' : ''} ${state.predictionAnswers[i] !== undefined ? 'answered' : ''}"></span>
          `).join('')}
        </div>
      </div>
    ` : '';

    let answersHTML = '';
    const currentAnswer = state.predictionAnswers[current];

    if (pred.type === 'mcq') {
      answersHTML = `
        <div class="choices-list">
          ${pred.choices.map((c) => `
            <button class="choice-btn ${currentAnswer === c.id ? 'selected' : ''}" data-choice="${c.id}">
              <span class="choice-letter">${c.id.toUpperCase()}</span>
              <span class="choice-text">${t(c.text)}</span>
            </button>
          `).join('')}
        </div>
      `;
    } else if (pred.type === 'open') {
      answersHTML = `
        <textarea class="open-answer" id="open-answer" placeholder="${t(APP_DATA.ui.writeAnswer)}">${currentAnswer || ''}</textarea>
      `;
    } else if (pred.type === 'truefalse') {
      answersHTML = `
        <div class="choices-list">
          <button class="choice-btn ${currentAnswer === 'true' ? 'selected' : ''}" data-choice="true">
            <span class="choice-letter">✓</span>
            <span class="choice-text">${state.lang === 'ar' ? 'صحيح' : 'Vrai'}</span>
          </button>
          <button class="choice-btn ${currentAnswer === 'false' ? 'selected' : ''}" data-choice="false">
            <span class="choice-letter">✗</span>
            <span class="choice-text">${state.lang === 'ar' ? 'خطأ' : 'Faux'}</span>
          </button>
        </div>
      `;
    }

    // Navigation buttons
    const isFirst = current === 0;
    const isLast = current === total - 1;
    const allAnswered = predictions.every((_, i) => state.predictionAnswers[i] !== undefined);

    let navHTML = '<div class="prediction-nav">';

    if (total > 1 && !isFirst) {
      navHTML += `
        <button class="btn-pred-nav btn-pred-prev" id="btn-pred-prev">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="${state.lang === 'ar' ? '9 6 15 12 9 18' : '15 18 9 12 15 6'}"></polyline>
          </svg>
          ${t(APP_DATA.ui.previousQuestion)}
        </button>
      `;
    }

    if (total > 1 && !isLast) {
      navHTML += `
        <button class="btn-pred-nav btn-pred-next" id="btn-pred-next" ${state.predictionAnswers[current] === undefined ? 'disabled' : ''}>
          ${t(APP_DATA.ui.nextQuestion)}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="${state.lang === 'ar' ? '15 18 9 12 15 6' : '9 6 15 12 9 18'}"></polyline>
          </svg>
        </button>
      `;
    }

    navHTML += '</div>';

    // Validate button (only when all answered, show on last question or single question)
    const validateHTML = (isLast || total === 1) ? `
      <button class="btn-validate" id="btn-validate" ${!allAnswered ? 'disabled' : ''}>
        ${total > 1 ? t(APP_DATA.ui.validatePredictions) : t(APP_DATA.ui.validate)}
      </button>
    ` : '';

    return `
      <div class="step-card">
        <div class="step-card-header">
          <span class="step-card-icon">🤔</span>
          <h3 class="step-card-title">${t(APP_DATA.ui.stepPrediction)}</h3>
        </div>
        ${paginationHTML}
        <div class="prediction-question">${t(pred.question)}</div>
        ${renderImageBlock(pred.image)}
        ${answersHTML}
        <p class="select-hint" id="select-hint" ${currentAnswer !== undefined ? 'style="display:none"' : ''}>${t(APP_DATA.ui.selectAnswer)}</p>
        ${navHTML}
        ${validateHTML}
      </div>
    `;
  }

  function bindPredictionEvents(activity) {
    const predictions = getPredictions(activity);
    const current = state.predictionIndex;
    const pred = predictions[current];
    const $btnValidate = document.getElementById('btn-validate');
    const $hint = document.getElementById('select-hint');
    const $btnNext = document.getElementById('btn-pred-next');
    const $btnPrev = document.getElementById('btn-pred-prev');

    if (pred.type === 'mcq' || pred.type === 'truefalse') {
      $app.querySelectorAll('.choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          $app.querySelectorAll('.choice-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          state.predictionAnswers[current] = btn.dataset.choice;
          state.selectedAnswer = state.predictionAnswers[0]; // keep first answer for explanation feedback
          if ($hint) $hint.style.display = 'none';
          if ($btnNext) $btnNext.disabled = false;
          // Check if all answered for validate button
          if ($btnValidate) {
            const allAnswered = predictions.every((_, i) => state.predictionAnswers[i] !== undefined);
            $btnValidate.disabled = !allAnswered;
          }
        });
      });
    } else if (pred.type === 'open') {
      const $textarea = document.getElementById('open-answer');
      $textarea.addEventListener('input', () => {
        const val = $textarea.value.trim();
        state.predictionAnswers[current] = val.length > 0 ? val : undefined;
        state.selectedAnswer = state.predictionAnswers[0];
        if ($hint) $hint.style.display = val.length > 0 ? 'none' : '';
        if ($btnNext) $btnNext.disabled = !val.length;
        if ($btnValidate) {
          const allAnswered = predictions.every((_, i) => state.predictionAnswers[i] !== undefined);
          $btnValidate.disabled = !allAnswered;
        }
      });
    }

    // Navigation between questions
    if ($btnNext) {
      $btnNext.addEventListener('click', () => {
        if (state.predictionAnswers[current] !== undefined) {
          state.predictionIndex++;
          render();
        }
      });
    }

    if ($btnPrev) {
      $btnPrev.addEventListener('click', () => {
        state.predictionIndex--;
        render();
      });
    }

    // Validate all predictions
    if ($btnValidate) {
      $btnValidate.addEventListener('click', () => {
        const allAnswered = predictions.every((_, i) => state.predictionAnswers[i] !== undefined);
        if (allAnswered) {
          // Play a quick satisfying animation on the card before transitioning
          const $card = $app.querySelector('.step-card');
          if ($card) {
            $card.style.animation = 'none';
            $card.offsetHeight; /* trigger reflow */
            $card.style.animation = 'successFlash 0.5s ease';
          }

          setTimeout(() => {
            state.sspoeStep = 1;
            render();
          }, 400); // Wait for flash effect
        }
      });
    }
  }

  // ── OBSERVATION RENDERING ──
  function renderObservation(activity) {
    const sim = activity.simulation;

    return `
      <div class="step-card">
        <div class="step-card-header">
          <span class="step-card-icon">🔍</span>
          <h3 class="step-card-title">${t(APP_DATA.ui.stepObservation)}</h3>
        </div>
        <div class="sim-instructions">${t(sim.instructions)}</div>
        ${renderImageBlock(sim.image)}
        <div class="sim-container" id="sim-container">
          <iframe class="sim-iframe" id="sim-iframe" src="${sim.file}" 
                  sandbox="allow-scripts allow-same-origin" 
                  loading="lazy"
                  title="${t(activity.title)}"></iframe>
        </div>
        <div class="sim-controls">
          <button class="btn-fullscreen" id="btn-fullscreen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
            </svg>
            ${t(APP_DATA.ui.fullscreen)}
          </button>
          <button class="btn-next-step" id="btn-to-explanation">
            ${t(APP_DATA.ui.showExplanation)}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="${state.lang === 'ar' ? '15 18 9 12 15 6' : '9 6 15 12 9 18'}"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function bindObservationEvents(activity) {
    const $simContainer = document.getElementById('sim-container');
    const $btnFS = document.getElementById('btn-fullscreen');
    const $btnExpl = document.getElementById('btn-to-explanation');

    // Fullscreen toggle
    $btnFS.addEventListener('click', () => {
      if (!state.simFullscreen) {
        enterSimFullscreen($simContainer);
      }
    });

    // Go to explanation step
    $btnExpl.addEventListener('click', () => {
      exitSimFullscreen();
      state.sspoeStep = 2;
      render();
    });
  }

  function enterSimFullscreen(container) {
    state.simFullscreen = true;
    container.classList.add('sim-fullscreen');

    // Add exit button inside fullscreen container
    const exitBtn = document.createElement('button');
    exitBtn.className = 'btn-exit-fs';
    exitBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
      ${t(APP_DATA.ui.exitFullscreen)}
    `;
    exitBtn.addEventListener('click', () => {
      exitSimFullscreen();
    });
    container.appendChild(exitBtn);

    // Also try native fullscreen
    if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => { });
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
  }

  function exitSimFullscreen() {
    state.simFullscreen = false;
    const container = document.getElementById('sim-container');
    if (container) {
      container.classList.remove('sim-fullscreen');
      const exitBtn = container.querySelector('.btn-exit-fs');
      if (exitBtn) exitBtn.remove();
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    } else if (document.webkitFullscreenElement) {
      document.webkitExitFullscreen();
    }
  }

  // ── EXPLANATION RENDERING ──
  function renderExplanation(activity) {
    const expl = activity.explanation;
    const predictions = getPredictions(activity);
    const pred = predictions[0]; // Use first prediction for feedback
    const isCorrect = state.predictionAnswers[0] === pred.correctAnswer;

    // Determine what the user answered (text) — first question
    let userAnswerText = state.predictionAnswers[0];
    if (pred.type === 'mcq') {
      const choice = pred.choices.find((c) => c.id === state.predictionAnswers[0]);
      userAnswerText = choice ? t(choice.text) : state.predictionAnswers[0];
    } else if (pred.type === 'truefalse') {
      userAnswerText = state.predictionAnswers[0] === 'true'
        ? (state.lang === 'ar' ? 'صحيح' : 'Vrai')
        : (state.lang === 'ar' ? 'خطأ' : 'Faux');
    }

    // Correct answer text
    let correctAnswerText = '';
    if (pred.type === 'mcq') {
      const correct = pred.choices.find((c) => c.id === pred.correctAnswer);
      correctAnswerText = correct ? t(correct.text) : '';
    } else if (pred.type === 'truefalse') {
      correctAnswerText = pred.correctAnswer === 'true'
        ? (state.lang === 'ar' ? 'صحيح' : 'Vrai')
        : (state.lang === 'ar' ? 'خطأ' : 'Faux');
    }

    const feedbackClass = (pred.type === 'open') ? 'feedback-correct' : (isCorrect ? 'feedback-correct' : 'feedback-incorrect');
    const feedbackText = (pred.type === 'open')
      ? t(expl.feedback.correct)
      : (isCorrect ? t(expl.feedback.correct) : t(expl.feedback.incorrect));

    // Prediction recap — show all prediction results
    let recapHTML = '';
    if (predictions.length > 1) {
      const recapItems = predictions.map((p, i) => {
        const answer = state.predictionAnswers[i];
        const correct = answer === p.correctAnswer;
        let answerText = answer;
        if (p.type === 'mcq') {
          const ch = p.choices.find(c => c.id === answer);
          answerText = ch ? t(ch.text) : answer;
        } else if (p.type === 'truefalse') {
          answerText = answer === 'true'
            ? (state.lang === 'ar' ? 'صحيح' : 'Vrai')
            : (state.lang === 'ar' ? 'خطأ' : 'Faux');
        }
        return `
          <div class="recap-item ${p.type !== 'open' ? (correct ? 'recap-correct' : 'recap-incorrect') : ''}">
            <div class="recap-label">Q${i + 1} ${p.type !== 'open' ? (correct ? '✅' : '❌') : ''}</div>
            <div class="recap-answer">${answerText}</div>
          </div>
        `;
      }).join('');

      const predScore = predictions.filter((p, i) => state.predictionAnswers[i] === p.correctAnswer).length;

      recapHTML = `
        <div class="prediction-recap prediction-recap-multi">
          <div class="recap-score">${t(APP_DATA.ui.yourPrediction)}: ${predScore}/${predictions.length}</div>
          ${recapItems}
        </div>
      `;
    } else {
      // Single question recap (original behavior)
      recapHTML = (pred.type !== 'open') ? `
        <div class="prediction-recap">
          <div class="recap-item">
            <div class="recap-label">${t(APP_DATA.ui.yourPrediction)}</div>
            <div>${userAnswerText}</div>
          </div>
          ${correctAnswerText ? `
          <div class="recap-item">
            <div class="recap-label">${t(APP_DATA.ui.correctAnswer)}</div>
            <div>${correctAnswerText}</div>
          </div>` : ''}
        </div>
      ` : `
        <div class="prediction-recap">
          <div class="recap-item">
            <div class="recap-label">${t(APP_DATA.ui.yourPrediction)}</div>
            <div>${userAnswerText}</div>
          </div>
        </div>
      `;
    }

    // Continue to quiz button (if quiz exists)
    const quizBtnHTML = hasQuiz(activity) ? `
      <button class="btn-next-step btn-to-quiz" id="btn-to-quiz">
        📝 ${t(APP_DATA.ui.continueToQuiz)}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="${state.lang === 'ar' ? '15 18 9 12 15 6' : '9 6 15 12 9 18'}"></polyline>
        </svg>
      </button>
    ` : '';

    return `
      <div class="step-card">
        <div class="step-card-header">
          <span class="step-card-icon">💡</span>
          <h3 class="step-card-title">${t(APP_DATA.ui.stepExplanation)}</h3>
        </div>

        <div class="feedback-card ${feedbackClass}">
          ${feedbackText}
        </div>

        ${recapHTML}

        <div class="explanation-summary">
          ${formatText(t(expl.summary))}
        </div>

        ${renderImageBlock(expl.image)}
        ${renderImageBlock(expl.images)}

        ${quizBtnHTML}

        <button class="btn-back-courses" id="btn-back-courses">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="${state.lang === 'ar' ? '9 6 15 12 9 18' : '15 18 9 12 15 6'}"></polyline>
          </svg>
          ${t(APP_DATA.ui.backToCourses)}
        </button>
      </div>
    `;
  }

  function bindExplanationEvents(activity) {
    document.getElementById('btn-back-courses').addEventListener('click', () => {
      state.currentView = 'courses';
      state.currentActivity = null;
      state.currentCourse = null;
      state.sspoeStep = 0;
      state.selectedAnswer = null;
      state.predictionIndex = 0;
      state.predictionAnswers = [];
      render();
    });

    // Quiz button
    const $btnQuiz = document.getElementById('btn-to-quiz');
    if ($btnQuiz) {
      $btnQuiz.addEventListener('click', () => {
        const $card = $app.querySelector('.step-card');
        if ($card) {
          $card.style.animation = 'none';
          $card.offsetHeight;
          $card.style.animation = 'successFlash 0.5s ease';
        }

        setTimeout(() => {
          state.sspoeStep = 3;
          state.quizAnswers = {};
          state.quizSubmitted = false;
          state.quizScore = 0;
          render();
        }, 300);
      });
    }
  }

  // ── QUIZ RENDERING ──
  function renderQuiz(activity) {
    const quiz = activity.quiz;
    const questions = quiz.questions;
    const submitted = state.quizSubmitted;

    // Score circle if submitted
    let scoreHTML = '';
    if (submitted) {
      const score = state.quizScore;
      const total = questions.length;
      const pct = Math.round((score / total) * 100);
      const circumference = 2 * Math.PI * 54;
      const offset = circumference - (pct / 100) * circumference;

      let feedbackMsg = '';
      let feedbackClass = '';
      if (pct === 100) {
        feedbackMsg = t(APP_DATA.ui.quizPerfect);
        feedbackClass = 'quiz-perfect';
      } else if (pct >= 50) {
        feedbackMsg = t(APP_DATA.ui.quizGood);
        feedbackClass = 'quiz-good';
      } else {
        feedbackMsg = t(APP_DATA.ui.quizRetry);
        feedbackClass = 'quiz-retry';
      }

      scoreHTML = `
        <div class="quiz-score-section ${feedbackClass}">
          <div class="score-circle">
            <svg viewBox="0 0 120 120" class="score-ring">
              <circle cx="60" cy="60" r="54" class="score-ring-bg"/>
              <circle cx="60" cy="60" r="54" class="score-ring-fill" 
                      style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}"/>
            </svg>
            <div class="score-text">
              <span class="score-number">${score}</span>
              <span class="score-divider">/</span>
              <span class="score-total">${total}</span>
            </div>
          </div>
          <div class="score-percentage">${pct}%</div>
          <div class="score-feedback">${feedbackMsg}</div>
        </div>
      `;
    }

    // Questions
    const questionsHTML = questions.map((q, idx) => {
      const userAnswer = state.quizAnswers[idx];
      const isCorrect = submitted && userAnswer === q.correctAnswer;
      const isWrong = submitted && userAnswer !== q.correctAnswer && userAnswer !== undefined;
      const noAnswer = submitted && userAnswer === undefined;

      let choicesHTML = '';
      if (q.type === 'mcq') {
        choicesHTML = `
          <div class="quiz-choices">
            ${q.choices.map(c => {
          let choiceClass = 'quiz-choice';
          if (!submitted && userAnswer === c.id) choiceClass += ' selected';
          if (submitted && c.id === q.correctAnswer) choiceClass += ' correct';
          if (submitted && userAnswer === c.id && c.id !== q.correctAnswer) choiceClass += ' wrong';
          return `
                <button class="${choiceClass}" data-question="${idx}" data-choice="${c.id}" ${submitted ? 'disabled' : ''}>
                  <span class="quiz-choice-letter">${c.id.toUpperCase()}</span>
                  <span class="quiz-choice-text">${t(c.text)}</span>
                  ${submitted && c.id === q.correctAnswer ? '<span class="quiz-check">✓</span>' : ''}
                  ${submitted && userAnswer === c.id && c.id !== q.correctAnswer ? '<span class="quiz-cross">✗</span>' : ''}
                </button>
              `;
        }).join('')}
          </div>
        `;
      } else if (q.type === 'truefalse') {
        const tfChoices = [
          { id: 'true', label: state.lang === 'ar' ? 'صحيح' : 'Vrai', icon: '✓' },
          { id: 'false', label: state.lang === 'ar' ? 'خطأ' : 'Faux', icon: '✗' }
        ];
        choicesHTML = `
          <div class="quiz-choices quiz-tf">
            ${tfChoices.map(c => {
          let choiceClass = 'quiz-choice';
          if (!submitted && userAnswer === c.id) choiceClass += ' selected';
          if (submitted && c.id === q.correctAnswer) choiceClass += ' correct';
          if (submitted && userAnswer === c.id && c.id !== q.correctAnswer) choiceClass += ' wrong';
          return `
                <button class="${choiceClass}" data-question="${idx}" data-choice="${c.id}" ${submitted ? 'disabled' : ''}>
                  <span class="quiz-choice-letter">${c.icon}</span>
                  <span class="quiz-choice-text">${c.label}</span>
                  ${submitted && c.id === q.correctAnswer ? '<span class="quiz-check">✓</span>' : ''}
                  ${submitted && userAnswer === c.id && c.id !== q.correctAnswer ? '<span class="quiz-cross">✗</span>' : ''}
                </button>
              `;
        }).join('')}
          </div>
        `;
      }

      let questionStatus = '';
      if (submitted) {
        if (isCorrect) questionStatus = '<span class="q-status q-correct">✅</span>';
        else if (isWrong) questionStatus = '<span class="q-status q-wrong">❌</span>';
        else if (noAnswer) questionStatus = '<span class="q-status q-missed">⚠️</span>';
      }

      return `
        <div class="quiz-question-card ${submitted ? (isCorrect ? 'quiz-q-correct' : 'quiz-q-wrong') : ''}">
          <div class="quiz-q-header">
            <span class="quiz-q-number">${idx + 1}</span>
            <span class="quiz-q-text">${t(q.question)}</span>
            ${questionStatus}
          </div>
          ${renderImageBlock(q.image)}
          ${choicesHTML}
        </div>
      `;
    }).join('');

    // Action buttons
    const allAnswered = questions.every((_, i) => state.quizAnswers[i] !== undefined);
    let actionsHTML = '';

    if (!submitted) {
      actionsHTML = `
        <button class="btn-validate btn-submit-quiz" id="btn-submit-quiz" ${!allAnswered ? 'disabled' : ''}>
          📊 ${t(APP_DATA.ui.submitQuiz)}
        </button>
      `;
    } else {
      actionsHTML = `
        <div class="quiz-actions">
          <button class="btn-pred-nav btn-retry-quiz" id="btn-retry-quiz">
            🔄 ${t(APP_DATA.ui.retryQuiz)}
          </button>
          <button class="btn-back-courses" id="btn-back-courses">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="${state.lang === 'ar' ? '9 6 15 12 9 18' : '15 18 9 12 15 6'}"></polyline>
            </svg>
            ${t(APP_DATA.ui.backToCourses)}
          </button>
        </div>
      `;
    }

    return `
      <div class="step-card">
        <div class="step-card-header">
          <span class="step-card-icon">📝</span>
          <h3 class="step-card-title">${t(APP_DATA.ui.stepQuiz)}</h3>
        </div>
        ${scoreHTML}
        <div class="quiz-questions">
          ${questionsHTML}
        </div>
        ${actionsHTML}
      </div>
    `;
  }

  function bindQuizEvents(activity) {
    const quiz = activity.quiz;
    const questions = quiz.questions;

    if (!state.quizSubmitted) {
      // Choice selection
      $app.querySelectorAll('.quiz-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          const qIdx = parseInt(btn.dataset.question);
          const choice = btn.dataset.choice;

          // Deselect siblings
          $app.querySelectorAll(`.quiz-choice[data-question="${qIdx}"]`).forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          state.quizAnswers[qIdx] = choice;

          // Enable submit if all answered
          const $submit = document.getElementById('btn-submit-quiz');
          const allAnswered = questions.every((_, i) => state.quizAnswers[i] !== undefined);
          if ($submit) $submit.disabled = !allAnswered;
        });
      });

      // Submit quiz
      const $submit = document.getElementById('btn-submit-quiz');
      if ($submit) {
        $submit.addEventListener('click', () => {
          // Calculate score
          let score = 0;
          questions.forEach((q, i) => {
            if (state.quizAnswers[i] === q.correctAnswer) score++;
          });
          state.quizScore = score;

          const pct = Math.round((score / questions.length) * 100);

          // Flash effect
          const $card = $app.querySelector('.step-card');
          if ($card) {
            $card.style.animation = 'none';
            $card.offsetHeight;
            if (pct >= 50) {
              $card.style.animation = 'successFlash 0.8s ease';
            }
          }

          setTimeout(() => {
            state.quizSubmitted = true;
            render();
            // Scroll to top to see score
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 400);
        });
      }
    } else {
      // Retry quiz
      const $retry = document.getElementById('btn-retry-quiz');
      if ($retry) {
        $retry.addEventListener('click', () => {
          state.quizAnswers = {};
          state.quizSubmitted = false;
          state.quizScore = 0;
          render();
        });
      }

      // Back to courses
      const $backCourses = document.getElementById('btn-back-courses');
      if ($backCourses) {
        $backCourses.addEventListener('click', () => {
          state.currentView = 'courses';
          state.currentActivity = null;
          state.currentCourse = null;
          state.sspoeStep = 0;
          state.selectedAnswer = null;
          state.predictionIndex = 0;
          state.predictionAnswers = [];
          state.quizAnswers = {};
          state.quizSubmitted = false;
          state.quizScore = 0;
          render();
        });
      }
    }
  }

  // ── NAVIGATION ──
  $btnBack.addEventListener('click', () => {
    exitSimFullscreen();

    if (state.currentView === 'player') {
      if (state.sspoeStep > 0) {
        if (state.sspoeStep === 3) {
          // From quiz, go back to explanation
          state.quizAnswers = {};
          state.quizSubmitted = false;
          state.quizScore = 0;
        }
        state.sspoeStep--;
        render();
      } else if (state.predictionIndex > 0) {
        // Navigate back through prediction questions
        state.predictionIndex--;
        render();
      } else {
        state.currentView = 'courses';
        state.currentActivity = null;
        state.predictionIndex = 0;
        state.predictionAnswers = [];
        render();
      }
    } else if (state.currentView === 'courses') {
      state.currentView = 'home';
      state.currentLevel = null;
      render();
    }
  });

  // ── LANGUAGE TOGGLE ──
  $btnLang.addEventListener('click', () => {
    setLang(state.lang === 'fr' ? 'ar' : 'fr');
  });

  // ── THEME TOGGLE ──
  $btnTheme.addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // ── Handle back button / Escape ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.simFullscreen) {
        exitSimFullscreen();
      }
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && state.simFullscreen) {
      exitSimFullscreen();
    }
  });

  // ── PWA INSTALL ──
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $installBanner.classList.remove('hidden');
  });

  $btnInstall.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        $installBanner.classList.add('hidden');
      }
      deferredPrompt = null;
    }
  });

  window.addEventListener('appinstalled', () => {
    $installBanner.classList.add('hidden');
    deferredPrompt = null;
  });

  // ── SERVICE WORKER REGISTRATION ──
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((reg) => {
          console.log('[App] Service Worker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[App] Service Worker registration failed:', err);
        });
    });
  }

  // ── INIT ──
  function init() {
    setLang(state.lang);
    setTheme(state.theme);
  }

  init();
})();
