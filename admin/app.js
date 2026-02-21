const API = 'http://localhost:3000/api';

// State
let simulations = [];
let images = [];
let metadata = {};
let currentLevels = [];

// ── INIT ──
async function init() {
    try {
        const [sims, imgs, meta, levels] = await Promise.all([
            fetch(`${API}/simulations`).then(r => r.json()),
            fetch(`${API}/images`).then(r => r.json()),
            fetch(`${API}/metadata`).then(r => r.json()),
            fetch(`${API}/levels`).then(r => r.json())
        ]);
        simulations = sims;
        images = imgs;
        metadata = meta;
        currentLevels = levels;
        renderDashboard();
    } catch (e) {
        console.error('Init failed', e);
        document.body.innerHTML = `<div class="p-8 text-red-600">Failed to connect to backend. Is <code>node server.js</code> running?</div>`;
    }
}

// State
let currentCourseData = null;
let currentLevelId = null;
let currentTab = 'general'; // 'general' or activity index

// ── DASHBOARD ──
async function renderDashboard() {
    const $app = document.getElementById('app');
    const courses = await fetch(`${API}/courses`).then(r => r.json());

    const tpl = document.getElementById('tpl-dashboard').content.cloneNode(true);
    const $container = tpl.getElementById('levels-container');

    currentLevels.forEach(level => {
        const levelCourses = courses.filter(c => c.levelId === level.id);

        const section = document.createElement('div');
        section.className = 'bg-white p-6 rounded-lg shadow';
        section.innerHTML = `
            <div class="flex justify-between items-center mb-4 border-b pb-2">
                <h3 class="text-xl font-bold flex items-center gap-2">
                    <span>${level.icon}</span> ${level.name.fr}
                </h3>
                <button onclick="createNewCourse('${level.id}')" class="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200">+ Nouveau Cours</button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${levelCourses.map(c => `
                    <div onclick="editCourse('${level.id}', '${c.id}')" class="border p-4 rounded hover:bg-slate-50 cursor-pointer transition">
                        <div class="font-bold text-lg">${c.title.fr}</div>
                        <div class="text-gray-500 text-sm" dir="rtl">${c.title.ar}</div>
                        <code class="text-xs text-slate-400 mt-2 block">${c.file}</code>
                    </div>
                `).join('')}
                ${levelCourses.length === 0 ? '<div class="text-gray-400 italic">Aucun cours.</div>' : ''}
            </div>
        `;
        $container.appendChild(section);
    });

    $app.innerHTML = '';
    $app.appendChild(tpl);
}

// ── COURSE EDITOR (TABS UI) ──
async function editCourse(levelId, courseId) {
    currentLevelId = levelId;
    currentCourseData = await fetch(`${API}/course/${levelId}/${courseId}`).then(r => r.json());
    currentTab = 'general';
    renderEditor();
}

function createNewCourse(levelId) {
    currentLevelId = levelId;
    currentCourseData = {
        id: `cours_${Date.now()}`,
        title: { fr: "Nouveau Cours", ar: "درس جديد" },
        description: { fr: "", ar: "" },
        icon: "📝",
        activities: []
    };
    currentTab = 'general';
    renderEditor();
}

function renderEditor() {
    const $app = document.getElementById('app');
    if (!$app.querySelector('#tabs-container')) {
        $app.innerHTML = '';
        const tpl = document.getElementById('tpl-course-editor').content.cloneNode(true);
        $app.appendChild(tpl);
    }

    document.getElementById('editor-title').textContent = currentCourseData.title.fr || 'Édition';

    // Render Sidebar Tabs
    const $tabs = document.getElementById('tabs-container');
    $tabs.innerHTML = `
        <button onclick="switchTab('general')" class="w-full text-left px-4 py-2 rounded text-sm font-medium ${currentTab === 'general' ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100'}">
            ⚙️ Général
        </button>
        ${currentCourseData.activities.map((act, idx) => `
            <div class="flex items-center group">
                <button onclick="switchTab(${idx})" class="flex-1 text-left px-4 py-2 rounded text-sm font-medium truncate ${currentTab === idx ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100'}">
                   Activité ${idx + 1}
                </button>
                <button onclick="deleteActivity(${idx})" class="text-red-400 hover:text-red-700 p-2 hidden group-hover:block" title="Supprimer">🗑️</button>
            </div>
        `).join('')}
    `;

    // Render Tab Content
    const $content = document.getElementById('tab-content');
    $content.innerHTML = '';

    if (currentTab === 'general') {
        renderGeneralTab($content);
    } else {
        renderActivityTab($content, currentTab);
    }

    // Initialize Quill Editors after DOM is ready
    setTimeout(initQuillEditors, 0);
}

