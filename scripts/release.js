// scripts/release.js
const { execSync } = require("child_process");
const conventionalChangelog = require("conventional-changelog");
const fs = require("fs");

const args = process.argv.slice(2);
const bumpType = args[0]; // patch | minor | major

if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error("❌ Usage: node scripts/release.js [patch|minor|major]");
  process.exit(1);
}

function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function runSilent(cmd) {
  return execSync(cmd).toString().trim();
}

async function generateChangelog() {
  return new Promise((resolve, reject) => {
    const changelogPath = "CHANGELOG.md";
    const existing = fs.existsSync(changelogPath)
      ? fs.readFileSync(changelogPath, "utf8")
      : "";

    let newContent = "";
    const stream = conventionalChangelog({ preset: "angular" });

    stream.on("data", (chunk) => (newContent += chunk.toString()));
    stream.on("error", reject);
    stream.on("end", () => {
      fs.writeFileSync(changelogPath, newContent + existing);
      console.log("✅ CHANGELOG.md updated");
      resolve(newContent); // return latest block for GitHub release notes
    });
  });
}

async function main() {
  // 1. Ensure working tree is clean
  const status = runSilent("git status --porcelain");
  if (status) {
    console.error("❌ Working tree is dirty. Commit or stash changes first.");
    process.exit(1);
  }

  // 2. Ensure on main branch
  const branch = runSilent("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    console.error(`❌ Must be on 'main' branch. Currently on '${branch}'.`);
    process.exit(1);
  }

  // 3. Pull latest
  run("git pull origin main");

  // 4. Bump version in package.json
  run(`npm version ${bumpType} --no-git-tag-version`);

  // 5. Read new version
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const version = pkg.version;
  const tag = `v${version}`;
  console.log(`\n📦 Releasing ${tag}`);

  // 6. Generate changelog using Node API
  const latestNotes = await generateChangelog();

  // 7. Write latest release notes to a temp file for gh CLI
  const notesFile = ".release-notes.md";
  fs.writeFileSync(notesFile, latestNotes);

  // 8. Commit changelog + version bump
  run("git add package.json CHANGELOG.md");
  run(`git commit -m "chore(release): ${tag}"`);

  // 9. Create annotated git tag
  run(`git tag -a ${tag} -m "Release ${tag}"`);

  // 10. Push commit + tag
  run("git push origin main --follow-tags");

  // 11. Package .vsix
  run("npx vsce package");

  const vsixFile = fs
    .readdirSync(".")
    .find((f) => f.endsWith(".vsix") && f.includes(version));

  if (!vsixFile) {
    console.error("❌ Could not find .vsix after packaging.");
    process.exit(1);
  }

  // 12. Create GitHub release with notes + vsix
  run(`gh release create ${tag} ./${vsixFile} --title "Release ${tag}" --notes-file ${notesFile}`);

  // 13. Publish to VS Code Marketplace
  run("npx vsce publish");

  // 14. Cleanup temp notes file
  fs.unlinkSync(notesFile);

  console.log(`\n✅ Successfully released ${tag}!`);
  console.log(`   GitHub   → https://github.com/rajankarmakar/quick-snippet-generator/releases/tag/${tag}`);
  console.log(`   Marketplace → https://marketplace.visualstudio.com/items?itemName=RajanKarmaker.quick-snippet-generator`);
}

main().catch((err) => {
  console.error("❌ Release failed:", err);
  process.exit(1);
});