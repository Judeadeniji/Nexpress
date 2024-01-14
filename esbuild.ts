import * as fs from 'fs';
import * as path from 'path';
import * as esbuild from 'esbuild';

interface BuildOptions {
  inputDir: string;
  outputDir: string;
  extensions: string[];
}

function replaceExtension(filePath: string, newExtension: string): string {
  const regex = /\.[^.]+$/; // Match the last period and everything after
  return filePath.replace(regex, `.${newExtension}`);
}

function buildFiles(options: BuildOptions): void {
  const { inputDir, outputDir, extensions, ...opts } = options;
  const files = getAllFiles(inputDir, extensions);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = path.relative(inputDir, file);
    const outputPath = replaceExtension(path.join(outputDir, relativePath), 'js'); // Always append '.js' because import() doesn't recognise jsx

    esbuild.buildSync({
      entryPoints: [file],
      bundle: false,
      outfile: outputPath,
      jsx: 'automatic',
      jsxFactory: 'jsx',
      jsxImportSource: 'nexpress',
      jsxFragment: 'Fragment',
      ...opts
    });
  }
}

function getAllFiles(directory: string, extensions: string[]): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file);
      const isDirectory = fs.statSync(filePath).isDirectory();
  
      if (isDirectory) {
        walk(filePath);
      } else {
        if (extensions.some((ext) => file.endsWith(ext))) {
          files.push(filePath);
        }
      }
    }
  }
  
  walk(directory)

  return files;
}


export { buildFiles, replaceExtension }