window.switchTab = (tab) => {
    currentTab = tab;
    renderEditor();
};

// ── GUI TAB RENDERERS ──

function renderGeneralTab($container) {
    const c = currentCourseData;
    $container.innerHTML = `
        <div class="space-y-6 max-w-4xl">
            <h2 class="text-2xl font-bold text-slate-800 mb-6">Informations Générales</h2>
            
            <div class="grid grid-cols-2 gap-6 bg-white p-6 rounded shadow-sm border">
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-1">ID du fichier (anglais/sans espaces)</label>
                    <input type="text" value="${c.id}" onchange="updateCourseField('id', this.value)" class="w-full p-2 border rounded bg-gray-50 text-gray-500" readonly>
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-1">Emoji / Icône</label>
                    <input type="text" value="${c.icon || ''}" onchange="updateCourseField('icon', this.value)" class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500">
                </div>
                
                <!-- French column -->
                <div class="space-y-4">
                    <div class="bg-blue-50 p-4 rounded border border-blue-100">
                        <label class="block text-sm font-bold text-blue-800 mb-2">🇫🇷 Titre (Français)</label>
                        <input type="text" value="${c.title.fr || ''}" onchange="updateCourseField('title.fr', this.value)" class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 mb-4" placeholder="Ex: Le Courant Électrique">
                        
                        <label class="block text-sm font-bold text-blue-800 mb-2">Description (Français)</label>
                        <div class="quill-editor bg-white" data-path="description.fr" data-lang="fr">${c.description.fr || ''}</div>
                    </div>
                </div>

                <!-- Arabic column -->
                <div class="space-y-4">
                    <div class="bg-emerald-50 p-4 rounded border border-emerald-100">
                        <label class="block text-sm font-bold text-emerald-800 mb-2 text-right">🇲🇦 Titre (Arabe)</label>
                        <input dir="rtl" type="text" value="${c.title.ar || ''}" onchange="updateCourseField('title.ar', this.value)" class="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 mb-4 text-right" placeholder="Ex: التيار الكهربائي">
                        
                        <label class="block text-sm font-bold text-emerald-800 mb-2 text-right">Description (Arabe)</label>
                        <div class="quill-editor bg-white" data-path="description.ar" data-lang="ar">${c.description.ar || ''}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderActivityTab($container, actIdx) {
    const act = currentCourseData.activities[actIdx];
    if (!act.simulation) act.simulation = { file: "", instructions: { fr: "", ar: "" } };
    if (!act.explanation) act.explanation = { summary: { fr: "", ar: "" }, feedback: { correct: { fr: "", ar: "" }, incorrect: { fr: "", ar: "" } } };

    $container.innerHTML = `
        <div class="space-y-8 max-w-5xl pb-20">
            <h2 class="text-2xl font-bold text-slate-800">Activité ${actIdx + 1}</h2>

            <!-- 1. Title -->
            <div class="bg-white p-6 rounded shadow-sm border">
                <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">1. Titre de l'activité</h3>
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <input type="text" value="${act.title.fr || ''}" onchange="updateActField(${actIdx}, 'title.fr', this.value)" class="w-full p-2 border rounded bg-blue-50" placeholder="Titre FR">
                    </div>
                    <div>
                        <input dir="rtl" type="text" value="${act.title.ar || ''}" onchange="updateActField(${actIdx}, 'title.ar', this.value)" class="w-full p-2 border rounded bg-emerald-50 text-right" placeholder="العنوان بالعربية">
                    </div>
                </div>
            </div>

            <!-- 2. Predictions Builder -->
            <div class="bg-white p-6 rounded shadow-sm border" id="predictions-container-${actIdx}">
                ${renderPredictionsGUI(actIdx)}
            </div>

            <!-- 3. Simulation Setup -->
            <div class="bg-white p-6 rounded shadow-sm border">
                <h3 class="font-bold text-gray-700 mb-4 border-b pb-2 flex justify-between items-center">
                    <span>3. Étape : Observation (Simulation)</span>
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Simulation 3D / Interactive</span>
                </h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Fichier de simulation (HTML)</label>
                        <select onchange="updateActField(${actIdx}, 'simulation.file', this.value)" class="w-full p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-500">
                            <option value="">-- Sélectionner une simulation --</option>
                            ${simulations.map(sim => `<option value="${sim}" ${act.simulation.file === sim ? 'selected' : ''}>${sim}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Image optionnelle</label>
                        <select onchange="updateActField(${actIdx}, 'simulation.image', this.value)" class="w-full p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-500">
                            <option value="">-- Aucune image --</option>
                            ${images.map(img => `<option value="${img}" ${act.simulation.image === img ? 'selected' : ''}>${img}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-6">
                    <div class="bg-blue-50 p-3 rounded">
                        <label class="block text-xs font-bold text-blue-800 mb-1">Instructions (FR)</label>
                        <div class="quill-editor bg-white" data-actidx="${actIdx}" data-path="simulation.instructions.fr" data-lang="fr">${act.simulation.instructions?.fr || ''}</div>
                    </div>
                    <div class="bg-emerald-50 p-3 rounded">
                        <label class="block text-xs font-bold text-emerald-800 mb-1 text-right">Instructions (AR)</label>
                        <div class="quill-editor bg-white" data-actidx="${actIdx}" data-path="simulation.instructions.ar" data-lang="ar">${act.simulation.instructions?.ar || ''}</div>
                    </div>
                </div>
            </div>

            <!-- 4. Explanation Setup -->
            <div class="bg-white p-6 rounded shadow-sm border">
                <h3 class="font-bold text-gray-700 mb-4 border-b pb-2 flex justify-between items-center">
                    <span>4. Étape : Explication (Bilan)</span>
                    <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Résumé et Feedback</span>
                </h3>

                <div class="mb-4 w-1/2">
                    <label class="block text-sm font-bold text-gray-700 mb-1">Image de l'explication (Optionnelle)</label>
                    <select onchange="updateActField(${actIdx}, 'explanation.image', this.value)" class="w-full p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-purple-500">
                        <option value="">-- Aucune image --</option>
                        ${images.map(img => `<option value="${img}" ${act.explanation.image === img ? 'selected' : ''}>${img}</option>`).join('')}
                    </select>
                </div>

                <div class="space-y-4 border-t pt-4">
                    <h4 class="font-bold text-gray-700 text-sm">Feedback de la Prédiction</h4>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-green-50 p-3 rounded border border-green-200">
                            <label class="block text-xs font-bold text-green-800 mb-1">🎉 Si correct (FR)</label>
                            <div class="quill-editor bg-white" data-actidx="${actIdx}" data-path="explanation.feedback.correct.fr" data-lang="fr">${act.explanation.feedback?.correct?.fr || ''}</div>
                        </div>
                        <div class="bg-green-50 p-3 rounded border border-green-200">
                            <label class="block text-xs font-bold text-green-800 mb-1 text-right">🎉 Si correct (AR)</label>
                            <div class="quill-editor bg-white" data-actidx="${actIdx}" data-path="explanation.feedback.correct.ar" data-lang="ar">${act.explanation.feedback?.correct?.ar || ''}</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-red-50 p-3 rounded border border-red-200">
                            <label class="block text-xs font-bold text-red-800 mb-1">❌ Si incorrect (FR)</label>
                            <div class="quill-editor bg-white" data-actidx="${actIdx}" data-path="explanation.feedback.incorrect.fr" data-lang="fr">${act.explanation.feedback?.incorrect?.fr || ''}</div>
                        </div>
                        <div class="bg-red-50 p-3 rounded border border-red-200">
                            <label class="block text-xs font-bold text-red-800 mb-1 text-right">❌ Si incorrect (AR)</label>
                            <div class="quill-editor bg-white" data-actidx="${actIdx}" data-path="explanation.feedback.incorrect.ar" data-lang="ar">${act.explanation.feedback?.incorrect?.ar || ''}</div>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 border-t pt-4 mt-4">
                    <h4 class="font-bold text-gray-700 text-sm">Résumé (Summary)</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-blue-50 p-3 rounded">
                            <label class="block text-xs font-bold text-blue-800 mb-1">Résumé (FR)</label>
                            <div class="quill-editor bg-white" data-actidx="${actIdx}" data-path="explanation.summary.fr" data-lang="fr">${act.explanation.summary?.fr || ''}</div>
                        </div>
                        <div class="bg-emerald-50 p-3 rounded">
                            <label class="block text-xs font-bold text-emerald-800 mb-1 text-right">Résumé (AR)</label>
                            <div class="quill-editor bg-white" data-actidx="${actIdx}" data-path="explanation.summary.ar" data-lang="ar">${act.explanation.summary?.ar || ''}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 5. Quiz Builder -->
            <div class="bg-white p-6 rounded shadow-sm border mt-8" id="quiz-container-${actIdx}">
                ${renderQuizGUI(actIdx)}
            </div>

        </div>
    `;
}

window.updateCourseField = (path, value) => {
    if (path === 'id') currentCourseData.id = value;
    if (path === 'icon') currentCourseData.icon = value;
    if (path === 'title.fr') currentCourseData.title.fr = value;
    if (path === 'title.ar') currentCourseData.title.ar = value;
    if (path === 'description.fr') currentCourseData.description.fr = value;
    if (path === 'description.ar') currentCourseData.description.ar = value;
    document.getElementById('editor-title').textContent = currentCourseData.title.fr || 'Édition';
};

window.updateActField = (idx, path, value) => {
    const act = currentCourseData.activities[idx];

    // Title
    if (path === 'title.fr') act.title.fr = value;
    if (path === 'title.ar') act.title.ar = value;

    // Simulation
    if (path === 'simulation.file') act.simulation.file = value;
    if (path === 'simulation.image') {
        if (!value) delete act.simulation.image;
        else act.simulation.image = value;
    }
    if (path === 'simulation.instructions.fr') {
        if (!act.simulation.instructions) act.simulation.instructions = { fr: "", ar: "" };
        act.simulation.instructions.fr = value;
    }
    if (path === 'simulation.instructions.ar') {
        if (!act.simulation.instructions) act.simulation.instructions = { fr: "", ar: "" };
        act.simulation.instructions.ar = value;
    }

    // Explanation
    if (path === 'explanation.image') {
        if (!value) delete act.explanation.image;
        else act.explanation.image = value;
    }
    if (path === 'explanation.summary.fr') act.explanation.summary.fr = value;
    if (path === 'explanation.summary.ar') act.explanation.summary.ar = value;

    if (path === 'explanation.feedback.correct.fr') {
        if (!act.explanation.feedback) act.explanation.feedback = { correct: { fr: "", ar: "" }, incorrect: { fr: "", ar: "" } };
        if (!act.explanation.feedback.correct) act.explanation.feedback.correct = { fr: "", ar: "" };
        act.explanation.feedback.correct.fr = value;
    }
    if (path === 'explanation.feedback.correct.ar') {
        if (!act.explanation.feedback) act.explanation.feedback = { correct: { fr: "", ar: "" }, incorrect: { fr: "", ar: "" } };
        if (!act.explanation.feedback.correct) act.explanation.feedback.correct = { fr: "", ar: "" };
        act.explanation.feedback.correct.ar = value;
    }
    if (path === 'explanation.feedback.incorrect.fr') {
        if (!act.explanation.feedback) act.explanation.feedback = { correct: { fr: "", ar: "" }, incorrect: { fr: "", ar: "" } };
        if (!act.explanation.feedback.incorrect) act.explanation.feedback.incorrect = { fr: "", ar: "" };
        act.explanation.feedback.incorrect.fr = value;
    }
    if (path === 'explanation.feedback.incorrect.ar') {
        if (!act.explanation.feedback) act.explanation.feedback = { correct: { fr: "", ar: "" }, incorrect: { fr: "", ar: "" } };
        if (!act.explanation.feedback.incorrect) act.explanation.feedback.incorrect = { fr: "", ar: "" };
        act.explanation.feedback.incorrect.ar = value;
    }
};

window.addActivity = () => {
    currentCourseData.activities.push({
        id: `${currentCourseData.id}_act${currentCourseData.activities.length + 1} `,
        title: { fr: "Nouvelle Activité", ar: "نشاط جديد" },
        predictions: [],
        simulation: { file: "", instructions: { fr: "", ar: "" } },
        explanation: { summary: { fr: "", ar: "" }, feedback: { correct: { fr: "", ar: "" }, incorrect: { fr: "", ar: "" } } }
    });
    currentTab = currentCourseData.activities.length - 1;
    renderEditor();
};

window.deleteActivity = (idx) => {
    if (confirm('Supprimer cette activité définitivement ?')) {
        currentCourseData.activities.splice(idx, 1);
        currentTab = 'general';
        renderEditor();
    }
};

window.saveCourse = async () => {
    const btn = document.querySelector('button[onclick="saveCourse()"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = '⏳ Sauvegarde...';
    try {
        const res = await fetch(`${API}/course/${currentLevelId}/${currentCourseData.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentCourseData)
        });
        if (res.ok) {
            btn.innerHTML = '✅ Enregistré !';
            // Auto-build so PWA gets latest data immediately
            await triggerBuild(true);
            setTimeout(() => btn.innerHTML = ogText, 2000);
        } else {
            alert('Erreur lors de la sauvegarde');
            btn.innerHTML = ogText;
        }
    } catch (err) {
        console.error(err);
        alert('Erreur réseau');
        btn.innerHTML = ogText;
    }
};

