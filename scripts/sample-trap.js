import fs from 'fs/promises';

async function main() {
  const data = JSON.parse(await fs.readFile('public/data/traps.json', 'utf-8'));
  if (data.traps && data.traps.length > 0) {
    console.log(JSON.stringify(data.traps[0], null, 2));
  } else {
    console.log('No traps found.');
  }
}

main(); 