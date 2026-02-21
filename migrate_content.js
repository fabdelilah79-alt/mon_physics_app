const fs = require('fs');
const path = require('path');

// 1. Read data.js
const dataJsPath = path.join(__dirname, 'data.js');
let fileContent = fs.readFileSync(dataJsPath, 'utf8');

// 2. Mock APP_DATA to extract it safely
// We can't easily require() it because it's not a module.
// We'll eval it in a safe context or just append module.exports to a temp file.

const tempFile = path.join(__dirname, 'temp_data_migration.js');
fs.writeFileSync(tempFile, fileContent + '\nmodule.exports = APP_DATA;');

const APP_DATA = require(tempFile);

// 3. Prepare Directories
const CONTENT_DIR = path.join(__dirname, 'content');
const LEVELS_DIR = path.join(CONTENT_DIR, 'levels');
const COURSES_DIR = path.join(CONTENT_DIR, 'courses');

if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR);
if (!fs.existsSync(LEVELS_DIR)) fs.mkdirSync(LEVELS_DIR);
if (!fs.existsSync(COURSES_DIR)) fs.mkdirSync(COURSES_DIR);

// 4. Extract Metadata (everything except levels)
const metadata = { ...APP_DATA };
delete metadata.levels;

fs.writeFileSync(path.join(CONTENT_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2));
console.log('✅ Metadata saved.');

// 5. Extract Levels & Courses
if (APP_DATA.levels) {
    APP_DATA.levels.forEach(level => {
        // Save Level Metadata (exclude courses array for the level file itself)
        const levelMeta = { ...level };
        delete levelMeta.courses;

        fs.writeFileSync(path.join(LEVELS_DIR, `${level.id}.json`), JSON.stringify(levelMeta, null, 2));
        console.log(`✅ Level saved: ${level.id}`);

        // Prepare Course Directory for this level
        const levelCourseDir = path.join(COURSES_DIR, level.id);
        if (!fs.existsSync(levelCourseDir)) fs.mkdirSync(levelCourseDir);

        // Save Courses
        if (level.courses && Array.isArray(level.courses)) {
            level.courses.forEach(course => {
                fs.writeFileSync(path.join(levelCourseDir, `${course.id}.json`), JSON.stringify(course, null, 2));
                console.log(`   🔸 Course saved: ${course.id}`);
            });
        }
    });
}

// 6. Cleanup
fs.unlinkSync(tempFile);
console.log('🎉 Migration Complete!');
