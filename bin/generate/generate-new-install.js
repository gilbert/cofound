import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/** Recursively copies every file from ./new-install-template to the target folder */
export async function generateNewInstall({ target }) {
  // Get the directory of the current module
  const currentFileUrl = import.meta.url;
  const currentFilePath = fileURLToPath(currentFileUrl);
  const currentDir = path.dirname(currentFilePath);

  // Resolve the source directory relative to the current file
  const sourceDir = path.join(currentDir, 'new-install-template');

  async function copyRecursively(source, destination) {
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await copyRecursively(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  try {
    await fs.mkdir(target, { recursive: true });
    await copyRecursively(sourceDir, target);
    console.log(`cos installed successfully in ${target}`);
  } catch (error) {
    console.error(`Error installing cos: ${error.message}`);
    throw error;
  }

  // Remove js files
  try {
    await fs.unlink(path.join(target, 'index.js'));
    await fs.unlink(path.join(target, '+/index.js'));
  } catch {}
}
