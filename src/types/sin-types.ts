// Temporary until sin repo incorporates

type Headers = Record<string, string>

//
// WARNING: These types are probably wrong
//
export type SinRouter = {
  head: HandlerDef
  get: HandlerDef
  put: HandlerDef
  post: HandlerDef
  delete: HandlerDef
  patch: HandlerDef
  options: HandlerDef
  trace: HandlerDef
  all: HandlerDef
}

type HandlerDef = ((path: string, handler: Handler) => void) & ((handler: Handler) => void)
type Handler = ((r: SinRequest) => void) | ((error: Error, r: SinRequest) => void)

export type SinRequest = {
  //
  // Incoming
  //
  /** The HTTP verb of the request. */
  method: string
  /** Contains the actual url sent by the client */
  url: string
  /** Contains the relative url for the specific handler */
  pathname: string
  /** An object containing headers. If multiple headers are found the value will be a comma separated list of values. */
  headers: Headers
  /** A URLSearchParams object for the query string. This is a getter so the URLSearchParams object will be created lazily. */
  query: URLSearchParams
  /** An object of the matched routing params like. /authors/:author/books/:book = { author: 'Murray', book: 'Ethics of Liberty' } */
  params: Record<string, string>
  /** A function which reads the incoming body and transforms it to an optional type text or json. If no type is specificed a Buffer will be returned. */
  body: (() => Promise<Buffer>) &
    ((type: 'text') => Promise<string>) &
    (<T = Record<string, any>>(type: 'json') => Promise<T>)
  /** Returns an object representing the cookie */
  cookie: ((name: string) => string | null) &
    ((name: string, value: string, options?: Record<string, string | number | boolean>) => void)

  //
  // Outgoing
  //
  status: ((code: number) => SinRequest) & (() => number)
  header: ((key: string, value: string) => SinRequest) & ((keyvals: Headers) => SinRequest)
  end: (body?: string | Buffer, status?: number, headers?: Headers) => void
  tryEnd: (body?: string | Buffer) => void
  statusEnd: (status?: number, headers?: Headers) => void
  write: () => void
  cork: () => void
  offset: () => void
  writable: () => void
  close: () => SinRequest
}
