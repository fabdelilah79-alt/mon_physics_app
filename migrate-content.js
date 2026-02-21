const fs = require('fs');
const path = require('path');

const COURSES_DIR = path.join(__dirname, 'content', 'courses');

// Mock APP_DATA so the data files can run
global.APP_DATA = {
    levels: [
        { id: "1ac", title: "1ère Année", courses: [] },
        { id: "2ac", title: "2ème Année", courses: [] },
        { id: "3ac", title: "3ème Année", courses: [] }
    ]
};

// Load the data files
try { require('./data-1ac.js'); } catch (e) { }
try { require('./data-2ac.js'); } catch (e) { }
try { require('./data-3ac.js'); } catch (e) { }

console.log("Found levels:", global.APP_DATA.levels.length);

global.APP_DATA.levels.forEach(level => {
    if (level.courses && level.courses.length > 0) {
        const levelDir = path.join(COURSES_DIR, level.id);
        if (!fs.existsSync(levelDir)) fs.mkdirSync(levelDir, { recursive: true });

        console.log(`Level ${level.id} handles ${level.courses.length} courses:`);

        level.courses.forEach(course => {
            const filePath = path.join(levelDir, `${course.id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(course, null, 2));
            console.log(` -> Exported ${course.id}.json`);
        });
    }
});

console.log('Migration complete!');
