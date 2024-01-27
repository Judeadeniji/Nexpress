import { PassThrough, Writable } from "node:stream"
import { type BufferItem, JSXNode, stringBufferToString } from "./jsx-runtime.js"

declare global {
  /**
   * The `SUSPENSE_ROOT` is a global object that holds the state of all the suspense
   * components rendered in the server.
   */
  var SUSPENSE_ROOT: {
    /**
     * The requests map is a map of RequestId x SuspenseData containing the stream to
     * write the HTML, the number of running promises and if the first suspense has
     * already resolved.
     */
    requests: Map<number | string, RequestData>;

    /**
     * This value is used (and incremented shortly after) when no requestId is provided
     * for {@linkcode renderToStream}
     *
     * @default 1
     */
    requestCounter: number;

    /**
     * If the usage of suspense is enabled.
     *
     * @default false
     */
    enabled: boolean;

    /**
     * If we should automatically stream {@linkcode SuspenseScript} before the first
     * suspense is rendered. If you disable this setting, you need to manually load the
     * {@linkcode SuspenseScript} in your HTML before any suspense is rendered. Otherwise,
     * the suspense will not work.
     *
     * @default true
     */
    autoScript: boolean;
  };
}

/** Everything a suspense needs to know about its request lifecycle. */
export type RequestData = {
  /** If the first suspense has already resolved */
  sent: boolean;

  /** How many are still running */
  running: number;

  /**
   * The stream we should write
   *
   * WeakRef requires ES2021 typings (node 14+) to be installed.
   */
  stream: WeakRef<Writable>;
};


// Avoids double initialization in case this file is not cached by
// module bundlers.
if (!globalThis.SUSPENSE_ROOT) {
  /* global SUSPENSE_ROOT */
  globalThis.SUSPENSE_ROOT = {
    requests: new Map(),
    requestCounter: 1,
    enabled: false,
    autoScript: true
  };
}

const SuspenseScript = (`
      <script id="nexpress-html-suspense">
        /*! Apache-2.0 https://kita.js.org */
        function $NEXPRESS_RC(i){
          // simple aliases
          var d=document,q=d.querySelector.bind(d),
            // div sent as the fallback wrapper
            v=q('div[id="B:'+i+'"][data-sf]'),
            // template and script sent after promise finishes
            t=q('template[id="N:'+i+'"][data-sr]'),s=q('script[id="S:'+i+'"][data-ss]'),
            // fragment created to avoid inserting element one by one
            f=d.createDocumentFragment(),
            // used by iterators
            c,j,
            // all pending hydrations
            r;

          // if div or template is not found, let this hydration as pending
          if(t&&v&&s){
            // appends into the fragment
            while(c=t.content.firstChild)
              f.appendChild(c);

            // replaces the div and removes the script and template
            v.parentNode.replaceChild(f,v);
            t.remove();
            s.remove();

            // looks for pending templates
            r=d.querySelectorAll('template[id][data-sr]');

            do{
              // resets j from previous loop
              j=0;

              // loops over every found pending template and 
              for(c=0;c<r.length;c++)
                if(r[c]!=t)
                  // let j as true while at least on $NEXPRESS_RC call returns true
                  j=$NEXPRESS_RC(r[c].id.slice(2))?!0:j;
            }while(j)

            // we know at least the original template was substituted
            return!0;
          }
        }
      </script>
    `)
  .replace(/^\s*\/\/.*/gm, '')
  // Removes line breaks added for readability
  .replace(/\n\s*/g, '');
  
