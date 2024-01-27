import BP from "body-parser";
import cors from "cors";
import path from "node:path"
import express, { Handler, IRouterHandler, Request, Response } from "express";
import { createRouter } from "./router.js";
import { buildFiles as transformAppCode } from "./esbuild.js";
import { PROJECT_DIRECTORY, ROUTE_CONFIG } from "./const.js"
import { NExpressContext } from "./server_context/index.js";

// import { initiateErrorHandler } from "./utils.js";




function createApp(opts = {}) {
    const app = express();

    app.use(BP.urlencoded({ extended: false }));
    app.use(BP.json());
    app.use(cors());
    function listen(port: number, hostname: string, backlog: number, callback?: (() => void) | undefined) {
      transformAppCode({
        inputDir: path.join(PROJECT_DIRECTORY, "src"),
        outputDir: path.join(PROJECT_DIRECTORY, ".nexpress"),
        extensions: ROUTE_CONFIG.VALID_FILE_EXTENSIONS
      })
      .then(() => {
        createRouter(app)
        .then(() => app.listen(port, hostname, backlog, callback ))
        .catch((error) => {
          console.error(error)
        });
      })
      .catch(e => {
        console.error(e)
        process.exit(1)
      })
      // initiateErrorHandler();
    }

    const res = { listen, use, set }

    function use(...handlers: any[]) {
      app.use(...handlers)
      return res
    }
    
    function set(a, b) {
      app.set(a, b)
      return res
    }

    return res;
}


export {
  createApp as createNxApp,
}

export * from "./jsx.experimental/index.js"
// export * from "./jsx/components.js"


// export types
export {
  Handler,
  Request,
  Response,
  NExpressContext
}

export * from './types.js'