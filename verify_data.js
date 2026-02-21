const fs = require('fs');
try {
    const dataContent = fs.readFileSync('data.js', 'utf8');
    eval(dataContent);
    console.log("Syntax Verified: data.js is valid JavaScript.");
} catch (e) {
    console.error("Syntax Error in data.js:", e.message);
    process.exit(1);
}
