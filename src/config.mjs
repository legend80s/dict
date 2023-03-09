import { join } from 'node:path'
import fs from 'node:fs'
import { homedir } from 'node:os';

// cannot be .mjs because it's generated dynamically so must be `required`.
export const rcFilepath = `${homedir()}/ydd-data.js`;

const header = `
// You can delete this file whenever.
// https://www.npmjs.com/package/ydd
`.trim();

/**
* @param {Record<string, any>} config
*/
export function writeFullConfig(config) {
  const content = `module.exports = ${JSON.stringify(config, null, 2)}`;

  fs.writeFileSync(
    rcFilepath,
    `${header}\n${content}\n`
  )
}