// ── GUI BUILDERS FOR PREDICTIONS & QUIZ ──

function renderPredictionsGUI(actIdx) {
    const act = currentCourseData.activities[actIdx];
    if (!act.predictions) act.predictions = [];

    // Convert old format to array if needed
    if (!Array.isArray(act.predictions) && act.prediction) {
        act.predictions = [act.prediction];
        delete act.prediction;
    } else if (!Array.isArray(act.predictions)) {
        act.predictions = [];
    }

    return `
        <div class="flex justify-between items-center mb-4 border-b pb-2">
            <h3 class="font-bold text-gray-700 flex items-center gap-2">
                <span>2. Prédictions (Hypothèses)</span>
                <span class="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">QCM Avant Simulation</span>
            </h3>
            <button class="bg-indigo-50 text-indigo-700 px-3 py-1 text-sm rounded border border-indigo-200 hover:bg-indigo-100" onclick="addPrediction(${actIdx})">+ Ajouter une question</button>
        </div>
        
        <div class="space-y-6">
            ${act.predictions.map((p, pIdx) => `
                <div class="border p-4 rounded bg-slate-50 relative">
                    <button class="absolute top-2 right-2 text-red-400 hover:text-red-700 font-bold" onclick="deletePrediction(${actIdx}, ${pIdx})" title="Supprimer">✕</button>
                    
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-xs font-bold text-blue-800 mb-1">Question ${pIdx + 1} (FR)</label>
                            <input type="text" value="${p.question?.fr || ''}" onchange="updatePrediction(${actIdx}, ${pIdx}, 'question.fr', this.value)" class="w-full p-2 border rounded text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-emerald-800 mb-1 text-right">Question ${pIdx + 1} (AR)</label>
                            <input dir="rtl" type="text" value="${p.question?.ar || ''}" onchange="updatePrediction(${actIdx}, ${pIdx}, 'question.ar', this.value)" class="w-full p-2 border rounded text-sm text-right">
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-xs font-bold text-gray-700 mb-1">Image associée (Optionnelle)</label>
                        <select onchange="updatePrediction(${actIdx}, ${pIdx}, 'image', this.value)" class="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-indigo-500 text-sm">
                            <option value="">-- Aucune image --</option>
                            ${images.map(img => `<option value="${img}" ${p.image === img ? 'selected' : ''}>${img}</option>`).join('')}
                        </select>
                    </div>

                    <div class="bg-white p-3 rounded border">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-bold text-gray-600">Choix de réponses</span>
                            <button onclick="addChoice(${actIdx}, ${pIdx}, 'prediction')" class="text-xs text-indigo-600 font-bold hover:underline">+ Ajouter un choix</button>
                        </div>
                        ${(p.choices || []).map((c, cIdx) => `
                            <div class="flex gap-2 items-center mb-2">
                                <input type="radio" name="pred_correct_${actIdx}_${pIdx}" ${p.correctAnswer === c.id ? 'checked' : ''} onchange="updatePrediction(${actIdx}, ${pIdx}, 'correctAnswer', '${c.id}')" title="Bonne réponse">
                                <span class="text-xs font-mono font-bold w-6 text-center text-gray-400">${c.id.toUpperCase()}</span>
                                <input type="text" value="${c.text?.fr || ''}" onchange="updateChoice(${actIdx}, ${pIdx}, ${cIdx}, 'prediction', 'fr', this.value)" class="flex-1 p-1 border rounded text-sm" placeholder="Choix FR">
                                <input dir="rtl" type="text" value="${c.text?.ar || ''}" onchange="updateChoice(${actIdx}, ${pIdx}, ${cIdx}, 'prediction', 'ar', this.value)" class="flex-1 p-1 border rounded text-sm text-right" placeholder="الخيار العربية">
                                <button onclick="deleteChoice(${actIdx}, ${pIdx}, ${cIdx}, 'prediction')" class="text-red-400 hover:text-red-700 font-bold px-2">✕</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
            ${act.predictions.length === 0 ? '<div class="text-center text-gray-400 text-sm py-4">Aucune question de prédiction.</div>' : ''}
        </div>
    `;
}

function renderQuizGUI(actIdx) {
    const act = currentCourseData.activities[actIdx];
    if (!act.quiz) act.quiz = { questions: [] };
    if (!act.quiz.questions) act.quiz.questions = [];

    return `
        <div class="flex justify-between items-center mb-4 border-b pb-2">
            <h3 class="font-bold text-gray-700 flex items-center gap-2">
                <span>5. Évaluation (Quiz)</span>
                <span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">Vérification des acquis</span>
            </h3>
            <button class="bg-emerald-50 text-emerald-700 px-3 py-1 text-sm rounded border border-emerald-200 hover:bg-emerald-100" onclick="addQuizQuestion(${actIdx})">+ Ajouter une question</button>
        </div>
        
        <div class="space-y-6">
            ${act.quiz.questions.map((q, qIdx) => `
                <div class="border p-4 rounded bg-slate-50 relative border-l-4 border-l-emerald-400">
                    <button class="absolute top-2 right-2 text-red-400 hover:text-red-700 font-bold" onclick="deleteQuizQuestion(${actIdx}, ${qIdx})" title="Supprimer">✕</button>
                    
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-xs font-bold text-blue-800 mb-1">Question ${qIdx + 1} (FR)</label>
                            <input type="text" value="${q.question?.fr || ''}" onchange="updateQuizQuestion(${actIdx}, ${qIdx}, 'question.fr', this.value)" class="w-full p-2 border rounded text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-emerald-800 mb-1 text-right">Question ${qIdx + 1} (AR)</label>
                            <input dir="rtl" type="text" value="${q.question?.ar || ''}" onchange="updateQuizQuestion(${actIdx}, ${qIdx}, 'question.ar', this.value)" class="w-full p-2 border rounded text-sm text-right">
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-xs font-bold text-gray-700 mb-1">Image associée (Optionnelle)</label>
                        <select onchange="updateQuizQuestion(${actIdx}, ${qIdx}, 'image', this.value)" class="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-emerald-500 text-sm">
                            <option value="">-- Aucune image --</option>
                            ${images.map(img => `<option value="${img}" ${q.image === img ? 'selected' : ''}>${img}</option>`).join('')}
                        </select>
                    </div>

                    <div class="bg-white p-3 rounded border">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-bold text-gray-600">Choix de réponses</span>
                            <button onclick="addChoice(${actIdx}, ${qIdx}, 'quiz')" class="text-xs text-emerald-600 font-bold hover:underline">+ Ajouter un choix</button>
                        </div>
                        ${(q.choices || []).map((c, cIdx) => `
                            <div class="flex gap-2 items-center mb-2">
                                <input type="radio" name="quiz_correct_${actIdx}_${qIdx}" ${q.correctAnswer === c.id ? 'checked' : ''} onchange="updateQuizQuestion(${actIdx}, ${qIdx}, 'correctAnswer', '${c.id}')" title="Bonne réponse">
                                <span class="text-xs font-mono font-bold w-6 text-center text-gray-400">${c.id.toUpperCase()}</span>
                                <input type="text" value="${c.text?.fr || ''}" onchange="updateChoice(${actIdx}, ${qIdx}, ${cIdx}, 'quiz', 'fr', this.value)" class="flex-1 p-1 border rounded text-sm" placeholder="Choix FR">
                                <input dir="rtl" type="text" value="${c.text?.ar || ''}" onchange="updateChoice(${actIdx}, ${qIdx}, ${cIdx}, 'quiz', 'ar', this.value)" class="flex-1 p-1 border rounded text-sm text-right" placeholder="الخيار العربية">
                                <button onclick="deleteChoice(${actIdx}, ${qIdx}, ${cIdx}, 'quiz')" class="text-red-400 hover:text-red-700 font-bold px-2">✕</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
            ${act.quiz.questions.length === 0 ? '<div class="text-center text-gray-400 text-sm py-4">Aucune question de quiz.</div>' : ''}
        </div>
    `;
}

// ── BUILDERS UPDATE LOGIC ──

window.addPrediction = (actIdx) => {
    const act = currentCourseData.activities[actIdx];
    act.predictions.push({
        type: "mcq",
        question: { fr: "Nouvelle question ?", ar: "سؤال جديد ؟" },
        choices: [
            { id: "a", text: { fr: "Choix A", ar: "أ" } },
            { id: "b", text: { fr: "Choix B", ar: "ب" } }
        ],
        correctAnswer: "a"
    });
    renderEditor();
};

window.deletePrediction = (actIdx, pIdx) => {
    if (confirm("Supprimer cette question de prédiction ?")) {
        currentCourseData.activities[actIdx].predictions.splice(pIdx, 1);
        renderEditor();
    }
};

window.updatePrediction = (actIdx, pIdx, field, value) => {
    const p = currentCourseData.activities[actIdx].predictions[pIdx];
    if (field === 'question.fr') p.question.fr = value;
    if (field === 'question.ar') p.question.ar = value;
    if (field === 'image') {
        if (!value) delete p.image;
        else p.image = value;
    }
    if (field === 'correctAnswer') p.correctAnswer = value;

    // Minimal re-render of just the tab content is preferred, but for now we re-render the editor tab
    const $content = document.getElementById('tab-content');
    renderActivityTab($content, actIdx);
};

window.addQuizQuestion = (actIdx) => {
    const act = currentCourseData.activities[actIdx];
    if (!act.quiz) act.quiz = { questions: [] };
    act.quiz.questions.push({
        type: "mcq",
        question: { fr: "Nouvelle question ?", ar: "سؤال جديد ؟" },
        choices: [
            { id: "a", text: { fr: "Choix A", ar: "أ" } },
            { id: "b", text: { fr: "Choix B", ar: "ب" } }
        ],
        correctAnswer: "a"
    });
    renderEditor();
};

window.deleteQuizQuestion = (actIdx, qIdx) => {
    if (confirm("Supprimer cette question de quiz ?")) {
        currentCourseData.activities[actIdx].quiz.questions.splice(qIdx, 1);
        renderEditor();
    }
};

window.updateQuizQuestion = (actIdx, qIdx, field, value) => {
    const q = currentCourseData.activities[actIdx].quiz.questions[qIdx];
    if (field === 'question.fr') q.question.fr = value;
    if (field === 'question.ar') q.question.ar = value;
    if (field === 'image') {
        if (!value) delete q.image;
        else q.image = value;
    }
    if (field === 'correctAnswer') q.correctAnswer = value;

    const $content = document.getElementById('tab-content');
    renderActivityTab($content, actIdx);
};

window.addChoice = (actIdx, qIdx, type) => {
    let q;
    if (type === 'prediction') {
        q = currentCourseData.activities[actIdx].predictions[qIdx];
    } else {
        q = currentCourseData.activities[actIdx].quiz.questions[qIdx];
    }

    // Gen new ID (a, b, c, d...)
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const nextId = alphabet[q.choices.length % 26];

    q.choices.push({ id: nextId, text: { fr: "", ar: "" } });

    const $content = document.getElementById('tab-content');
    renderActivityTab($content, actIdx);
};

window.deleteChoice = (actIdx, qIdx, cIdx, type) => {
    let q;
    if (type === 'prediction') {
        q = currentCourseData.activities[actIdx].predictions[qIdx];
    } else {
        q = currentCourseData.activities[actIdx].quiz.questions[qIdx];
    }

    q.choices.splice(cIdx, 1);

    // Re-index choice IDs
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    q.choices.forEach((c, i) => c.id = alphabet[i]);

    const $content = document.getElementById('tab-content');
    renderActivityTab($content, actIdx);
};

window.updateChoice = (actIdx, qIdx, cIdx, type, lang, value) => {
    let q;
    if (type === 'prediction') {
        q = currentCourseData.activities[actIdx].predictions[qIdx];
    } else {
        q = currentCourseData.activities[actIdx].quiz.questions[qIdx];
    }

    q.choices[cIdx].text[lang] = value;
};

// ── BUILD ──
async function triggerBuild(silent = false) {
    try {
        const res = await fetch(`${API}/build`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            if (!silent) alert('Publication réussie ! Les élèves verront les nouveautés.');
        } else {
            console.error('Erreur de publication: ' + data.error);
            if (!silent) alert('Erreur de publication: ' + data.error);
        }
    } catch (e) {
        console.error('Erreur de publication', e);
        if (!silent) alert('Erreur de publication');
    }
}

// ── QUILL WYSIWYG INITIALIZATION ──
function initQuillEditors() {
    const containers = document.querySelectorAll('.quill-editor');
    containers.forEach(container => {
        // Prevent double initialization
        if (container.classList.contains('ql-container')) return;

        const path = container.getAttribute('data-path');
        const lang = container.getAttribute('data-lang');
        const actIdx = container.getAttribute('data-actidx');
        const isRtl = lang === 'ar';

        const quill = new Quill(container, {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'size': ['small', false, 'large', 'huge'] }],
                    ['image'],
                    ['clean']
                ]
            }
        });

        if (isRtl) {
            quill.format('direction', 'rtl');
            quill.format('align', 'right');
        }

        quill.on('text-change', () => {
            const html = quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML;
            if (actIdx !== null && actIdx !== undefined) {
                updateActField(parseInt(actIdx), path, html);
            } else {
                updateCourseField(path, html);
            }
        });
    });
}

// Start
init();
