const fs = require('fs');
const path = require('path');

const problemPath = process.argv[2];

if (!problemPath) {
    console.log("❌ Please provide problem path (e.g. arrays/two-sum)");
    process.exit(1);
}

const baseDir = path.join("problems", problemPath);


fs.mkdirSync(baseDir, { recursive: true });

fs.copyFileSync("templates/solution.js", `${baseDir}/solution.js`);
fs.copyFileSync("templates/notes.md", `${baseDir}/notes.md`);

console.log(`✅ Template created at ${baseDir}`);