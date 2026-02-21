const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Paths
const CONTENT_DIR = path.join(__dirname, 'content');
const LEVELS_DIR = path.join(CONTENT_DIR, 'levels');
const COURSES_DIR = path.join(CONTENT_DIR, 'courses');
const SIM_DIR = path.join(__dirname, 'simulations');
const DATA_JS_PATH = path.join(__dirname, 'data.js');

// Ensure directories exist
[CONTENT_DIR, LEVELS_DIR, COURSES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper: safe read JSON
function readJSON(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ── APIs ──

// 1. Get Metadata & Levels
app.get('/api/levels', (req, res) => {
    const levels = [];
    if (fs.existsSync(LEVELS_DIR)) {
        fs.readdirSync(LEVELS_DIR).forEach(file => {
            if (file.endsWith('.json')) {
                levels.push(readJSON(path.join(LEVELS_DIR, file)));
            }
        });
    }
    res.json(levels);
});

// 2. Get Global Metadata
app.get('/api/metadata', (req, res) => {
    const meta = readJSON(path.join(CONTENT_DIR, 'metadata.json')) || {};
    res.json(meta);
});

// 3. Save Global Metadata
app.post('/api/metadata', (req, res) => {
    fs.writeFileSync(path.join(CONTENT_DIR, 'metadata.json'), JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});

// 4. Get All Courses (Summary)
app.get('/api/courses', (req, res) => {
    const courseFiles = [];

    // Recurse through content/courses/{levelId}/*.json
    if (fs.existsSync(COURSES_DIR)) {
        const levelDirs = fs.readdirSync(COURSES_DIR);
        levelDirs.forEach(levelId => {
            const levelPath = path.join(COURSES_DIR, levelId);
            if (fs.statSync(levelPath).isDirectory()) {
                fs.readdirSync(levelPath).forEach(file => {
                    if (file.endsWith('.json')) {
                        const courseData = readJSON(path.join(levelPath, file));
                        courseFiles.push({
                            id: courseData.id,
                            levelId: levelId,
                            title: courseData.title,
                            file: file
                        });
                    }
                });
            }
        });
    }
    res.json(courseFiles);
});

// 5. Get Single Course
app.get('/api/course/:levelId/:courseId', (req, res) => {
    const { levelId, courseId } = req.params;
    const filePath = path.join(COURSES_DIR, levelId, `${courseId}.json`);
    const data = readJSON(filePath);
    if (data) res.json(data);
    else res.status(404).json({ error: 'Course not found' });
});

// 6. Save Course
app.post('/api/course/:levelId/:courseId', (req, res) => {
    const { levelId, courseId } = req.params;
    const courseData = req.body;

    const levelDir = path.join(COURSES_DIR, levelId);
    if (!fs.existsSync(levelDir)) fs.mkdirSync(levelDir, { recursive: true });

    fs.writeFileSync(path.join(levelDir, `${courseId}.json`), JSON.stringify(courseData, null, 2));
    res.json({ success: true });
});

// 7. List Simulations
app.get('/api/simulations', (req, res) => {
    const sims = [];
    if (fs.existsSync(SIM_DIR)) {
        fs.readdirSync(SIM_DIR).forEach(file => {
            if (file.endsWith('.html')) {
                sims.push(`simulations/${file}`);
            }
        });
    }
    res.json(sims);
});

// 7b. List Images
const IMAGES_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);

app.get('/api/images', (req, res) => {
    const images = [];
    if (fs.existsSync(IMAGES_DIR)) {
        const validExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
        fs.readdirSync(IMAGES_DIR).forEach(file => {
            const ext = path.extname(file).toLowerCase();
            if (validExts.includes(ext)) {
                images.push(`images/${file}`);
            }
        });
    }
    res.json(images);
});

// 8. BUILD / COMPILE data.js
// 8. BUILD / COMPILE data-*.js files
app.post('/api/build', (req, res) => {
    try {
        console.log('Building data files...');

        // 1. Read metadata
        const metadata = readJSON(path.join(CONTENT_DIR, 'metadata.json')) || {};

        // 2. Read Levels (Basic Info)
        const levels = [];
        if (fs.existsSync(LEVELS_DIR)) {
            fs.readdirSync(LEVELS_DIR).forEach(file => {
                if (file.endsWith('.json')) {
                    const levelData = readJSON(path.join(LEVELS_DIR, file));
                    // Initialize empty courses array for the core file
                    levelData.courses = [];
                    levels.push(levelData);
                }
            });
        }

        // 3. Generate data-core.js
        // This file initializes APP_DATA with metadata and empty levels
        const CORE_DATA = {
            ...metadata,
            levels: levels
        };
        const coreContent = `// =====================================================
// data-core.js — Auto-generated by Content Builder
// =====================================================
const APP_DATA = ${JSON.stringify(CORE_DATA, null, 2)};
`;
        fs.writeFileSync(path.join(__dirname, 'data-core.js'), coreContent);
        console.log('✅ Generated data-core.js');

        // 4. Generate data-{level}.js for each level
        levels.forEach(level => {
            const levelCourseDir = path.join(COURSES_DIR, level.id);
            const courses = [];

            if (fs.existsSync(levelCourseDir)) {
                fs.readdirSync(levelCourseDir).forEach(file => {
                    if (file.endsWith('.json')) {
                        const course = readJSON(path.join(levelCourseDir, file));
                        courses.push(course);
                    }
                });
            }

            // The script injection logic
            const levelContent = `// =====================================================
// data-${level.id}.js — Auto-generated by Content Builder
// =====================================================
(function() {
    const level = APP_DATA.levels.find(l => l.id === "${level.id}");
    if (level) {
        level.courses = ${JSON.stringify(courses, null, 2)};
    }
})();
`;
            fs.writeFileSync(path.join(__dirname, `data-${level.id}.js`), levelContent);
            console.log(`✅ Generated data-${level.id}.js`);
        });

        res.json({ success: true, message: 'Build successful! Files split by level.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Serve Admin UI
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.listen(PORT, () => {
    console.log(`Content Builder Server running at http://localhost:${PORT}/admin`);
});
