import BP from "body-parser";
import cors from "cors";
import path from "node:path"
import express from "express";
import { createRouter } from "./router.js";
import { buildFiles as transformAppCode } from "./esbuild.js";
import { PROJECT_DIRECTORY, ROUTE_CONFIG } from "./const.js"
// import { initiateErrorHandler } from "./utils.js";

function createApp(opts = {}) {
    const app = express();

    app.use(BP.urlencoded({ extended: false }));
    app.use(BP.json());
    app.use(cors());
    function listen(port: number, callback?: Function, onErrorCallback?: Function) {
      transformAppCode({
        inputDir: path.join(PROJECT_DIRECTORY, "src"),
        outputDir: path.join(PROJECT_DIRECTORY, ".nexpress"),
        extensions: ROUTE_CONFIG.VALID_FILE_EXTENSIONS
      })
      createRouter(app)
      .then(() => app.listen(port, callback))
      .catch((error) => {
        console.error(error)
      });
      // initiateErrorHandler();
    }

    return { listen };
}

export {
  createApp as createNxApp
}

export * from "./jsx/index.js"