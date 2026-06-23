import JSZip from "jszip";
import { generateReadme } from "../generators/readme-generator";

export interface ExportFile {
  path: string;
  content: string;
}

/** Build a minimal repo archive for client-side download */
export async function buildRepoArchive(
  goal: string,
  extraFiles: ExportFile[] = []
): Promise<Blob> {
  const zip = new JSZip();
  const projectName = "aetherforge-export";

  zip.file("README.md", generateReadme(projectName, goal));
  zip.file(
    "package.json",
    JSON.stringify(
      {
        name: "aetherforge-export",
        version: "1.0.0",
        scripts: { dev: "next dev", build: "next build", start: "next start" },
        dependencies: { next: "16.2.9", react: "19.2.4", "react-dom": "19.2.4" },
      },
      null,
      2
    )
  );
  zip.file(
    "src/app/page.tsx",
    `// Exported from AetherForge\nexport default function Page() {\n  return <main><h1>${goal}</h1></main>;\n}\n`
  );
  zip.file("scripts/deploy-vercel.sh", "#!/bin/bash\nvercel --prod\n");

  for (const file of extraFiles) {
    zip.file(file.path, file.content);
  }

  return zip.generateAsync({ type: "blob" });
}

/** Trigger browser download of the repo zip */
export async function downloadRepo(goal: string): Promise<void> {
  const blob = await buildRepoArchive(goal);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aetherforge-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}