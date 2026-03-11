// scripts/release.js
const { execSync } = require("child_process");
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

function generateChangelog(version) {
  const changelogPath = "CHANGELOG.md";

  // Get last tag to know commit range
  let lastTag = "";
  try {
    lastTag = runSilent("git describe --tags --abbrev=0");
  } catch {
    // No previous tag — use all commits
  }

  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  const logCmd = `git log ${range} --pretty=format:"%s|%h" --no-merges`;

  let commits;
  try {
    commits = runSilent(logCmd);
  } catch {
    commits = "";
  }

  const lines = commits ? commits.split("\n").filter(Boolean) : [];

  const sections = {
    feat:     { title: "### 🚀 Features",     items: [] },
    fix:      { title: "### 🐛 Bug Fixes",     items: [] },
    perf:     { title: "### ⚡ Performance",   items: [] },
    refactor: { title: "### ♻️  Refactoring",  items: [] },
    docs:     { title: "### 📝 Documentation", items: [] },
    chore:    { title: "### 🔧 Chores",        items: [] },
    other:    { title: "### 📦 Other",         items: [] },
  };

  for (const line of lines) {
    const [message, hash] = line.split("|");
    const match = message.match(/^(\w+)(\(.+?\))?!?:\s*(.+)/);
    const repoUrl = "https://github.com/rajankarmakar/quick-snippet-generator";
    const shortLink = `[\`${hash}\`](${repoUrl}/commit/${hash})`;

    if (match) {
      const type = match[1];
      const scope = match[2] ? match[2].replace(/[()]/g, "") + ": " : "";
      const desc = match[3];
      const entry = `- ${scope}${desc} (${shortLink})`;
      if (sections[type]) {
        sections[type].items.push(entry);
      } else {
        sections.other.items.push(entry);
      }
    } else {
      sections.other.items.push(`- ${message} (${shortLink})`);
    }
  }

  const date = new Date().toISOString().split("T")[0];
  const repoUrl = "https://github.com/rajankarmakar/quick-snippet-generator";
  let block = `## [${version}](${repoUrl}/releases/tag/v${version}) — ${date}\n\n`;

  for (const key of Object.keys(sections)) {
    if (sections[key].items.length > 0) {
      block += `${sections[key].title}\n\n`;
      block += sections[key].items.join("\n") + "\n\n";
    }
  }

  if (lines.length === 0) {
    block += "_No changes logged._\n\n";
  }

  // Prepend new block to existing changelog
  const existing = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8")
    : "";

  const header = existing.startsWith("# Changelog")
    ? ""
    : "# Changelog\n\nAll notable changes to this project will be documented here.\n\n";

  const fullContent = header + (existing.startsWith("# Changelog")
    ? existing.replace("# Changelog\n", "# Changelog\n\n" + block)
    : "# Changelog\n\nAll notable changes to this project will be documented here.\n\n" + block + existing);

  fs.writeFileSync(changelogPath, fullContent);
  console.log("✅ CHANGELOG.md updated");

  return block; // used as GitHub release notes
}

async function main() {
  // 1. Clean working tree check
  const status = runSilent("git status --porcelain");
  if (status) {
    console.error("❌ Working tree is dirty. Commit or stash changes first.");
    process.exit(1);
  }

  // 2. Must be on main
  const branch = runSilent("git rev-parse --abbrev-ref HEAD");
  if (branch !== "main") {
    console.error(`❌ Must be on 'main' branch. Currently on '${branch}'.`);
    process.exit(1);
  }

  // 3. Pull latest
  run("git pull origin main");

  // 4. Bump version
  run(`npm version ${bumpType} --no-git-tag-version`);

  // 5. Read new version
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const version = pkg.version;
  const tag = `v${version}`;
  console.log(`\n📦 Releasing ${tag}`);

  // 6. Generate changelog from git log
  const releaseNotes = generateChangelog(version);

  // 7. Write temp release notes for gh CLI
  const notesFile = ".release-notes.md";
  fs.writeFileSync(notesFile, releaseNotes);

  // 8. Commit
  run("git add package.json CHANGELOG.md");
  run(`git commit -m "chore(release): ${tag}"`);

  // 9. Tag
  run(`git tag -a ${tag} -m "Release ${tag}"`);

  // 10. Push
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

  // 12. GitHub release
  run(`gh release create ${tag} ./${vsixFile} --title "Release ${tag}" --notes-file ${notesFile}`);

  // 13. Publish to Marketplace
  run("npx vsce publish");

  // 14. Cleanup
  fs.unlinkSync(notesFile);

  console.log(`\n✅ Successfully released ${tag}!`);
  console.log(`   GitHub      → https://github.com/rajankarmakar/quick-snippet-generator/releases/tag/${tag}`);
  console.log(`   Marketplace → https://marketplace.visualstudio.com/items?itemName=RajanKarmaker.quick-snippet-generator`);
}

main().catch((err) => {
  console.error("❌ Release failed:", err);
  process.exit(1);
});