// import esbuild from 'esbuild';
// import { Module, createRequire } from 'module';
import path from "path"
import { PROJECT_DIRECTORY, DEFAULT_ROUTER_DIRECTORY } from "./const.js"
import { replaceExtension } from "./esbuild.js"

interface SSRModule {
  default: any;
}

// async function importSSRModule(mod_path: string): Promise<SSRModule | undefined> {
//   try {
//     const result = await esbuild.build({
//       entryPoints: [mod_path],
//       bundle: false,
//       write: false,
//       platform: 'node',
//       format: 'cjs',
//       jsx: 'automatic',
//       jsxFactory: 'jsx',
//       jsxImportSource: 'nexpress',
//       jsxFragment: 'Fragment',
//       //external: ['node_modules', 'esbuild']
//     });
    

//     const { outputFiles } = result;
//     //  console.log("---", mod_path, outputFiles[0].text)

//     // Assuming only one file is bundled
//     if (outputFiles.length === 1) {
//       const code = outputFiles[0].text;
//       const require = createRequire(mod_path);
//       const module = new (Module)();
//       module.require = require
//       module._compile(code, mod_path);
//       module.filename = mod_path;
//       console.log(code)
      
//       return module.exports as SSRModule;
//     } else {
//       throw new Error('Failed to bundle files.');
//     }
//   } catch (error) {
//     throw error
//   }
// }

async function importSSRModule(mod_file_path: string) {
  const mod_path = replaceExtension("file://" + mod_file_path, 'js')
  
  return await import(mod_path)
}

export {
  importSSRModule
}