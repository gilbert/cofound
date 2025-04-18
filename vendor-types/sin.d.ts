declare module 'sin' {
  export type OnRemove = (cb: () => void) => void

  export type DomHandler = (dom: HTMLElement) => void | (() => void | Promise<void>)

  export type LiveValue<T> = {
    (): T
    (x: T): T
    value: T
    /**
     * Set the value of the live value
     * Examples:
     *     live(10).set(20) //=> 20
     *     live(10).set(x => x + 1) //=> 11
     */
    set(x: T): LiveValue<T>
    set(x: (x: T) => T): LiveValue<T>

    /**
     * Get and transform the value of the live value
     * Example:
     *     live(10).get(x => x + 1) //=> 11
     */
    get<U>(f: (x: T) => U): U
    // TODO: Rest of the functions
  }

  export interface HttpParams {
    method?: string
    redraw?: boolean
    responseType: any
    json?: string
    query: any
    body: any
    user: any
    pass: any
    headers?: {}
    config: any
    timeout?: number
  }

  export class View {
    level: number
    tag: string | null
    attrs: any
    key?: string
    dom: HTMLElement | null
    children: null | any[]
    component: any
  }

  interface Http {
    <T>(url: string, request?: HttpParams): Promise<T>
    redraw: () => void
  }

  export type Child = Child_no_s | s

  type Child_no_s =
    | Child[]
    | JSX.Element
    | JSX.Element[]
    | string
    | number
    | boolean
    | null
    | undefined
    | Promise<Child>

  interface ComponentFeatures {
    loading?: Child
    error?
  }

  export interface Doc {
    lang: LiveValue<string>
    head: LiveValue<JSX.Element | JSX.Element[]>
    title: LiveValue<string>
    /** Sets response headers */
    headers: LiveValue<Record<string, string>>
    /** Sets response status code */
    status: LiveValue<number>
  }

  export type ComponentContext = {
    doc: Doc
    modified?: string | false
    route: Route

    /**
     * Adds a function to be called when this component gets removed
     */
    onremove: OnRemove

    hydrating: boolean
    ignore: (x: any) => void

    refresh: (e: any) => void
    redraw: (e: any) => void
    reload: (e: any) => void
  }

  export type SsrContext = ComponentContext & {
    location: URL
  }

  export type ViewFn<T = {}> = (attrs: T, children: Child[]) => Child

  export type Component<T> = (
    attrs: T,
    children: Child[],
    ctx: ComponentContext,
  ) => Child_no_s | ViewFn<T> | Promise<ViewFn<T>>

  export type MountComponent<T> = (
    attrs: T,
    children: Child[],
    ctx: SsrContext,
  ) => Child_no_s | ViewFn<T> | Promise<ViewFn<T>>

  interface Live {
    <T>(x: T, ...args: any[]): LiveValue<T>

    from: <T, Args extends (() => any)[]>(
      args: Args,
      fn: (...args: FnArgs<Args>) => T,
    ) => LiveValue<T>

    // observe(fn: any): () => boolean
    // valueOf: () => any
    // toString: () => any
    // toJSON(): any
    // detach: () => void
    // reduce: (fn: any, initial: any, ...args: any[]) => any
    // set(x: any): (...args: any[]) => any
    // get(x: any): any
    // if(...xs: any[]): any
  }

  interface Mount {
    view: any
    attrs: {}
    context: {}
  }

  interface On {
    (target: EventTarget, event: string, fn: (event: any) => any, options?: any): () => () => any
  }

  export type RouteChangeOptions = {
    state?: any
    /** Use replaceState? (default: false) */
    replace?: boolean
    /** Trigger redraw? (default: true) */
    redraw?: boolean
    /** Scroll page to top? (default: true) */
    scroll?: boolean
  }

  interface Route {
    /** Navigate to a new path */
    (newPath: string, options?: RouteChangeOptions): void

    /** Define routes and render the matched view */
    (
      /** Example: route({ '/login': () => LoginComponent }) */
      routes: Record<
        string,
        (
          /** View function receives URL params merged with state/options */
          params: Record<string, string | undefined> & Record<string, any>,
        ) => Child
      >, // View factory returns Child type
      options?: Record<string, any>, // Attributes passed merged into params
    ): JSX.Element

    query: {
      get(key: string): string | undefined
      set(key: string, value: string | number | boolean): void
      replace(x: any): void
      clear(): void
    }

    // Check if current path starts with subPath (e.g., for active links)
    has(subPath: string): boolean

    // Current active path segment for this route level
    readonly path: string

    // URL parameters extracted from the matched path
    readonly params: Record<string, string | undefined>
  }

  // TODO: loading and error properties in first optional object argument
  export type s = {
    <T = {}>(c: Component<T>): sResult<T> & JSX.Element
    (pieces: TemplateStringsArray, ...values: any[]): sResult<T>
    (tag: string, attrs: T, ...children: Child[]): JSX.Element
    (attrs: T, children: Child[], context: ComponentContext): JSX.Element
    (attrs: T, ...children: Child[]): JSX.Element
  }

  export type sResult<T = ElemAttrs> = {
    (pieces: TemplateStringsArray, ...values: any[]): sResult<T>
    (tag: string, attrs: T, ...children: Child[]): JSX.Element
    (attrs: T, children: Child[], context: ComponentContext): JSX.Element
    (attrs: T, ...children: Child[]): JSX.Element
  }

  interface Sin {
    sleep: (x: any, ...xs: any[]) => Promise<NodeJS.Timeout>
    with: (x: any, fn: Function) => Function
    readonly isServer: boolean
    pathmode: string
    redraw: () => void
    mount<T>(view: MountComponent<T>): Mount
    mount<T>(dom: HTMLElement, view: MountComponent<T>): Mount
    animate: <T = HTMLElement>(dom: T) => (deferrable: any) => any
    http: Http
    live: Live
    route: Route
    on: On
    window: Window & typeof globalThis
    error: any
    apply: (x: JSX.Element, attrs: Record<string, any>) => JSX.Element
    trust: (pieces: TemplateStringsArray, ...values: any[]) => JSX.Element
    View: typeof View
  }

  declare const sin: Sin & s

  export default sin

  //
  // Helpers
  //
  type FnArgs<Args extends any[]> = {
    [I in keyof Args]: Args[I] extends () => infer R ? R : never
  }

  //
  // JSX Typings
  //
  type ElemAttrs = Record<string, any>

  export interface ElemFeatures {
    dom?: DomAttr
  }

  export type DomAttr = DomHandler | [DomHandler] | null | false

  declare global {
    namespace JSX {
      interface Element extends View {}
      interface IntrinsicElements {
        [elemName: string]: ElemFeatures & { [attrName: string]: any }
      }
      // For requiring properties on an component
      // interface ElementClass {}
    }

    interface ImportMeta {
      env: Record<string, string>
    }
  }
}

