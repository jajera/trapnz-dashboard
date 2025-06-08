import fs from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.TRAPNZ_WFS_TOKEN;
if (!token) {
  throw new Error('TRAPNZ_WFS_TOKEN environment variable is not set');
}

async function main() {
  const projectsPath = path.join(__dirname, '../data/projects.json');
  const projectsData = JSON.parse(await fs.readFile(projectsPath, 'utf-8'));
  const projects = projectsData.projects;
  const allTraps = [];

  for (const project of projects) {
    const url = `https://io.trap.nz/geo/trapnz-projects/wfs/${token}/${project.id}?service=WFS&version=2.0.0&request=GetFeature&typeName=trapnz-projects:default-project-trap-records&outputFormat=application/json`;
    console.log(`Fetching traps for project: ${project.name} (${project.id})`);
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Failed to fetch for project ${project.id}: ${resp.status}`);
      continue;
    }
    const data = await resp.json();
    allTraps.push(...data.features.map(feature => ({
      ...feature.properties,
      geometry: feature.geometry,
      projectId: project.id
    })));
  }

  const outputDir = path.join(__dirname, '../public/data');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'traps.json'),
    JSON.stringify({ traps: allTraps }, null, 2)
  );
  console.log('Trap data written to public/data/traps.json');

  // Copy projects.json for frontend use
  await fs.copyFile(
    path.join(__dirname, '../data/projects.json'),
    path.join(outputDir, 'projects.json')
  );
  console.log('Project list copied to public/data/projects.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 