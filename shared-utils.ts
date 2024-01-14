import path from "node:path";
import { PROJECT_DIRECTORY, DEFAULT_ROUTER_DIRECTORY } from "./const.js"
import { replaceExtension } from "./esbuild.js"

async function importSSRModule(mod_file_path: string) {
  const mod_path = replaceExtension("file://" + mod_file_path, 'js')
  
  return await import(mod_path)
}

async function getAppConfig() {
  return (await importSSRModule(path.join(PROJECT_DIRECTORY, 'nexpress.config.js'))).default
}

export {
  importSSRModule
}