declare module 'sin/test' {
  declare class Test {
    type?: string
    name: string
    path: string[]
    options: any
    origin: Error
    run: any

    nest(type: string | undefined, name: string, options: any): Test
  }

  type TestBody = (() => void) | (() => Promise<void>)

  declare function TestDef(fn: TestBody): Test
  declare function TestDef(...nested: Test[]): Test

  type SinT = {
    (pieces: TemplateStringsArray, ...values: any[]): TestDef
  }
  const t: SitT
  export default SitT
}

declare module 'sin/src/view.js' {
  import { View } from 'sin'
  export default View
}

declare module 'sin/bin/color' {
  type Color =
    | 'reset'
    | 'bold'
    | 'dim'
    | 'italic'
    | 'underline'
    | 'blink'
    | 'inverse'
    | 'hidden'
    | 'strikethrough'
    | 'doubleunderline'
    | 'black'
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'
    | 'magenta'
    | 'cyan'
    | 'white'
    | 'bgBlack'
    | 'bgRed'
    | 'bgGreen'
    | 'bgYellow'
    | 'bgBlue'
    | 'bgMagenta'
    | 'bgCyan'
    | 'bgWhite'
    | 'framed'
    | 'overlined'
    | 'gray'
    | 'redBright'
    | 'greenBright'
    | 'yellowBright'
    | 'blueBright'
    | 'magentaBright'
    | 'cyanBright'
    | 'whiteBright'
    | 'bgGray'
    | 'bgRedBright'
    | 'bgGreenBright'
    | 'bgYellowBright'
    | 'bgBlueBright'
    | 'bgMagentaBright'
    | 'bgCyanBright'
    | 'bgWhiteBright'

  const c: Record<Color, (x: string) => string>
  export default c
}
