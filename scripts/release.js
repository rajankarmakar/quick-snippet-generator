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

  let lastTag = "";
  try {
    lastTag = runSilent("git describe --tags --abbrev=0");
  } catch {
    // No previous tag — use all commits
  }

  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  let commits = "";
  try {
    commits = runSilent(`git log ${range} --pretty=format:"%s|%h" --no-merges`);
  } catch {
    commits = "";
  }

  const lines = commits ? commits.split("\n").filter(Boolean) : [];

  const sections = {
    feat:     { title: "### 🚀 Features",      items: [] },
    fix:      { title: "### 🐛 Bug Fixes",      items: [] },
    perf:     { title: "### ⚡ Performance",    items: [] },
    refactor: { title: "### ♻️  Refactoring",   items: [] },
    docs:     { title: "### 📝 Documentation",  items: [] },
    chore:    { title: "### 🔧 Chores",         items: [] },
    other:    { title: "### 📦 Other",          items: [] },
  };

  const repoUrl = "https://github.com/rajankarmakar/quick-snippet-generator";

  for (const line of lines) {
    const [message, hash] = line.split("|");
    const match = message.match(/^(\w+)(\(.+?\))?!?:\s*(.+)/);
    const shortLink = `[\`${hash}\`](${repoUrl}/commit/${hash})`;

    if (match) {
      const type = match[1];
      const scope = match[2] ? match[2].replace(/[()]/g, "") + ": " : "";
      const desc = match[3];
      const entry = `- ${scope}${desc} (${shortLink})`;
      (sections[type] ?? sections.other).items.push(entry);
    } else {
      sections.other.items.push(`- ${message} (${shortLink})`);
    }
  }

  const date = new Date().toISOString().split("T")[0];
  let block = `## [${version}](${repoUrl}/releases/tag/v${version}) — ${date}\n\n`;

  for (const key of Object.keys(sections)) {
    if (sections[key].items.length > 0) {
      block += `${sections[key].title}\n\n${sections[key].items.join("\n")}\n\n`;
    }
  }

  if (lines.length === 0) block += "_No changes logged._\n\n";

  const existing = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8")
    : "";

  const hasHeader = existing.startsWith("# Changelog");
  const header = "# Changelog\n\nAll notable changes to this project will be documented here.\n\n";
  const body = hasHeader
    ? existing.replace("# Changelog\n", `# Changelog\n\n${block}`)
    : header + block + existing;

  fs.writeFileSync(changelogPath, body);
  console.log("✅ CHANGELOG.md updated");
  return block;
}

async function main() {
  // 1. Clean working tree
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

  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const version = pkg.version;
  const tag = `v${version}`;
  console.log(`\n📦 Preparing release ${tag}`);

  // 5. Generate changelog
  generateChangelog(version);

  // 6. Commit changelog + version bump
  run("git add package.json CHANGELOG.md");
  run(`git commit -m "chore(release): ${tag}"`);

  // 7. Create annotated tag
  run(`git tag -a ${tag} -m "Release ${tag}"`);

  // 8. Push commit + tag — this triggers GitHub Actions to publish
  run("git push origin main --follow-tags");

  console.log(`\n✅ Tag ${tag} pushed — GitHub Actions will now package and publish.`);
  console.log(`   Monitor: https://github.com/rajankarmakar/quick-snippet-generator/actions`);
}

main().catch((err) => {
  console.error("❌ Release failed:", err);
  process.exit(1);
});