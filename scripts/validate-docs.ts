import fs from "fs";
import path from "path";

const DOCS_DIR = path.resolve(process.cwd(), "docs");

// Sluggify markdown header to anchor format (GitHub compatible with Unicode)
function sluggify(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "") // keep unicode letters, digits, whitespace and dashes
    .replace(/\s+/g, "-"); // replace spaces with dashes
}

function extractHeadings(content: string): Set<string> {
  const headings = new Set<string>();
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (match) {
      headings.add(sluggify(match[1]));
    }
  }
  return headings;
}

interface ValidationIssue {
  file: string;
  link: string;
  message: string;
}

function validateDocs(): boolean {
  console.log("🔍 Validating documentation integrity in docs/...");
  const issues: ValidationIssue[] = [];

  // 1. Check forbidden directories (Single Source of Truth enforcement)
  const forbiddenDirs = ["adr"];
  for (const dir of forbiddenDirs) {
    const fullPath = path.join(DOCS_DIR, dir);
    if (fs.existsSync(fullPath)) {
      issues.push({
        file: fullPath,
        link: dir,
        message: `Forbidden redundant directory "${dir}" found. ADRs must be consolidated inside docs/design.md.`,
      });
    }
  }

  // 2. Read all markdown files in docs/
  const docFiles = fs
    .readdirSync(DOCS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.join(DOCS_DIR, file));

  const headingsByFile = new Map<string, Set<string>>();
  for (const filePath of docFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    headingsByFile.set(filePath, extractHeadings(content));
  }

  // 3. Scan links in each file
  // Match [text](url) and ![alt](url)
  const linkRegex = /!?\[[^\]]*\]\(([^)]+)\)/g;

  for (const filePath of docFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    const relFile = path.relative(process.cwd(), filePath);
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const rawTarget = match[1].trim();

      // Skip web external links and mailto
      if (
        rawTarget.startsWith("http://") ||
        rawTarget.startsWith("https://") ||
        rawTarget.startsWith("mailto:")
      ) {
        continue;
      }

      const [targetPath, anchor] = rawTarget.split("#");

      // Anchor in current file
      if (!targetPath && anchor) {
        const headings = headingsByFile.get(filePath);
        if (headings && !headings.has(anchor.toLowerCase())) {
          issues.push({
            file: relFile,
            link: rawTarget,
            message: `Anchor "#${anchor}" not found in ${relFile}.`,
          });
        }
        continue;
      }

      // Relative path check
      if (targetPath) {
        const resolvedPath = path.resolve(path.dirname(filePath), targetPath);
        if (!fs.existsSync(resolvedPath)) {
          issues.push({
            file: relFile,
            link: rawTarget,
            message: `Linked file or path "${targetPath}" does not exist (resolved: ${path.relative(process.cwd(), resolvedPath)}).`,
          });
          continue;
        }

        // If it links to another markdown file with anchor
        if (anchor && resolvedPath.endsWith(".md")) {
          const targetHeadings =
            headingsByFile.get(resolvedPath) ||
            extractHeadings(fs.readFileSync(resolvedPath, "utf-8"));
          if (!targetHeadings.has(anchor.toLowerCase())) {
            issues.push({
              file: relFile,
              link: rawTarget,
              message: `Anchor "#${anchor}" not found in target file ${path.relative(process.cwd(), resolvedPath)}.`,
            });
          }
        }
      }
    }
  }

  if (issues.length > 0) {
    console.error(
      `\nDocumentation validation failed with ${issues.length} issue(s):`
    );
    for (const issue of issues) {
      console.error(
        `  - [${issue.file}] Link "${issue.link}": ${issue.message}`
      );
    }
    return false;
  }

  console.log(
    `Documentation integrity verified across ${docFiles.length} markdown files. No broken links or orphan directories.`
  );
  return true;
}

if (!validateDocs()) {
  process.exit(1);
}