function Suspense(props: JSX.JSXProps) {
  // There's no actual way of knowing if this component is being
  // rendered inside a renderToString call, so we have to rely on
  // this simple check: If the First Suspense render is called without
  // `enabled` being true, it means no renderToString was called before.
  // This is not 100% accurate, but it's the best estimation we can do.
  if (!SUSPENSE_ROOT.enabled) {
    throw new Error('Cannot use Suspense outside of a `renderToStream` call.');
  }

  const fallback = props?.fallback ? childrenToString([props.fallback]) : false;
  
  if (!props.children) {
    return '';
  }
  
  const children = childrenToString(props.children)
  
  let data = SUSPENSE_ROOT.requests.get(props.rid);

  if (!data) {
    return;
    throw new Error(
      'Request data was deleted before all suspense components were resolved.'
    );
  }

  // Gets the current run number for this request
  // Increments first so we can differ 0 as no suspenses
  // were used and 1 as the first suspense component
  const run = ++data.running;
  
  children
    .then(writeStreamTemplate)
    .catch(function errorRecover(error) {
      // No catch block was specified, so we can
      // re-throw the error.
      if (!props.catch) {
        throw error;
      }

      let html;

      // unwraps error handler
      if (typeof props.catch === 'function') {
        html = props.catch(error);
      } else {
        html = props.catch;
      }

      // handles if catch block returns a string
      if (typeof html === 'string') {
        return writeStreamTemplate(html);
      }

      // must be a promise
      return html.then(writeStreamTemplate);
    })
    .catch(function writeFatalError(error) {
      if (data) {
        const stream = data.stream.deref();

        // stream.emit returns true if there's a listener
        // so we can safely ignore the error
        if (stream && stream.emit('error', error)) {
          return;
        }
      }
      /* c8 ignore next 2 */
      // Nothing else to do if no catch or listener was found
      console.error(error);
    })
    .finally(function clearRequestData() {
      // Reloads the request data as it may have been closed
      data = SUSPENSE_ROOT.requests.get(props.rid);

      if (!data) {
        return;
      }

      // reduces current suspense id
      if (data.running > 1) {
        data.running -= 1;

        // Last suspense component, runs cleanup
      } else {
        const stream = data.stream.deref();

        if (stream && !stream.closed) {
          stream.end();
        }

        // Removes the current state
        SUSPENSE_ROOT.requests.delete(props.rid);
      }
    });

  // Keeps string return type
  if (typeof fallback === 'string') {
    return '<div id="B:' + run + '" data-sf>' + fallback + '</div>';
  }

  return fallback ? fallback.then(async function resolveCallback(resolved) {
    return '<div id="B:' + run + '" data-sf>' + await stringBufferToString(resolved) + '</div>';
  }) : '<div id="B:' + run + '" data-sf>' + "<h1>Hello fallback</h1>" + '</div>';

  /**
   * This function may be called by the catch handler in case the error could be handled.
   *
   * @param {string} result
   */
  async function writeStreamTemplate(result) {
    // Reloads the request data as it may have been closed
    data = SUSPENSE_ROOT.requests.get(props.rid);

    if (!data) {
      return;
    }

    const stream = data.stream.deref();

    // Stream was probably already closed/cleared out.
    // We can safely ignore this.
    if (!stream || stream.closed) {
      return;
    }

    // Writes the suspense script if its the first
    // suspense component in this request data. This way following
    // templates+scripts can be executed
    if (SUSPENSE_ROOT.autoScript && data.sent === false) {
      stream.write(SuspenseScript);
      data.sent = true;
    }

    // Writes the chunk
    stream.write(
      // prettier-ignore
      '<template id="N:' + run + '" data-sr>' + await stringBufferToString(result) + '</template><script id="S:' + run + '" data-ss>$NEXPRESS_RC(' + run + ')</script>'
    );
  }
}

async function childrenToString (children) {
  try {
    return children.map((child) => child.toString());
  } catch (err) {
    if (err instanceof Promise) {
      await err;
      return childrenToString(children);
    } else {
      throw err;
    }
  }
};

function renderToStream(j: JSX.Element) {
  const rid = SUSPENSE_ROOT.requestCounter++;
  const stream = new PassThrough()
  const originalPipe = stream.pipe
  let promiseCount = 0;
  
  // Enables suspense if it's not enabled yet
  if (SUSPENSE_ROOT.enabled === false) {
    SUSPENSE_ROOT.enabled = true;
  }
  
  SUSPENSE_ROOT.requests.set(rid, {
    stream: new WeakRef(stream),
    running: 0,
    sent: false
  });
  
  function serializer(buffer: BufferItem[]) {
    let str = ""
    const buffer2 = [...buffer].reverse()
    
    for (const buff of buffer2) {
      if (buff instanceof Promise) {
        promiseCount++
        str += "<!--/$-->"
        buff.then(a => {
          if (a instanceof JSXNode) {
            const b = a.toString(serializer)
            if (b) {
              stream.write(b)
              promiseCount--
              if (promiseCount === 0) stream.end()
            }
          }
        })
      } else {
        str += buff
      }
    }
    
    stream.write(str);
    if ((promiseCount === 0) && !stream.closed) stream.end()
  }
  
  stream.pipe = function pipe(destination, option) {
    const w = originalPipe.call(stream, destination)
    j.toString(serializer)
    return w
  } as typeof originalPipe

  
  return stream
}


export {
  renderToStream,
  Suspense
}
