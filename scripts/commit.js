const { execSync} = require('child_process');

const message = process.argv[2] || "leetcode update";

try {
    execSync(`git add .`);
    execSync(`git commit -m "${message}"`);
    console.log("✅ Changes committed successfully.")
    execSync(`git push`);
    console.log("✅ Changes pushed successfully.")
} catch (error) {
    console.error("❌ An error occurred while committing changes:", error.message);
}