const fs = require('fs');

// Mock APP_DATA global
global.APP_DATA = { levels: [{ id: "1ac", courses: [] }] };

try {
    const dataContent = fs.readFileSync('data-1ac.js', 'utf8');
    eval(dataContent);
    console.log("Syntax Verified: data-1ac.js is valid JavaScript.");

    // Optional: Check if course was actually added
    const level1ac = APP_DATA.levels.find(l => l.id === "1ac");
    const newCourse = level1ac.courses.find(c => c.id === "1ac_circuit_simple");

    if (newCourse) {
        console.log("Success: Course '1ac_circuit_simple' found in 1AC level.");
        console.log(`- Activities count: ${newCourse.activities.length}`);
    } else {
        console.error("Error: Course '1ac_circuit_simple' NOT found in 1AC level.");
        process.exit(1);
    }

} catch (e) {
    console.error("Syntax Error in data-1ac.js:", e.message);
    process.exit(1);
}
