import * as fs from 'fs';
import * as path from 'path';
import * as esbuild from 'esbuild';
import { ROUTE_CONFIG } from './const.js';
import { getAppConfig } from './shared-utils.js';

interface BuildOptions {
  inputDir: string;
  outputDir: string;
  extensions: typeof ROUTE_CONFIG.VALID_FILE_EXTENSIONS;
}

function replaceExtension(filePath: string, newExtension: string): string {
  const validExtensions = ROUTE_CONFIG.VALID_FILE_EXTENSIONS
  const currentExtension = path.extname(filePath) as BuildOptions['extensions'][number];

  if (!validExtensions.includes(currentExtension)) {
    // File already has a invalid extension, no need to replace
    return filePath;
  }

  // Replace the extension with the new one
  return filePath.replace(/\.[^.]+$/, `.${newExtension}`);
}


async function buildFiles(options: BuildOptions) {
  const { inputDir, outputDir, extensions, ...opts } = options;
  const files = getAllFiles(inputDir);
  let app_config: any = {}
  
  try {
    app_config = await getAppConfig()
  } catch (e) {
    console.error(new ReferenceError("nexpress.config.js is missing in your root directory."))
  }
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = path.relative(inputDir, file);
    const outputPath = replaceExtension(path.join(outputDir, relativePath), 'js'); // Always append '.js' because import() doesn't recognise jsx

    await esbuild.build(Object.assign({}, {
      entryPoints: [file],
      bundle: false,
      outfile: outputPath,
      jsx: 'automatic',
      jsxFactory: 'jsx',
      jsxImportSource: 'nexpress',
      jsxFragment: 'Fragment',
      ...opts
    }, app_config.esbuild || {}));
  }
}

function getAllFiles(directory: string) {
  const files: `${string}${BuildOptions['extensions'][number]}`[] = [];

  function walk(dir: string) {
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file) as typeof files[number] ;
      const isDirectory = fs.statSync(filePath).isDirectory();
  
      if (isDirectory) {
        walk(filePath);
      } else {
          files.push(filePath);
      }
    }
  }
  
  walk(directory)

  return files;
}


export { buildFiles, replaceExtension }