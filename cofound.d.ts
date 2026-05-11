type Vars = {
    /**
     * The CSS property name.
     *
     * > Will represent either the shorthand or native naming
     */
    property: string;
    /**
     * The CSS applied unit (defaults to `px`)
     *
     * > If property name does not expect a numeric value this will be empty string
     *
     * @default ''
     */
    unit: string;
    /**
     * The 0-based index occurence within the tagged literal expression
     */
    index: number;
    /**
     * Flags opacity transformation for CSS vars, which defaults to `false`.
     * Value will be a function if an opacity modifier (e.g, `/50`) is detected.
     *
     * @default false
     */
    transform: false | ((x: number | string) => string);
    /**
     * Array of CSS function names (e.g, `['calc','translateY']` etc) that are
     * applied to the CSS variable value, sliced from the parsing stack.
     *
     * @default []
     */
    fns: string[];
    /**
     *  Arbitrary signature for dynamic CSS Variables `--vars`
     */
    [key: `--${string}`]: any;
};
type CSS = {
    /**
     * CSS Style Sheet - Write classes and define cascade specifics.
     *
     * @example
     * // 𓋹 Blessed be the vain and holy aesthetic
     *
     * s.css`
     *  .dark {
     *    color hotpink
     *    background black
     *  }
     * `
     */
    (css: TagLiteral, ...interpolate: Interpolate[]): () => View;
    (css: string): () => View;
    /**
     * Sets aliases for CSS media queries, feature supports or anything that is blocked scoped.
     *
     * @example
     * // 𓋹 Decree the bounds and etch the queries
     *
     * s.css.alias({
     *  mobile: '@media (max-width: 767px)',
     *  tablet: '@media (max-width: 1200px)'
     * });
     *
     */
    alias: {
        (id: string, as: string): string;
        (alias: Record<string, string>): string;
    };
    /**
     * Applies global CSS Resets and/or overwrites.
     *
     * > **PLEASE NOTE**
     * >
     * > Sin will apply a subset of normalisation resets
     * > and merge with the provided cascades.
     *
     * @example
     * // 𓋹 The sinners hand wipes clean the slate
     *
     * s.css.reset`
     *  body {
     *   ff Arial
     *   fs 15
     *  }
     * `
     */
    reset: {
        (css: TagLiteral, ...interpolate: Interpolate[]): void;
        (css: string): void;
    };
    /**
     * CSS custom unit control
     *
     * @example
     *
     * // Option 1 - key > value
     * s.css.unit('n', (value, property) => (x * .25) + 'rem' )
     *
     * // Option 2 - as object
     * s.css.unit({ n: (value, property) => (x * .25) + 'rem' })
     */
    unit: {
        (id: string, fn: (value: string, property: string) => string): void;
        (units: Record<string, (value: string, property: string) => string>): void;
    };
    /** @deprecated Omitted in Sin */ arguments?: never;
    /** @deprecated Omitted in Sin */ prototype?: never;
    /** @deprecated Omitted in Sin */ apply?: never;
    /** @deprecated Omitted in Sin */ call?: never;
    /** @deprecated Omitted in Sin */ caller?: never;
    /** @deprecated Omitted in Sin */ bind?: never;
    /** @deprecated Omitted in Sin */ length: never;
    /** @deprecated Omitted in Sin */ name?: never;
    /** @deprecated Omitted in Sin */ toString?: never;
    /** @deprecated Omitted in Sin */ valueOf?: never;
    /** @deprecated Omitted in Sin */ Symbol?: never;
};

/**
 * Sin DOM
 *
 * A custom element which will inherit all DOM Element attributes.
 * The `DOM` is a proxy type over `HTMLElement` and contains
 * the virtual element schema of sin nodes.
 */
interface DOM extends HTMLElement, SinAttributes<DOM> {
}
/**
 * Component Nodes
 *
 * An array of {@link Children}
 */
interface Nodes extends Array<Children> {
}
/**
 * DAFT - Default Argument Function Thunk
 */
type Daft = <T = any>(...args: T[]) => Child;
/**
 * Child node [Primitive](https://developer.mozilla.org/en-US/docs/Glossary/Primitive).
 */
type Primitive = string | number | boolean | null | undefined;
/**
 * Component Children
 */
type Children = Primitive | Node | Daft | Child | Nodes;
/**
 * Component Children
 */
type Views = Exclude<Children, Record<string, unknown>>;
/**
 * The child node of a component
 */
type Child = View | string | number | Nodes | Node | Daft;
/**
 * Component Node
 *
 * An array of nodes in a sin component
 */
type Node = Nodes | string | number;
/**
 * Sin components will return a View interface
 *
 * @example
 *
 * s`button`('Hello Sinner!') // => View
 */
type View<T = {}> = {
    /**
     * Sin Children (child nodes)
     */
    readonly children: Array<Primitive | Daft | View>;
    /**
    * A hashmap of DOM attributes, events, properties and lifecycle methods of a component.
    */
    readonly attrs: T;
    /**
     * The value used to map a DOM element to its respective item in an array of data.
     */
    readonly key: any;
    /**
     * The nesting index of the Sin Element
     */
    readonly nesting: number;
    /**
     * Reference to the function (or [fn, options] pair) that defines how the view should render/update.
     */
    readonly component: undefined | Function | [Function, Record<string, any>];
    /**
     * Tag reference describing the syntactic markup on the node
     */
    readonly tag: {
        /**
         * The `nodeName` of a DOM element, as per the markup case.
         *
         * @example
         *
         * const node = s`button`('Vain is the pride of the wicked');
         *
         * console.log(node.tag.name) // 'button'
         */
        readonly name: string;
        /**
         * The elements attribute `id=""` value
         *
         * @default
         * ''
         *
         * @example
         *
         * const node = s`#sinner`('Seek Atonement');
         *
         * console.log(node.tag.id) // 'sinner'
         */
        readonly id: string;
        /**
         * The elements attribute `class=""` value. This value will
         * hold reference to the CSS class name passed or sin shorthand
         * expressions hash values.
         *
         * @default
         * ''
         *
         * @example
         *
         * const a = s`a.xxx`('Lustful Intent');
         * const b = s`a bc red`('Immorality');
         *
         * console.log(a.tag.classes) // 'xxx'
         * console.log(b.tag.classes) // 's1n666' (hashed value)
         */
        readonly classes: string;
        /**
         * The `parent` tag reference.
         *
         * @default undefined
         */
        readonly parent: View['tag'];
        /**
         * Holds the raw tag template literal parameters
         *
         * > **NOTE**
         * >
         * > This is a readonly value that is primarily for internal usage
         * > and has been derived from the parsing stack.
         *
         * @default
         * [] // empty array when no interpolation
         *
         * @example
         *
         * const { tag } = s`h1 color ${'red'} h ${666}`('Sinner!');
         *
         * console.log(tag.args) // ['red', 666]
         */
        readonly args: any[];
        /**
         * Corresponding CSS Variables expressed in the tagged literal.
         *
         * > **NOTE**
         * >
         * > This is a readonly value that is primarily for internal usage
         * > and has been derived from the parsing stack.
         *
         * @default
         * {} // empty object if no vars
         */
        readonly vars: Record<`--${string}`, Vars>;
    };
};

/**
 * Sin `attrs` generic type default
 */
type Attrs = {
    [prop: string]: any;
};
/**
 * Returns boolean `true` if type is Record
 */
type IsMergable<U> = U extends Record<string, any> ? true : false;
/**
 * Returns boolean `true` if  type is `array` (`any[]`) otherwise `false`
 */
type isArray<T> = T extends any[] ? true : false;
/**
 * Returns boolean `true` if type is `null` otherwise `false`
 */
type isNull<T> = [T] extends [null] ? true : false;
/**
 * Returns boolean `true` if type is `never` otherwise `false`
 */
type isNever<T> = [T] extends [never] ? true : false;
/**
 * Returns boolean `true` if type is `unknown` otherwise `false`
 */
type isUnknown<T> = unknown extends T ? isNull<T> extends false ? true : false : false;
/**
 * Conditional Utility for checking `unknown` Type
 */
type ifUnknown<T, True, False> = isUnknown<T> extends true ? True : False;
/**
 * Conditional Utility for checking `unknown` Type
 */
type ifNever<T, True, False> = isNever<T> extends true ? True : False;
/**
 * Conditional Utility for checking whether `never` or `unknown` Type
 */
type ifInferred<T, True, False> = ifUnknown<T, True, ifNever<T, True, False>>;
/**
 * Omit index signatures present in an object
 */
type OmitIndex<T> = {
    [K in keyof T as {} extends Record<K, unknown> ? never : K]: T[K];
};
/**
 * Assign Helper for object merges
 */
type Assign<T, U> = {
    [K in keyof T as K extends keyof U ? never : K]: T[K];
} & U;
/**
 * Merge two objects together
 */
type Merge<T, U> = Cast<Assign<PickIndex<T>, PickIndex<U>> & Assign<OmitIndex<T>, OmitIndex<U>>>;
/**
 * Sync void type, uses 'unknown' for safer `any` - like (forces type checks)
 */
type SyncVoid = void | unknown;
/**
 * Promises resolving to sync voids
 */
type AsyncVoid = Promise<SyncVoid>;
/**
 * Callback type for element events
 */
type Void = SyncVoid | AsyncVoid;
/**
 * Allows literal unions to persist without sacraficing auto-complete
 *
 * @example
 *
 * StringUnion<'devils' | 'advocate'> // default to string
 */
type StringUnion<T> = T | (string & Record<never, never>);
/**
 * Conditional check to see whether `K` exists in `T`
 */
type Has<T, K extends string, True, False> = K extends keyof T ? True : False;
/**
 * Pick only index signatures from the given object type, leaving out all explicitly defined properties.
 *
 * @example
 *
* interface Sins {
*    [name: string]: unknown;
*    blasphemy: boolean;
* }
*
* PickIndex<Sins> // => { [name: string]: unknown; }
*/
type PickIndex<T> = {
    [K in keyof T as {} extends Record<K, unknown> ? K : never]: T[K];
};
/**
 * Transform an interface into a type to aide with assignability.
 *
 * @example
 *
 * interface Penance {
 *    given: boolean;
 *    sin: string;
 * }
 *
 * const sinner: Cast<Penance>;
 *
 * // OR
 *
 * type A = { right: number; };
 * type B = { left: number; };
 *
 * Simple<A & B>
 */
type Cast<T> = {
    [K in keyof T]: T[K];
} & {};
/**
 * Sugar assignment of `TemplateStringsArray`
 */
interface TagLiteral extends ReadonlyArray<string> {
    readonly raw: readonly string[];
}
/**
 * TagLiteral Interpolation
 */
type Interpolate = string | ((dom: HTMLElement) => Primitive);
/**
 * Promise shorthand
 */
type P<T> = Promise<T> | T;

/**
 * A reactive stream created by `s.live`, supporting any type.
 */
type Live<T> = {
    /**
     * Get the current value if called with no arguments, or set a new value and return it.
     *
     * @example
     * const sin = s.live(0)
     * sin() // -> 0
     * sin(1) // -> 1
     *
     * const name = s.live("loki")
     * name() // -> "loki"
     */
    (value?: T): T;
    /**
     * The current value of the live stream.
     *
     * @example
     * s.live(10).value // -> 10
     * s.live("thor").value // -> "thor"
     */
    readonly value: T;
    /**
     * Returns the value, enabling coercion in operations (e.g., `live + 1` for numbers).
     *
     * @example
     * const sin = s.live(10)
     * sin.valueOf() // -> 10
     * sin + 1 // -> 11 (when T is number)
     */
    valueOf: () => T;
    /**
     * Returns the value for JSON serialization.
     *
     * @example
     * s.live(10).toJSON() // -> 10
     */
    toJSON: () => T;
    /**
     * Returns the stringified value.
     *
     * @example
     * s.live(10).toString() // -> "10"
     * s.live("loki").toString() // -> "loki"
     */
    toString: () => string;
    /**
     * Derive a new live value from a property or function.
     *
     * @example
     * const a = s.live(10)
     * a.get(x => x + 1)() // -> 11
     * s.live({ name: "loki" }).get("name")() // -> "loki"
     */
    get: <U>(x: keyof T | ((value: T) => U)) => Live<U>;
    /**
     * Set the value, either directly or via a function, returning a function that applies it.
     *
     * @example
     * const sin = s.live(10)
     * sin.set(20)() // -> sin with value 20
     * sin.set(x => x + 10)() // -> sin with value 20
     *
     * const name = s.live("loki")
     * name.set("thor")() // -> name with value "thor"
     */
    set: (x: T | ((...args: any[]) => T)) => (...args: any[]) => Live<T>;
    /**
     * Observe value changes, returning a function to unsubscribe.
     *
     * @example
     * const sin = s.live(0)
     * const detach = sin.observe((newVal, oldVal) => console.log(newVal, oldVal))
     * sin(1) // -> Logs: 1, 0
     */
    observe: (fn: (newValue: T, oldValue: T, detach: () => void) => void, once?: boolean) => () => boolean;
    /**
     * Detach observers (no-op if none).
     *
     * @example
     * s.live(10).detach()
     */
    detach: () => void;
    /**
     * Reduce values into a new Live stream.
     *
     * @example
     * const sin = s.live(0)
     * const total = sin.reduce((acc, val) => acc + val, 0)
     * sin(1) // -> total() becomes 1
     *
     * const text = s.live("")
     * const concat = text.reduce((acc, val) => acc + val, "prefix")
     * text("x") // -> concat() becomes "prefixx"
     */
    reduce: <U>(fn: (acc: U, value: T, index: number) => U, initial?: U) => Live<U>;
    /**
     * Conditionally return a value based on equality.
     *
     * - No extra args: Returns Live<boolean> (true/false).
     * - One extra arg: Returns Live<U | false>.
     * - Two extra args: Returns Live<U | V>.
     *
     * @example
     * const a = s.live(666)
     * a.if(666)() // -> true
     * a.if(777, 1)() // -> false
     * a.if(777, 1, 0)() // -> 0
     *
     * const name = s.live("loki")
     * name.if("loki")() // -> true
     * name.if("thor", "yes", "no")() // -> "no"
     */
    if: <U = true, V = false>(equals: T, isTrue?: U, isFalse?: V) => [U, V] extends [
        undefined,
        undefined
    ] ? Live<boolean> : [U] extends [undefined] ? Live<boolean> : Live<U | V>;
    /** @deprecated Omitted in Sin */ arguments?: never;
    /** @deprecated Omitted in Sin */ prototype?: never;
    /** @deprecated Omitted in Sin */ apply?: never;
    /** @deprecated Omitted in Sin */ call?: never;
    /** @deprecated Omitted in Sin */ caller?: never;
    /** @deprecated Omitted in Sin */ bind?: never;
    /** @deprecated Omitted in Sin */ length: never;
    /** @deprecated Omitted in Sin */ name?: never;
    /** @deprecated Omitted in Sin */ Symbol?: never;
};
type SinLive = {
    /**
     * Create a Live instance with an initial value and optional observers.
     * Returns Live<T> & T when T is a number for arithmetic support.
     *
     * @example
     * const sin = s.live(0)
     * const name = s.live("loki")
     */
    <T>(value: T, ...observers: ((newValue: T, oldValue: T, detach: () => void) => void)[]): T extends number ? Live<T> & T : Live<T>;
    (): Live<any>;
    /**
     * Create a Live instance from other Live instances and a computation.
     *
     * @example
     * const a = s.live(2)
     * const b = s.live(3)
     * const sum = s.live.from(a, b, (x, y) => x + y)
     * sum() // -> 5
     *
     * const x = s.live("x")
     * const y = s.live("y")
     * const concat = s.live.from(x, y, (a, b) => a + b)
     * concat() // -> "xy"
     */
    from<U>(...args: [...streams: Live<any>[], fn: (...values: any[]) => U]): U extends number ? Live<U> & U : Live<U>;
    /** @deprecated Omitted in Sin */ arguments?: never;
    /** @deprecated Omitted in Sin */ prototype?: never;
    /** @deprecated Omitted in Sin */ apply?: never;
    /** @deprecated Omitted in Sin */ call?: never;
    /** @deprecated Omitted in Sin */ caller?: never;
    /** @deprecated Omitted in Sin */ bind?: never;
    /** @deprecated Omitted in Sin */ length: never;
    /** @deprecated Omitted in Sin */ name?: never;
    /** @deprecated Omitted in Sin */ toString?: never;
    /** @deprecated Omitted in Sin */ valueOf?: never;
    /** @deprecated Omitted in Sin */ Symbol?: never;
};

/**
 * Sin Doc
 */
type Doc = {
    /**
     * Set the documents `<html lang="">` value
     *
     * @example
     *
     * s.lang('en');
     */
    lang: Live<string>;
    /**
     * Renders elements within document `<head>`
     *
     * @example
     *
     * s.mount(({}, [], { doc }) => doc.head([
     *
     *  s`link`({ rel: 'manifest' href: '/site.webmanifest' })
     *
     * ]))
     */
    head: (children: Children) => View;
    /**
     * Sets the document `<title>` value.
     *
     * @default ''
     * @example
     *
     * s.mount(({}, [], { doc }) => {
     *
     *  // Set the document title
     *  doc.title('Welcome Sinners!')
     * })
     */
    title: Live<string>;
    /**
     * Sets the HTTP Response headers.
     *
     * @example
     *
     * s.headers({
     *  'x-request-with': 'sin'
     * })
     */
    headers: Live<Record<string, string>>;
    /**
     * Sets the HTTP Response status code
     *
     * @default 200;
     *
     * @example
     *
     * s.status(301);
     */
    status: Live<number>;
};

/**
 * Route handler options argument type
 *
 * @example
 *
 * s.route({ '/': () => [] }, {
 *   replace: false,
 *   scroll: true,
 *   state: {}
 * })
 */
type Options<State = {}> = {
    /**
     * History pushState replace
     *
     * @default false
     */
    replace?: boolean;
    /**
     * Scroll restoration
     *
     * @default true
     */
    scroll?: boolean;
    /**
     * History pushState state object
     *
     * @default {}
     */
    state?: State;
};
/**
 * Route `query` value interface
 *
 * @example
 *
 * s.route.query // Route.Query
 */
type Query = {
    /**
     * Returns the current query parameters as string
     *
     * @example
     *
     * // ?garden=eden&fruit=apple
     *
     * s.route.query() // -> ?garden=eden&fruit=apple
     */
    (): string;
    /**
     * A number indicating the total number of search parameter entries:
     *
     * @example
     *
     * // ?garden=eden&fruit=apple
     *
     * s.route.query.size // -> 2
     *
     */
    readonly size: number;
    /**
     * Get a query parameter value
     *
     * @example
     *
     * // ?garden=eden&fruit=apple
     *
     * s.route.query.get('fruit') // -> apple
     */
    get: (key: string) => string | null;
    /**
     * Returns all the values associated with a given search parameter as an array.
     *
     * @example
     *
     * // ?person=adam&garden=eden&person=eve
     *
     * s.route.query.getAll('person') // => ['adam', 'eve']
     */
    getAll: (name: string) => string[];
    /**
     * Set a query parameter value
     *
     * @example
     *
     * // ?person=adam
     *
     * s.route.query.set('person', 'eve')  // -> ?person=eve
     */
    set: <T extends string | number | boolean>(key: string, value: T) => void;
    /**
     * Returns a boolean value that indicates whether the specified parameter is in the search parameters.
     *
     * @example
     *
     * // ?garden=eden&fruit=apple
     *
     * s.route.query.has('garden') // -> true
     * s.route.query.has('person') // -> false
     * s.route.query.has('fruit', 'apple') // -> true
     */
    has: (name: string, value?: string) => boolean;
    /**
     * Returns an iterator allowing iteration through all keys contained in query parameters.
     *
     * @example
     *
     * // ?garden=eden&fruit=apple&person=eve
     *
     * for(const key of s.route.query.keys()) {
     *   p(key)
     * }
     *
     * // -> 'eden'
     * // -> 'apple'
     * // -> 'eve'
     */
    keys: () => IterableIterator<string>;
    /**
     * Returns an iterator allowing iteration through all values contained in query parameters.
     *
     * @example
     *
     * // ?garden=eden&fruit=apple&person=eve
     *
     * for(const value of s.route.query.values()) {
     *   p(value)
     * }
     *
     * // -> 'eden'
     * // -> 'apple'
     * // -> 'eve'
     */
    values: () => IterableIterator<string>;
    /**
     * Returns an iterator allowing iteration through all values contained in query parameters.
     *
     * @example
     *
     * // ?garden=eden&person=eve
     *
     * for(const [key, value] of s.route.query.entries()) {
     *    p(`${key}, ${value}`)
     * }
     *
     * // -> 'garden, eden'
     * // -> 'person, eve'
     */
    entries: () => IterableIterator<[key: string, value: string]>;
    /**
     * Delete query parameter
     *
     * @example
     * // ?garden=eden&fruit=apple
     *
     * s.route.query.delete('fruit') // -> ?garden=eden
     */
    delete: (key: string) => string | null;
    /**
     * Appends a specified key/value pair as a new search parameter.
     *
     * @example
     *
     * // -> ?garden=eden
     *
     * s.route.query.append('fruit', 'apple') // -> ?garden=eden&fruit=apple
     */
    append: (name: string, value: string) => void;
    /**
     * Replaces query parameters. Accepts object or string
     *
     * @example
     *
     * // ?adam=male&eve=female
     *
     * s.route.query.replace({
     *   adam: 'male',
     *   eve: 'female',
     * })
     */
    replace: <T extends Record<string, string | number | boolean> | string>(params: T) => URLSearchParams;
    /**
     * Sorts all key/value pairs of query parameters and returns undefined. Key/value pairs are
     * sorted by the values of the UTF-16 code units of the keys. This method uses a stable
     * sorting algorithm (i.e., the relative order between key/value pairs with equal keys
     * will be preserved).
     *
     * @example
     *
     * s.route.query.sort()
     */
    sort: () => void;
    /**
     * Clear/remove the query parameters from URL
     *
     * @example
     *
     * s.route.query.clear()
     */
    clear: () => void;
    /**
     * Iteration through all values contained in query parameters
     *
     * @example
     *
     * s.route.query.forEach((value, key) => {
     *    p(`${key}, ${value}`)
     * })
     *
     * // -> 'garden, eden'
     * // -> 'person, eve'
     */
    forEach: (callback: (value: string, key: string) => void) => void;
    /** @deprecated Omitted in Sin */ arguments?: never;
    /** @deprecated Omitted in Sin */ prototype?: never;
    /** @deprecated Omitted in Sin */ apply?: never;
    /** @deprecated Omitted in Sin */ call?: never;
    /** @deprecated Omitted in Sin */ caller?: never;
    /** @deprecated Omitted in Sin */ bind?: never;
    /** @deprecated Omitted in Sin */ length: never;
    /** @deprecated Omitted in Sin */ name?: never;
    /** @deprecated Omitted in Sin */ valueOf?: never;
    /** @deprecated Omitted in Sin */ Symbol?: never;
};
/**
 * Component Routes
 */
type Routes<T = {}> = Record<`${'/' | ':'}${string}`, ((attrs: T & Record<string, string>) => Components | Components[]) | Components | Components[]>;
/**
 * Function type for the `s.route` method and `{ route }` instance/s.
 */
type Route = {
    /**
     * Visit route
     *
     * @example
     *
     * s.route('/sinner')
     */
    (route: string): void;
    /**
     * Route Handler
     *
     * @example
     *
     * s.route({
     *  // Component
     *  '/sin-component': s`main`([
     *    s`h1`('Hail the wicked!')
     *  ]),
     *  // Function
     *  '/sin-function': () => [
     *    s`section`('Joyous Blasphemy')
     *  ],
     * })
     */
    <T = {}>(routes: Routes<T>, options?: Options): View<T>;
    /**
     * Returns the current URL pathname (route)
     *
     * @example
     *
     * s.route.path // -> '/'
     */
    readonly path: string;
    /**
     * Pathmode prefixing used to define hashbang routing
     *
     * @default ''
     */
    prefix: StringUnion<'' | '#!'>;
    /**
     * Query Parameter utilities
     */
    query: Query;
    /**
     * The parent route instance.
     *
     * @example
     *
     * s.route.parent.path // -> /a/b > /a is parent
     */
    parent: Route;
    /**
     * The root route handler (alias of `s.route`)
     *
     * @example
     *
     * s.root // => Route
     */
    root: Route;
    /**
     * Whether or not the provided string is a pathname of the URL
     *
     * @example
     *
     * // Pathname: /sinner/loki
     *
     * s.route.has('loki') // -> true;
     * s.route.has('sin') // -> false;
     */
    has: (path: string) => boolean;
    /**
     * Returns the current URL pathname (route)
     *
     * @example
     *
     * s.toString() // -> '/'
     */
    toString: () => string;
    /** @deprecated Omitted in Sin */ arguments?: never;
    /** @deprecated Omitted in Sin */ prototype?: never;
    /** @deprecated Omitted in Sin */ apply?: never;
    /** @deprecated Omitted in Sin */ call?: never;
    /** @deprecated Omitted in Sin */ caller?: never;
    /** @deprecated Omitted in Sin */ bind?: never;
    /** @deprecated Omitted in Sin */ length: never;
    /** @deprecated Omitted in Sin */ name?: never;
    /** @deprecated Omitted in Sin */ valueOf?: never;
    /** @deprecated Omitted in Sin */ Symbol?: never;
};

/**
 * Component Level Context - TypeScript Utility
 *
 * @example
 *
 * const x: Context<{ x: string }>
 */
type Context<T = {}> = T & context & {
    [key: string]: unknown;
    /**
     * Sin SSR (last modified date of `sin build`)
     */
    readonly modified: number;
    /**
     * A boolean indicating whether or not component is hydrating
     */
    readonly hydrating: boolean;
    /**
     * References `window.location`
     */
    readonly location: Pick<globalThis.Window, 'location'>;
    /**
     * Document Methods
     *
     * @example
     * s(({},[], { doc }) => {
     *
     *  doc.head(
     *    s`title`('Welcome Sinner!'),
     *    s`script`({ src: '/xxx.js' })
     *  )
     *
     *  return () => []
     *
     * })
     */
    readonly doc: Doc;
    /**
     * Route Control
     */
    readonly route: Route;
    /**
     * Called when component is removed or destroyed.
     *
     * @example
     *
     * const section = s`section`('Penance Required!');
     *
     * section.onremove() => console.log('Forgiven')
     */
    readonly onremove: (callback: () => void) => void;
    /**
     * Exclude component from global redraws. Expects a `boolean` parameter!
     *
     * > By default, components will redraw.
     *
     * @example
     *
     * s(({},[], { ignore }) => ignore(true))   // Component is ignored during redraw
     * s(({},[], { ignore }) => ignore(false))  // Component applies redraw (default)
     */
    readonly ignore: (enable: boolean) => void;
    /**
     * Re-initializes the component and redraws without removal.
     *
     * > Use `refresh()` to update stateful data without killing the component.
     *
     * @example
     *
     * s(({}, [], { refresh }) => refresh())
     */
    readonly refresh: S.Event<void>;
    /**
     * Reloads the component, similar to updating `key` reference.
     *
     * > Use `reload()` to crucify and resurrect the component.
     *
     * @example
     *
     * s(({}, [], { reload }) => reload())
     */
    readonly reload: S.Event<void>;
    /**
     * Synchronous Redraw on the component level
     *
     * @example
     *
     * s(({}, [], { redraw }) => redraw())
     */
    readonly redraw: S.Event<void>;
};

type ARIARole = StringUnion<"alert" | "alertdialog" | "application" | "article" | "banner" | "button" | "cell" | "checkbox" | "columnheader" | "combobox" | "complementary" | "contentinfo" | "definition" | "dialog" | "directory" | "document" | "figure" | "form" | "grid" | "gridcell" | "group" | "heading" | "img" | "link" | "list" | "listbox" | "listitem" | "main" | "mark" | "math" | "menu" | "menubar" | "menuitem" | "menuitemcheckbox" | "menuitemradio" | "navigation" | "note" | "option" | "presentation" | "progressbar" | "radio" | "radiogroup" | "region" | "row" | "rowgroup" | "rowheader" | "scrollbar" | "search" | "searchbox" | "separator" | "slider" | "spinbutton" | "status" | "suggestion" | "switch" | "tab" | "table" | "tablist" | "tabpanel" | "term" | "textbox" | "timer" | "toolbar" | "tooltip" | "tree" | "treegrid" | "treeitem">;
/**
 * Base ARIA attributes applicable to all HTML elements.
 */
interface ARIAAttrs {
    /**
     * Defines a role for an element to enhance accessibility.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: ARIARole;
    /**
     * Provides a label for an element.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-label)
     */
    ariaLabel?: string;
    /**
     * Identifies elements that label this one.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-labelledby)
     */
    ariaLabelledBy?: string;
    /**
     * Describes the element in detail.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-description)
     */
    ariaDescription?: string;
    /**
     * Identifies elements providing a description.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-describedby)
     */
    ariaDescribedBy?: string;
    /**
     * Indicates if an element is hidden from assistive tech.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-hidden)
     */
    ariaHidden?: boolean | "true" | "false";
    /**
     * Specifies how live updates are announced.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-live)
     */
    ariaLive?: StringUnion<"off" | "assertive" | "polite">;
    /**
     * Indicates if an update is atomic (all or none).
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-atomic)
     */
    ariaAtomic?: boolean | "true" | "false";
    /**
     * Identifies elements this one controls.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-controls)
     */
    ariaControls?: string;
    /**
     * Identifies elements owned by this one.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-owns)
     */
    ariaOwns?: string;
    /**
     * Suggests a navigation flow to assistive tech.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-flowto)
     */
    ariaFlowTo?: string;
    /**
     * Lists keyboard shortcuts for the element.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-keyshortcuts)
     */
    ariaKeyShortcuts?: string;
    /**
     * Provides a human-readable role description.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-roledescription)
     */
    ariaRoleDescription?: string;
    /**
     * Supplies a braille label for accessibility.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-braillelabel)
     */
    ariaBrailleLabel?: string;
    /**
     * Describes the role for braille devices.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-brailleroledescription) */
    ariaBrailleRoleDescription?: string;
}
/**
 * ARIA attributes for interactive elements (e.g., buttons, links, inputs).
 */
interface ARIAInteractive {
    /**
     * Identifies the active descendant element.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-activedescen
     dant) */
    ariaActiveDescendant?: string;
    /**
     * Indicates if the element is disabled.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-disabled)
     */
    ariaDisabled?: boolean | "true" | "false";
    /**
     * Shows if the element is expanded or collapsed.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-expanded)
     */
    ariaExpanded?: boolean | "true" | "false";
    /**
     * Indicates the element has a popup.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-haspopup)
     */
    ariaHasPopup?: boolean | StringUnion<"false" | "true" | "menu" | "listbox" | "tree" | "grid" | "dialog">;
    /**
     * Shows if a toggle is pressed.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-pressed)
     */
    ariaPressed?: boolean | StringUnion<"false" | "mixed" | "true">;
    /**
     * Indicates a checked state (e.g., checkbox).
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-checked)
     */
    ariaChecked?: boolean | StringUnion<"false" | "mixed" | "true">;
    /**
     * Shows if the element is selected.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-selected)
     */
    ariaSelected?: boolean | "true" | "false";
    /**
     * Marks the element as invalid.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-invalid)
     */
    ariaInvalid?: boolean | StringUnion<"false" | "true" | "grammar" | "spelling">;
    /**
     * Identifies an error message element.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-errormessage)
     */
    ariaErrorMessage?: string;
    /**
     * Indicates if the element is required.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-required)
     */
    ariaRequired?: boolean | "true" | "false";
    /**
     * Shows if the element is grabbed (drag-and-drop).
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-grabbed)
     */
    ariaGrabbed?: boolean | "true" | "false";
    /**
     * Defines the drop effect for drag-and-drop.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-dropeffect)
     */
    ariaDropEffect?: StringUnion<"none" | "copy" | "execute" | "link" | "move" | "popup">;
}
/**
 * ARIA attributes for structural elements (e.g., tables, lists, grids).
 */
interface ARIAStructural {
    /**
     * Specifies the hierarchical level (e.g., headings).
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-level)
     */
    ariaLevel?: number | `${number}`;
    /**
     * Indicates position in a set.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-posinset)
     */
    ariaPosInSet?: number | `${number}`;
    /**
     * Defines the total size of a set.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-setsize)
     */
    ariaSetSize?: number | `${number}`;
    /**
     * Specifies the total number of columns.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-colcount)
     */
    ariaColCount?: number | `${number}`;
    /**
     * Indicates the column index.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-colindex)
     */
    ariaColIndex?: number | `${number}`;
    /**
     * Defines the number of columns spanned.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-colspan)
     */
    ariaColSpan?: number | `${number}`;
    /**
     * Specifies the total number of rows.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-rowcount)
     */
    ariaRowCount?: number | `${number}`;
    /**
     * Indicates the row index.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-rowindex)
     */
    ariaRowIndex?: number | `${number}`;
    /**
     * Defines the number of rows spanned.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-rowspan)
     */
    ariaRowSpan?: number | `${number}`;
    /**
     * Specifies sorting direction.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-sort)
     */
    ariaSort?: StringUnion<"none" | "ascending" | "descending" | "other">;
}
/**
 * ARIA attributes for form-like or input elements (e.g., inputs, textareas).
 */
interface ARIAForm {
    /**
     * Describes autocomplete behavior.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-autocomplete)
     */
    ariaAutoComplete?: StringUnion<"none" | "inline" | "list" | "both">;
    /**
     * Indicates if the element supports multiple lines.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-multiline)
     */
    ariaMultiLine?: boolean | "true" | "false";
    /**
     * Provides a placeholder hint.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-placeholder)
     */
    ariaPlaceholder?: string;
    /**
     * Marks the element as read-only.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-readonly)
     */
    ariaReadOnly?: boolean | "true" | "false";
    /**
     * Indicates if multiple items can be selected.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-multiselectable)
     */
    ariaMultiSelectable?: boolean | "true" | "false";
    /**
     * Specifies the element’s orientation.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-orientation)
     */
    ariaOrientation?: StringUnion<"horizontal" | "vertical">;
}
/**
 * ARIA attributes for progress or measurement elements (e.g., progress, meter).
 */
interface ARIAProgress {
    /**
     * Defines the maximum value.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-valuemax)
     */
    ariaValueMax?: number | `${number}`;
    /**
     * Defines the minimum value.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-valuemin)
     */
    ariaValueMin?: number | `${number}`;
    /**
     * Specifies the current value.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-valuenow)
     */
    ariaValueNow?: number | `${number}`;
    /**
     * Provides a text representation of the value.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-valuetext)
     */
    ariaValueText?: string;
}
/**
 * ARIA attributes for modal or dialog-like elements.
 */
interface ARIAModal {
    /**
     * Indicates if the element is modal.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-modal)
     */
    ariaModal?: boolean | "true" | "false";
}
/**
 * ARIA attributes for elements with busy states (e.g., loading content).
 */
interface ARIABusy {
    /**
     * Indicates the element is being updated.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-busy)
     */
    ariaBusy?: boolean | "true" | "false";
}

/**
 * Event DOM Target overrides - Ensures `event.target` returns HTMLElement.
 */
type event<T extends HTMLElement, event> = event & {
    /**
     * Sin redraw control on user-event. - Set to `false` to prevent dom draws.
     */
    redraw: boolean;
    /**
     * Returns the `dom` of the attrs event.
     */
    readonly target: NonNullable<T> & T;
    /**
     * Returns the `dom` whose event listener callback was invoked, typically the same as `target`
     */
    readonly currentTarget: NonNullable<T> & T;
    /**
     * @deprecated
     */
    readonly srcElement: NonNullable<T> & T;
};
/**
 * Universal events that applies to all HTML elements
 */
interface EventListener<T extends HTMLElement> {
    /**
     * Fires when a non-primary mouse button (e.g., middle or right) is clicked, typically used for auxiliary actions.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/auxclick_event)
     */
    onauxclick?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the object loses the input focus, such as when the user tabs away or clicks elsewhere.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/blur_event)
     */
    onblur?: (this: T, event: event<T, FocusEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user clicks the left mouse button on the object, triggering a standard click action.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/click_event)
     */
    onclick?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user clicks the right mouse button in the client area, opening the context menu.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/contextmenu_event)
     */
    oncontextmenu?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user double-clicks the object with the primary mouse button.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/dblclick_event)
     */
    ondblclick?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when an error occurs during the loading of an object, such as an image, script, or media element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/error_event)
     */
    onerror?: (this: T, event: event<T, OnErrorEventHandler>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the object receives input focus, such as when the user tabs to or clicks it.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/focus_event)
     */
    onfocus?: (this: T, event: event<T, FocusEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when an element or one of its descendants receives focus, bubbling up through the DOM.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/focusin_event)
     */
    onfocusin?: (this: T, event: event<T, FocusEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when an element or one of its descendants loses focus, bubbling up through the DOM.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/focusout_event)
     */
    onfocusout?: (this: T, event: event<T, FocusEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user presses a key on the keyboard, including modifier keys.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/keydown_event)
     */
    onkeydown?: (this: T, event: event<T, FocusEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user presses an alphanumeric key. This event is deprecated; use `onkeydown` or `oninput` instead.
     *
     * @deprecated [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/keypress_event)
     */
    onkeypress?: (this: T, event: event<T, FocusEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user releases a key on the keyboard.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/keyup_event)
     */
    onkeyup?: (this: T, event: event<T, FocusEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires immediately after the browser fully loads an object, such as an image, script, or SVG element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/SVGElement/load_event)
     */
    onload?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user presses a mouse button down over the object, initiating a click or drag.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mousedown_event)
     */
    onmousedown?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the mouse pointer enters an element’s boundaries, without bubbling to ancestors.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseenter_event)
     */
    onmouseenter?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the mouse pointer leaves an element’s boundaries, without bubbling to ancestors.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseleave_event)
     */
    onmouseleave?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires continuously when the user moves the mouse pointer over the object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mousemove_event)
     */
    onmousemove?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the mouse pointer moves outside the boundaries of the object or one of its descendants.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseout_event)
     */
    onmouseout?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the mouse pointer moves into the object or one of its descendants.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseover_event)
     */
    onmouseover?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user releases a mouse button while the pointer is over the object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseup_event)
     */
    onmouseup?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the mouse wheel is rotated. This event is deprecated; use `onwheel` instead.
     *
     * @deprecated [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mousewheel_event)
     */
    onmousewheel?: (this: T, event: event<T, MouseEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a pointer interaction (e.g., touch or pen) is interrupted, such as lifting a finger unexpectedly.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointercancel_event)
     */
    onpointercancel?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a pointer (e.g., mouse, touch, or pen) is pressed down on an element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerdown_event)
     */
    onpointerdown?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a pointer enters an element’s boundaries, without bubbling to ancestors.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerenter_event)
     */
    onpointerenter?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a pointer leaves an element’s boundaries, without bubbling to ancestors.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerleave_event)
     */
    onpointerleave?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires continuously when a pointer moves over an element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointermove_event)
     */
    onpointermove?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a pointer moves out of an element or one of its descendants.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerout_event)
     */
    onpointerout?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a pointer moves into an element or one of its descendants.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerover_event)
     */
    onpointerover?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a pointer is released over an element, such as lifting a finger or mouse button.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerup_event)
     */
    onpointerup?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user repositions the scroll box in a scrollable element, indicating scrolling activity.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/scroll_event)
     */
    onscroll?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when scrolling has stopped in a scrollable element, after the user finishes scrolling.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/scrollend_event)
     */
    onscrollend?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a touch interaction is interrupted, such as lifting a finger unexpectedly during a gesture.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchcancel_event)
     */
    ontouchcancel?: (this: T, event: event<T, TouchEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a touch point is removed from an element, such as lifting a finger from the screen.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchend_event)
     */
    ontouchend?: (this: T, event: event<T, TouchEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires continuously when a touch point moves over an element during a touch gesture.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchmove_event)
     */
    ontouchmove?: (this: T, event: event<T, TouchEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a touch point contacts an element, initiating a touch gesture.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchstart_event)
     */
    ontouchstart?: (this: T, event: event<T, TouchEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the window is about to be unloaded, such as when the user closes the tab or navigates away.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/unload_event)
     */
    onunload?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the mouse wheel or trackpad is scrolled over an element, providing delta values for scroll direction.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/wheel_event)
     */
    onwheel?: (this: T, event: event<T, WheelEvent>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Media-specific events (for `<audio>`, `<video>`)
 */
interface MediaListener<T extends HTMLElement> {
    /**
     * Fires when the user aborts the download of a resource, such as a media element or fetch request.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/abort_event)
     */
    onabort?: (this: T, event: event<T, UIEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when playback is possible for a media element, but further buffering may be required to
     * continue without interruption.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/canplay_event)
     */
    oncanplay?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when a media element can play through to the end without requiring additional buffering.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/canplaythrough_event)
     */
    oncanplaythrough?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when the duration attribute of a media element is updated, reflecting a change in media length.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/durationchange_event)
     */
    ondurationchange?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when a media element is reset to its initial state, typically after its source is cleared.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/emptied_event)
     */
    onemptied?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when playback of a media element reaches its end.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/ended_event)
     */
    onended?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when media data is loaded at the current playback position of a media element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadeddata_event)
     */
    onloadeddata?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when the duration and dimensions of a media element have been determined during loading.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadedmetadata_event)
     */
    onloadedmetadata?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when the browser begins looking for media data, marking the start of the loading process.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadstart_event)
     */
    onloadstart?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when playback of a media element is paused, either by the user or programmatically.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/pause_event)
     */
    onpause?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when playback of a media element is requested via the `play()` method, before it actually starts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/play_event)
     */
    onplay?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when a media element has started playing, after buffering and any delays.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/playing_event)
     */
    onplaying?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs periodically to indicate progress while downloading media data for a media element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/progress_event)
     */
    onprogress?: (this: T, event: event<T, ProgressEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when the playback rate of a media element changes, such as speeding up or slowing down.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/ratechange_event)
     */
    onratechange?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when a seek operation on a media element completes, positioning playback at the new time.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/seeked_event)
     */
    onseeked?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when a seek operation begins on a media element, moving the playback position.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/seeking_event)
     */
    onseeking?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when media download stalls due to insufficient data or network issues.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/stalled_event)
     */
    onstalled?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when media loading is intentionally suspended, such as when the browser pauses a download.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/suspend_event)
     */
    onsuspend?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs periodically to report the current playback position of a media element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/timeupdate_event)
     */
    ontimeupdate?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when the volume of a media element changes, including muting or unmuting.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/volumechange_event)
     */
    onvolumechange?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Occurs when playback stops because the next frame of a media resource is unavailable, requiring buffering.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/waiting_event)
     */
    onwaiting?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Form-specific events (for `<form>`, `<input>`, `<select>`, `<textarea>`)
 */
interface FormListener<T extends HTMLFormElement> {
    /**
     * Fires before an input element’s value is modified, allowing cancellation or modification of the input.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/beforeinput_event)
     */
    onbeforeinput?: (this: T, event: event<T, InputEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the contents of an input element or selection have changed, such as after a user modifies a form field.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/change_event)
     */
    onchange?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when content is copied to the clipboard, allowing modification or cancellation of the operation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/copy_event)
     */
    oncopy?: (this: T, event: event<T, ClipboardEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when content is cut to the clipboard, allowing modification or cancellation of the operation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/cut_event)
     */
    oncut?: (this: T, event: event<T, ClipboardEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a form’s data is being constructed, allowing modification of the `FormData` object before submission.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/formdata_event)
     */
    onformdata?: (this: T, event: event<T, FormDataEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the value of an input element changes due to user input, such as typing or pasting.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/input_event)
     */
    oninput?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when an input element’s value fails validation constraints upon form submission.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/invalid_event)
     */
    oninvalid?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when content is pasted from the clipboard into an element, allowing modification of the pasted data.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/paste_event)
     */
    onpaste?: (this: T, event: event<T, ClipboardEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user resets a form, restoring its fields to their default values.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/reset_event)
     */
    onreset?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the current text selection changes within an input or textarea element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/select_event)
     */
    onselect?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the document’s text selection changes, such as selecting or deselecting text.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/selectionchange_event)
     */
    onselectionchange?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when the user begins selecting text or content within an element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/selectstart_event)
     */
    onselectstart?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a form is submitted, either by user action or programmatically, allowing validation or cancellation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/submit_event)
     */
    onsubmit?: (ev: SubmitEvent) => void;
}
/**
 * Drag-and-drop events (for draggable elements)
 */
interface DragListener<T extends HTMLElement> {
    /**
     * Fires on the source object continuously during a drag operation while the user moves the dragged item.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/drag_event)
     */
    ondrag?: (this: T, event: event<T, DragEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires on the source object when the user releases the mouse at the end of a drag operation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragend_event)
     */
    ondragend?: (this: T, event: event<T, DragEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires on the target element when the user drags an object into a valid drop target.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragenter_event)
     */
    ondragenter?: (this: T, event: event<T, DragEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires on the target object when the user moves the dragged item out of a valid drop target during a drag operation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragleave_event)
     */
    ondragleave?: (this: T, event: event<T, DragEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires on the target element continuously while the user drags an object over a valid drop target.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragover_event)
     */
    ondragover?: (this: T, event: event<T, DragEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires on the source object when the user starts dragging a text selection or selected object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragstart_event)
     */
    ondragstart?: (this: T, event: event<T, DragEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires on the target element when the user drops a dragged object onto a valid drop target.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/drop_event)
     */
    ondrop?: (this: T, event: event<T, DragEvent>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Animation and transition events (for styled elements)
 */
interface AnimationListener<T extends HTMLElement> {
    /**
     * Fires when an animation is aborted unexpectedly, such as when the element is removed from the DOM before completion.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationcancel_event)
     */
    onanimationcancel?: (this: T, event: event<T, AnimationEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a CSS animation completes successfully, after all iterations have finished.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationend_event)
     */
    onanimationend?: (this: T, event: event<T, AnimationEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a CSS animation completes a single iteration, but only if the animation has multiple iterations.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationiteration_event)
     */
    onanimationiteration?: (this: T, event: event<T, AnimationEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a CSS animation begins, after any delay specified in the animation has elapsed.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationstart_event)
     */
    onanimationstart?: (this: T, event: event<T, AnimationEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a CSS transition is cancelled before completion, such as when a property is removed.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitioncancel_event)
     */
    ontransitioncancel?: (this: T, event: event<T, TransitionEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a CSS transition completes successfully, after reaching its end state.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionend_event)
     */
    ontransitionend?: (this: T, event: event<T, TransitionEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a CSS transition is first scheduled to run, before it actually starts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionrun_event)
     */
    ontransitionrun?: (this: T, event: event<T, TransitionEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a CSS transition begins, after any delay has elapsed.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionstart_event)
     */
    ontransitionstart?: (this: T, event: event<T, TransitionEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * This is a legacy Webkit-specific alias of `onanimationend`. It is deprecated; use `onanimationend` instead.
     *
     * @deprecated [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationend_event)
     */
    onwebkitanimationend?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * This is a legacy Webkit-specific alias of `onanimationiteration`. It is deprecated; use `onanimationiteration` instead.
     *
     * @deprecated [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationiteration_event)
     */
    onwebkitanimationiteration?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * This is a legacy Webkit-specific alias of `onanimationstart`. It is deprecated; use `onanimationstart` instead.
     *
     * @deprecated [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationstart_event)
     */
    onwebkitanimationstart?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * This is a legacy Webkit-specific alias of `ontransitionend`. It is deprecated; use `ontransitionend` instead.
     *
     * @deprecated [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionend_event)
     */
    onwebkittransitionend?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Canvas-specific events
 */
interface CanvasListener<T extends HTMLElement> {
    /**
     * Fires when a WebGL context is lost, typically due to hardware or driver issues, requiring reinitialization.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement/webglcontextlost_event)
     */
    oncontextlost?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a lost WebGL context is restored, allowing rendering to resume on a `<canvas>` element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLCanvasElement/contextrestored_event)
     */
    oncontextrestored?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Dialog-specific events
 */
interface DialogListener<T extends HTMLElement> {
    /**
     * Fires when a dialog or similar cancellable action is aborted by the user, such as pressing Esc in a `<dialog>`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/cancel_event)
     */
    oncancel?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when a `<dialog>` element is closed, either by the user or programmatically.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLDialogElement/close_event)
     */
    onclose?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Details-specific events
 */
interface DetailsListener<T extends HTMLElement> {
    /**
     * Fires when a `<details>` element’s open state toggles, either opening or closing the details.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLDetailsElement/toggle_event)
     */
    ontoggle?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Track-specific events
 */
interface TrackListener<T extends HTMLElement> {
    /**
     * Fires when a text track cue changes, such as in a `<track>` element for subtitles or captions.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLTrackElement/cuechange_event)
     */
    oncuechange?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Video-specific events (extends MediaListeners)
 */
interface VideoListener<T extends HTMLElement> extends MediaListener<T> {
    /**
     * Fires when a video element’s intrinsic size changes, such as when new metadata is loaded.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLVideoElement/resize_event)
     */
    onresize?: (this: T, event: event<T, UIEvent>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Popover-specific events (for elements with popover attribute)
 */
interface PopoverListener<T extends HTMLElement> {
    /**
     * Fires just before an element’s `popover` state toggles (e.g., before showing or hiding a popover).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/beforetoggle_event)
     */
    onbeforetoggle?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when an element’s `popover` state toggles (e.g., showing or hiding a popover).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/toggle_event)
     */
    ontoggle?: (this: T, event: event<T, Event>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Pointer capture-specific events (for elements using pointer capture)
 */
interface PointerListener<T extends HTMLElement> {
    /**
     * Fires when an element captures a pointer (e.g., mouse or touch) after a `setPointerCapture` call.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/gotpointercapture_event)
     */
    ongotpointercapture?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
    /**
     * Fires when an element loses pointer capture, such as when released via `releasePointerCapture`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/lostpointercapture_event)
     */
    onlostpointercapture?: (this: T, event: event<T, PointerEvent>, dom?: T, attrs?: any, context?: Context) => Void;
}
/**
 * Security policy violation event (for elements affected by CSP)
 */
interface SecurityListener<T extends HTMLElement> {
    /**
     * Fires when a Content Security Policy violation occurs, such as an attempt to load a blocked resource.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/securitypolicyviolation_event)
     */
    onsecuritypolicyviolation?: (this: T, event: event<T, SecurityPolicyViolationEvent>, dom?: T, attrs?: any, context?: Context) => Void;
}

/**
 * DOM Property Arguments
 */
type SinDOM<T extends HTMLElement, A extends {
    [key: string]: any;
}> = [
    element?: T,
    attributes?: A,
    children?: Children[],
    context?: Context
];
/**
 * Extends the {@link View} `attrs` to include sin specific attributes.
 * Called by the {@link Attrs} namespace interface entries.
 */
interface SinAttributes<T extends HTMLElement> {
    [key: string]: any;
    /**
     * DOM Element render callback. Dom is a creation lifcycle hook which
     * will call in the post rendering cycle of a sin view.
     *
     * > **TIP**
     * >
     * > Attach any third-party libraries or tools for the element via `element`
     *
     * @example
     *
     * s`button`({
     *   dataName: 'sinner'
     *   dom: (element, attributes, children, context) => {
     *     dom.innerText = attributes.dataName
     *   }
     * })
     */
    dom?: ((...params: SinDOM<T, this>) => any) | Array<((...params: SinDOM<T, this>) => any)>;
    /**
     * Waits for children that have set delayed removal.
     *
     * @default false
     */
    deferrable?: boolean;
    /**
     * The value used to map a DOM element to its respective item in an array of data.
     */
    key?: any;
}
type AutoCompleteUnion = StringUnion<'additional-name' | 'address-level1' | 'address-level2' | 'address-level3' | 'address-level4' | 'address-line1' | 'address-line2' | 'address-line3' | 'bday' | 'bday-year' | 'bday-day' | 'bday-month' | 'billing' | 'cc-additional-name' | 'cc-csc' | 'cc-exp' | 'cc-exp-month' | 'cc-exp-year' | 'cc-family-name' | 'cc-given-name' | 'cc-name' | 'cc-number' | 'cc-type' | 'country' | 'country-name' | 'current-password' | 'email' | 'family-name' | 'fax' | 'given-name' | 'home' | 'honorific-prefix' | 'honorific-suffix' | 'impp' | 'language' | 'mobile' | 'name' | 'new-password' | 'nickname' | 'off' | 'on' | 'organization' | 'organization-title' | 'pager' | 'photo' | 'postal-code' | 'sex' | 'shipping' | 'street-address' | 'tel-area-code' | 'tel' | 'tel-country-code' | 'tel-extension' | 'tel-local' | 'tel-local-prefix' | 'tel-local-suffix' | 'tel-national' | 'transaction-amount' | 'transaction-currency' | 'url' | 'username' | 'work'>;
/**
 * **HTML Attributes**
 *
 * This interface inherits all DOM Element attributes and is used as a definitive
 * fallback, presenting all possible tag attributes to sin components. Developers
 * who provide generics to sin tagged literals in TypeScript runtimes can narrow
 * intelliSense far better than those in JavaScript runtimes.
 *
 * The reason for such an exhaustive interface is due to a TypeScript limitation around
 * handling of tagged literals via {@link TemplateStringsArray}. This limitation prevents
 * type extraction, so tag name analysis is impossible.
 *
 */
interface HTMLAttributes<T extends HTMLElement = DOM> extends Attributes<T>, AnimationListener<T>, CanvasListener<T>, DetailsListener<T>, DialogListener<T>, DragListener<T>, FormListener<HTMLFormElement>, MediaListener<T>, SecurityListener<T>, TrackListener<T>, VideoListener<T>, ARIAForm, ARIABusy, ARIAInteractive, ARIAModal, ARIAProgress, ARIAStructural {
    /**
     * - {@link InputAttributes}
     *
     * Specifies file types accepted for `<input>` elements with `type="file"` (e.g., `image/*`, `.pdf`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-accept)
     */
    accept?: string;
    /**
     * **Available Attributes**
     *
     * - {@link LinkAttributes}
     * - {@link ImageAttributes}
     * - {@link ScriptAttributes}
     * - {@link VideoAttributes}
     *
     * Specifies how the element handles cross-origin requests when fetching resources.
     * Valid values are:
     *
     * > `anonymous`
     * >
     * > Sends the request without credentials (e.g., cookies or HTTP authentication).
     *
     * > `use-credentials`
     * >
     * > Sends the request with credentials, if applicable.
     *
     * If omitted, defaults to `anonymous`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-crossorigin)
     */
    crossOrigin?: StringUnion<"anonymous" | "use-credentials">;
    /**
     * **Available Attributes**
     *
     * - {@link LinkAttributes}
     *
     * Specifies the type of content being linked or embedded (e.g., `audio`, `script`, `video/mp4`).
     * Helps the browser prioritize resource loading or handling.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-as)
     */
    as?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ScriptAttributes}
     *
     * Indicates that the script should be executed asynchronously. Use `true` or an empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-async)
     */
    async?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link ImageAttributes}
     * - {@link AreaAttributes}
     *
     * Alternate text for `<input type="image">`, `<img>`, or `<area>` elements, displayed if the image fails to load
     * or for accessibility (e.g., screen readers). Should describe the content or purpose.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-alt)
     */
    alt?: string;
    /**
     * **Available Attributes**
     *
     * - {@link VideoAttributes}
     * - {@link AudioAttributes}
     *
     * Indicates that media playback should start automatically. Use `true` or an empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-autoplay)
     */
    autoplay?: string;
    /**
     * **Available Attributes**
     *
     * - {@link Attributes}
     *
     * Controls whether inputted text is automatically capitalized. Valid values are:
     *
     * > `none` or `off`
     * >
     * > No autocapitalization is applied.
     *
     * > `sentences`
     * >
     * > First letter of each sentence is capitalized.
     *
     * > `on`
     * >
     * > Behavior varies by platform.
     *
     * > `words`
     * >
     * > First letter of each word is capitalized.
     *
     * > `characters`
     * >
     * > All letters are uppercase.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/autocapitalize)
     */
    autocapitalize?: StringUnion<"none" | "off" | "sentences" | "on" | "words" | "characters">;
    /**
     * **Available Attributes**
     *
     * - {@link FormAttributes}
     * - {@link InputAttributes}
     * - {@link SelectAttributes}
     * - {@link TextAreaAttributes}
     *
     * Controls autocomplete behavior for form elements. Combines values from `<input>`, `<select>`, and `<textarea>`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-autocomplete)
     */
    autocomplete?: AutoCompleteUnion;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     *
     * Indicates that a checkbox or radio input is checked by default.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-checked)
     */
    checked?: string;
    /**
     * **Available Attributes**
     *
     * - {@link QuoteAttributes}
     * - {@link ModAttributes}
     *
     * Specifies the source URL of a quotation, citation, or modification.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/blockquote#attr-cite)
     */
    cite?: string;
    /**
     * **Available Attributes**
     *
     * - {@link TextAreaAttributes}
     *
     * Specifies the number of visible columns in a `<textarea>`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-cols)
     */
    cols?: string;
    /**
     * **Available Attributes**
     *
     * - {@link TableCellAttributes}
     *
     * Number of columns a table cell spans.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/td#attr-colspan)
     */
    colSpan?: string;
    /**
     * **Available Attributes**
     *
     * - {@link VideoAttributes}
     * - {@link AudioAttributes}
     *
     * Displays playback controls for `<video>` or `<audio>` elements.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-controls)
     */
    controls?: string;
    /**
     * **Available Attributes**
     *
     * - {@link AreaAttributes}
     *
     * Coordinates defining the clickable area in an image map (e.g., `x,y,r` for circle).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/area#attr-coords)
     */
    coords?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ObjectAttributes}
     *
     * Specifies the URL of the resource to embed (e.g., image, PDF).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/object#attr-data)
     */
    data?: string;
    /**
     * **Available Attributes**
     *
     * - {@link TimeAttributes}
     * - {@link ModAttributes}
     *
     * Specifies a machine-readable date or time (e.g., `2023-10-15T14:30Z`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/time#attr-datetime)
     */
    datetime?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ImageAttributes}
     *
     * Specifies how the browser decodes the image. Values: `sync`, `async`, or `auto`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-decoding)
     */
    decoding?: StringUnion<"sync" | "async" | "auto">;
    /**
     * **Available Attributes**
     *
     * - {@link TrackAttributes}
     *
     * Marks the track as default. Use `true` or an empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/track#attr-default)
     */
    default?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ScriptAttributes}
     *
     * Defers script execution until HTML is parsed. Use `true` or an empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-defer)
     */
    defer?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link TextAreaAttributes}
     *
     * Name of the directionality field to submit for `<input>` or `<textarea>`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-dirname)
     */
    dirname?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ButtonAttributes}
     * - {@link InputAttributes}
     * - {@link SelectAttributes}
     * - {@link OptGroupAttributes}
     * - {@link OptionAttributes}
     * - {@link TextAreaAttributes}
     * - {@link FieldSetAttributes}
     *
     * Disables the element (e.g., button, input, fieldset). Use `true` or an empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-disabled)
     */
    disabled?: string;
    /**
     * **Available Attributes**
     *
     * - {@link AnchorAttributes}
     * - {@link AreaAttributes}
     *
     * Suggests a filename for downloading the linked resource.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-download)
     */
    download?: string;
    /**
     * **Available Attributes**
     *
     * - {@link FormAttributes}
     * - {@link ButtonAttributes}
     * - {@link InputAttributes}
     *
     * Specifies the MIME type for form data submission. Values combined from `<form>` and `<button>`/`input`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-enctype)
     */
    enctype?: StringUnion<"application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain">;
    /**
     * **Available Attributes**
     *
     * - {@link ButtonAttributes}
     * - {@link InputAttributes}
     * - {@link SelectAttributes}
     * - {@link TextAreaAttributes}
     * - {@link FieldSetAttributes}
     * - {@link OutputAttributes}
     * - {@link ObjectAttributes}
     *
     * Associates the element with a form by its `id`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-form)
     */
    form?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ButtonAttributes}
     * - {@link InputAttributes}
     *
     * URL to submit the form to, overriding the form’s `action`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formaction)
     */
    formAction?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ButtonAttributes}
     * - {@link InputAttributes}
     *
     * MIME type for form data, overriding the form’s `enctype`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formenctype)
     */
    formEnctype?: StringUnion<"application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain">;
    /**
     * **Available Attributes**
     *
     * - {@link ButtonAttributes}
     * - {@link InputAttributes}
     *
     * HTTP method for form submission, overriding the form’s `method`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formmethod)
     */
    formMethod?: StringUnion<"get" | "post">;
    /**
     * **Available Attributes**
     *
     * - {@link ButtonAttributes}
     * - {@link InputAttributes}
     *
     * Disables form validation, overriding the form’s `novalidate`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formnovalidate)
     */
    formNoValidate?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ButtonAttributes}
     * - {@link InputAttributes}
     *
     * Target for form submission, overriding the form’s `target`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formtarget)
     */
    formTarget?: StringUnion<'_self' | '_blank' | '_parent' | '_top'>;
    /**
     * **Available Attributes**
     *
     * - {@link TableCellAttributes}
     *
     * Space-separated list of header cell IDs associated with this cell.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/td#attr-headers)
     */
    headers?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ImageAttributes}
     * - {@link IFrameAttributes}
     * - {@link EmbedAttributes}
     * - {@link ObjectAttributes}
     * - {@link VideoAttributes}
     * - {@link InputAttributes}
     * - {@link CanvasAttributes}
     *
     * Specifies the height of the element in pixels or CSS units (e.g., `<canvas>`, `<img>`, `<video>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/canvas#attr-height)
     */
    height?: string;
    /**
     * **Available Attributes**
     *
     * - {@link AnchorAttributes}
     * - {@link LinkAttributes}
     * - {@link AreaAttributes}
     *
     * Specifies the URL of the linked resource (e.g., `<a>`, `<link>`, `<area>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-href)
     */
    href?: string;
    /**
     * **Available Attributes**
     *
     * - {@link AnchorAttributes}
     * - {@link LinkAttributes}
     *
     * Specifies the language of the linked resource (e.g., `en`, `fr-CA`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-hreflang)
     */
    hrefLang?: string;
    /**
     * **Available Attributes**
     *
     * - {@link LabelAttributes}
     * - {@link OutputAttributes}
     *
     * Specifies the ID of the form control this label or output is associated with.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/label#attr-for)
     */
    htmlFor?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ScriptAttributes}
     * - {@link LinkAttributes}
     *
     * Specifies a cryptographic hash to verify the integrity of the resource (e.g., `sha256-...`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-integrity)
     */
    integrity?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ImageAttributes}
     *
     * Indicates that the image is part of a server-side image map.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-ismap)
     */
    isMap?: string;
    /**
     * **Available Attributes**
     *
     * - {@link TrackAttributes}
     *
     * Specifies the type of track for `<track>` elements. Values:
     * `subtitles`, `captions`, `descriptions`, `chapters`, `metadata`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/track#attr-kind)
     */
    kind?: StringUnion<"subtitles" | "captions" | "descriptions" | "chapters" | "metadata">;
    /**
     * **Available Attributes**
     *
     * - {@link OptGroupAttributes}
     * - {@link OptionAttributes}
     * - {@link TrackAttributes}
     *
     * Specifies the label for an option group, option, or track.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/optgroup#attr-label)
     */
    label?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     *
     * Specifies the ID of a `<datalist>` for input suggestions.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-list)
     */
    list?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ImageAttributes}
     * - {@link IFrameAttributes}
     * - {@link VideoAttributes}
     *
     * Controls resource loading behavior. Values: `eager` (immediate), `lazy` (deferred).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-loading)
     */
    loading?: boolean | StringUnion<"eager" | "lazy">;
    /**
     * **Available Attributes**
     *
     * - {@link VideoAttributes}
     * - {@link AudioAttributes}
     *
     * Indicates that the media should loop playback.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-loop)
     */
    loop?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link ProgressAttributes}
     * - {@link MeterAttributes}
     *
     * Specifies the maximum value for numeric inputs or progress/meter elements.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-max)
     */
    max?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link TextAreaAttributes}
     *
     * Specifies the maximum length of text input in characters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-maxlength)
     */
    maxLength?: string;
    /**
     * **Available Attributes**
     *
     * - {@link LinkAttributes}
     * - {@link StyleAttributes}
     * - {@link SourceAttributes}
     *
     * Specifies the media query for which the resource is intended (e.g., `screen`, `print`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-media)
     */
    media?: string;
    /**
     * **Available Attributes**
     *
     * - {@link FormAttributes}
     *
     * Specifies the HTTP method for form submission. Values: `get`, `post`, `dialog`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-method)
     */
    method?: StringUnion<"get" | "post" | "dialog">;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link MeterAttributes}
     *
     * Specifies the minimum value for numeric inputs or meter elements.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-min)
     */
    min?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link TextAreaAttributes}
     *
     * Specifies the minimum length of text input in characters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-minlength)
     */
    minLength?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link SelectAttributes}
     *
     * Allows multiple values (e.g., files, emails) for `<input>` or `<select>`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-multiple)
     */
    multiple?: string;
    /**
     * **Available Attributes**
     *
     * - {@link VideoAttributes}
     * - {@link AudioAttributes}
     *
     * Mutes the media playback.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-muted)
     */
    muted?: string;
    /**
     * **Available Attributes**
     *
     * {@link MapAttributes}
     * {@link IFrameAttributes}
     * {@link ObjectAttributes}
     * {@link InputAttributes}
     * {@link ButtonAttributes}
     * {@link SelectAttributes}
     * {@link TextAreaAttributes}
     * {@link OutputAttributes}
     * {@link FieldSetAttributes}
     * {@link FormAttributes}
     *
     * Specifies the name of the element (e.g., `<map>`, `<form>`, `<input>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/map#attr-name)
     */
    name?: string;
    /**
     * **Available Attributes**
     *
     * - {@link FormAttributes}
     *
     * Disables form validation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-novalidate)
     */
    noValidate?: string;
    /**
     * **Available Attributes**
     *
     * - {@link DetailsAttributes}
     *
     * Indicates that the `<details>` element is open by default.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/details#attr-open)
     */
    open?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     *
     * Specifies a regex pattern the input must match.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-pattern)
     */
    pattern?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link TextAreaAttributes}
     *
     * Placeholder text for `<input>` or `<textarea>` elements.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-placeholder)
     */
    placeholder?: string;
    /**
     * **Available Attributes**
     *
     * - {@link VideoAttributes}
     *
     * Plays video inline on mobile devices instead of fullscreen.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-playsinline)
     */
    playsInline?: boolean;
    /**
     * **Available Attributes**
     *
     * - {@link VideoAttributes}
     *
     * Specifies the URL of an image to display before video playback starts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-poster)
     */
    poster?: string;
    /**
     * **Available Attributes**
     *
     * - {@link VideoAttributes}
     * - {@link AudioAttributes}
     *
     * Hints preload behavior for media. Values: `none`, `metadata`, `auto`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-preload)
     */
    preload?: StringUnion<"none" | "metadata" | "auto">;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link TextAreaAttributes}
     *
     * Makes the element read-only (e.g., `<input>`, `<textarea>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-readonly)
     */
    readOnly?: string;
    /**
     * **Available Attributes**
     *
     * - {@link LinkAttributes}
     * - {@link IFrameAttributes}
     * - {@link ScriptAttributes}
     *
     * Specifies the referrer policy for fetching resources (e.g., `no-referrer`, `origin`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-referrerpolicy)
     */
    referrerPolicy?: string;
    /**
     * **Available Attributes**
     *
     * - {@link AnchorAttributes}
     * - {@link LinkAttributes}
     * - {@link AreaAttributes}
     * - {@link FormAttributes}
     *
     * Specifies the relationship between the document and linked resource (e.g., `nofollow`, `noopener`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-rel)
     */
    rel?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link SelectAttributes}
     * - {@link TextAreaAttributes}
     *
     * Marks the element as required for form submission.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-required)
     */
    required?: string;
    /**
     * **Available Attributes**
     *
     * - {@link OListAttributes}
     *
     * Reverses the order of an ordered list (`<ol>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/ol#attr-reversed)
     */
    reversed?: string;
    /**
     * **Available Attributes**
     *
     * - {@link TableCellAttributes}
     *
     * Number of rows a table cell spans.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/td#attr-rowspan)
     */
    rowSpan?: string;
    /**
     * **Available Attributes**
     *
     * - {@link TextAreaAttributes}
     *
     * Specifies the number of visible rows in a `<textarea>`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-rows)
     */
    rows?: string;
    /**
     * **Available Attributes**
     *
     * - {@link IFrameAttributes}
     *
     * Restricts iframe permissions. Values:
     * `allow-forms`, `allow-modals`, `allow-pointer-lock`, `allow-popups`, `allow-popups-to-escape-sandbox`,
     * `allow-same-origin`, `allow-scripts`, `allow-top-navigation`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-sandbox)
     */
    sandbox?: StringUnion<"allow-forms" | "allow-modals" | "allow-pointer-lock" | "allow-popups" | "allow-popups-to-escape-sandbox" | "allow-same-origin" | "allow-scripts" | "allow-top-navigation">;
    /**
     * **Available Attributes**
     *
     * - {@link TableCellAttributes}
     *
     * Specifies the scope of a header cell. Values: `row`, `col`, `rowgroup`, `colgroup`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/th#attr-scope)
     */
    scope?: StringUnion<"row" | "col" | "rowgroup" | "colgroup">;
    /**
     * **Available Attributes**
     *
     * - {@link OptionAttributes}
     *
     * Marks the option as selected by default.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/option#attr-selected)
     */
    selected?: string;
    /**
     * **Available Attributes**
     *
     * - {@link AreaAttributes}
     *
     * Specifies the shape of an area in an image map. Values: `circle`, `default`, `poly`, `rect`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/area#attr-shape)
     */
    shape?: StringUnion<"circle" | "default" | "poly" | "rect">;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link SelectAttributes}
     *
     * Specifies the visible width of an input or select in characters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-size)
     */
    size?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ImageAttributes}
     * - {@link SourceAttributes}
     * - {@link LinkAttributes}
     *
     * Specifies the intended display sizes for responsive images (e.g., `100vw`, `50vw, 600px`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-sizes)
     */
    sizes?: string;
    /**
     * **Available Attributes**
     *
     * - {@link TableColAttributes}
     *
     * Number of columns an element spans (e.g., `<col>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/col#attr-span)
     */
    span?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     *
     * Specifies the increment step for numeric inputs.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-step)
     */
    step?: string;
    /**
     * **Available Attributes**
     *
     * - {@link OListAttributes}
     *
     * Specifies the starting number for an ordered list (`<ol>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/ol#attr-start)
     */
    start?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ImageAttributes}
     * - {@link SourceAttributes}
     *
     * Specifies a set of image sources for responsive images (e.g., `image-1x.jpg 1x, image-2x.jpg 2x`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-srcset)
     */
    srcSet?: string;
    /**
     * **Available Attributes**
     *
     * - {@link IFrameAttributes}
     *
     * Inline HTML to display within an iframe, overriding `src`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-srcdoc)
     */
    srcDoc?: string;
    /**
     * **Available Attributes**
     *
     * - {@link TrackAttributes}
     *
     * Specifies the language of the track (e.g., `en`, `fr`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/track#attr-srclang)
     */
    srcLang?: string;
    /**
     * **Available Attributes**
     *
     * - {@link ImageAttributes}
     * - {@link VideoAttributes}
     * - {@link AudioAttributes}
     * - {@link SourceAttributes}
     * - {@link TrackAttributes}
     * - {@link ScriptAttributes}
     * - {@link IFrameAttributes}
     * - {@link EmbedAttributes}
     * - {@link InputAttributes}
     *
     * Specifies the URL of the resource (e.g., `<img>`, `<video>`, `<script>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-src)
     */
    src?: string;
    /**
     * **Available Attributes**
     *
     * - {@link AnchorAttributes}
     * - {@link FormAttributes}
     * - {@link AreaAttributes}
     *
     * Specifies where to open the linked resource. Values: `_self`, `_blank`, `_parent`, `_top`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-target)
     */
    target?: StringUnion<'_self' | '_blank' | '_parent' | '_top'>;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link ButtonAttributes}
     * - {@link OListAttributes}
     * - {@link LinkAttributes}
     * - {@link ScriptAttributes}
     * - {@link SourceAttributes}
     * - {@link EmbedAttributes}
     * - {@link ObjectAttributes}
     * - {@link AnchorAttributes}
     *
     * Specifies the type of input, content, or list marker (e.g., `text`, `checkbox`, `video/mp4`, `1`, `a`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-type)
     */
    type?: StringUnion<"hidden" | "text" | "search" | "tel" | "url" | "email" | "password" | "datetime" | "date" | "month" | "week" | "time" | "datetime-local" | "number" | "range" | "color" | "checkbox" | "radio" | "file" | "submit" | "image" | "reset" | "button" | "menu" | "1" | "a" | "A" | "i" | "I">;
    /**
     * **Available Attributes**
     *
     * - {@link ImageAttributes}
     * - {@link ObjectAttributes}
     *
     * Specifies the name of an image map (`<map>`) to associate with the element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-usemap)
     */
    useMap?: string;
    /**
     * **Available Attributes**
     *
     * - {@link InputAttributes}
     * - {@link OptionAttributes}
     * - {@link ButtonAttributes}
     * - {@link ProgressAttributes}
     * - {@link MeterAttributes}
     * - {@link DataAttributes}
     * - {@link LIAttributes}
     *
     * Specifies the value of the element (e.g., `<input>`, `<option>`, `<progress>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-value)
     */
    value?: string;
    /**
     * **Available Attributes**
     *
     * - {@link CanvasAttributes}
     * - {@link ImageAttributes}
     * - {@link IFrameAttributes}
     * - {@link EmbedAttributes}
     * - {@link ObjectAttributes}
     * - {@link VideoAttributes}
     * - {@link InputAttributes}
     *
     * Specifies the width of the element in pixels or CSS units (e.g., `<canvas>`, `<img>`, `<video>`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/canvas#attr-width)
     */
    width?: string;
    /**
     * **Available Attributes**
     *
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Controls line wrapping in a `<textarea>`. Values: `soft` (default), `hard`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-wrap)
     */
    wrap?: StringUnion<"soft" | "hard">;
}
interface Attributes<T extends HTMLElement> extends ARIAAttrs, SinAttributes<T>, EventListener<T>, PointerListener<T>, PopoverListener<T> {
    [attribute: string]: any;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Provides a hint for generating a keyboard shortcut for the current element.
     * This attribute consists of a space-separated list of characters. The browser
     * should use the first one that exists on the computer keyboard layout.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/accesskey)
     */
    accesskey?: string;
    /**
     * Associates a positioned element with an anchor element. The attribute's value is the id value of the element
     * you want to anchor the positioned element to. The element can then be positioned using CSS anchor positioning.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/anchor)
     */
    anchor?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Controls whether inputted text is automatically capitalized and, if so, in what manner. This is relevant to
     * `<input>` and `<textarea>` elements, and any element with `contenteditable` set on it. It affects virtual
     * keyboards on mobile devices and voice input, but not physical keyboards. Valid values are:
     *
     * > `none` or `off`
     * >
     * > No autocapitalization is applied (all letters default to lowercase).
     *
     * > `sentences`
     * >
     * > The first letter of each sentence defaults to a capital letter; others are lowercase.
     *
     * > `on`
     * >
     * > Behavior varies by platform (often capitalizes the first letter of each field).
     *
     * > `words`
     * >
     * > The first letter of each word defaults to a capital letter; others are lowercase.
     *
     * > `characters`
     * >
     * > All letters default to uppercase.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/autocapitalize)
     */
    autocapitalize?: StringUnion<"none" | "off" | "sentences" | "on" | "words" | "characters">;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Indicates that an element is to be focused on page load, or as soon as the `<dialog>` it is part of is displayed.
     * This attribute is a boolean, initially false. Only one element in the document may have this attribute; if multiple
     * elements have it, the first one receives focus. Use with caution, as it can affect accessibility by shifting focus
     * unexpectedly, potentially confusing screen readers or causing page scrolling.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/autofocus)
     */
    autofocus?: boolean | string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * A space-separated list of the classes of the element. Classes allows CSS and JavaScript to select and access
     * specific elements via the [class selectors](https://developer.mozilla.org/docs/Web/CSS/Class_selectors) or
     * functions like the method [`Document.getElementsByClassName()`](https://developer.mozilla.org/docs/Web/API/Document/getElementsByClassName). returns an array-like object of all child elements which have all of the
     * given class names.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/class)
     */
    class?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * An enumerated attribute indicating if the element should be editable by the user. If so, the browser
     * modifies its widget to allow editing. The attribute must take one of the following values:
     *
     * > `true` (or the _empty string_ `''`),
     * >
     * > Which indicates that the element must be editable.
     *
     * > `false`
     * >
     * > Which indicates that the element must not be editable.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/contenteditable)
     */
    contenteditable?: boolean | "true" | "false";
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * An enumerated attribute indicating the directionality of the element's text. It can have the following values:
     *
     * > `ltr`
     * >
     * > This means _left to right_ and is to be used for languages that are written from the left to the right
     * (like English);
     *
     * > `rtl`
     * >
     * > This means _right to left_ and is to be used for languages that are written from the right to the left
     * (like Arabic);
     *
     * > `auto`
     * >
     * > Lets the user agent decide. It uses a basic algorithm as it parses the characters inside the element
     * until it finds a character with a strong directionality, then it applies that directionality to the
     * whole element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/dir)
     */
    dir?: StringUnion<"ltr" | "rtl" | "auto">;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * An enumerated attribute indicating whether the element can be dragged, using the
     * [Drag and Drop API](https://developer.mozilla.org/docs/DragDrop/Drag_and_Drop). It
     * can have the following values?:
     *
     * > `true`
     * >
     * > Which indicates that the element may be dragged
     *
     * > `false`
     * >
     * > Which indicates that the element may not be dragged.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/draggable)
     */
    draggable?: boolean | "true" | "false";
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Provides a hint to virtual keyboards about the expected action when the "Enter" key is pressed on an element,
     * such as `<input>` or `<textarea>`. This attribute enhances the user experience on touch devices by customizing
     * the Enter key’s label or icon. Valid values include:
     *
     * > `enter`
     * >
     * > Submits data (e.g., a form) or inserts a newline.
     *
     * > `done`
     * >
     * > Completes the input task without submitting.
     *
     * > `go`
     * >
     * > Navigates to a URL or triggers a primary action.
     *
     * > `next`
     * >
     * > Moves focus to the next field.
     *
     * > `previous`
     * >
     * > Moves focus to the previous field.
     *
     * > `search`
     * >
     * > Initiates a search.
     *
     * > `send`
     * >
     * > Sends a message or data.
     *
     * The browser may adapt the key’s appearance based on the hint, though behavior depends on the platform.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/enterkeyhint)
     */
    enterkeyhint?: StringUnion<'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'>;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Exports named parts from a shadow DOM to allow styling from outside the shadow boundary. The value is a
     * comma-separated list of part names (optionally with mappings, e.g., `part-name?: exported-name`). These exported
     * parts can be targeted in the containing document using the `::part()` pseudo-element, facilitating cross-boundary
     * styling of web components.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/exportparts)
     */
    exportparts?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * A Boolean attribute indicates that the element is not yet, or is no longer, _relevant_. For example,
     * it can be used to hide elements of the page that can't be used until the login process has been completed.
     * The browser won't render such elements. This attribute must not be used to hide content that could
     * legitimately be shown.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/hidden)
     */
    hidden?: boolean | "true" | "false";
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Defines a unique identifier (ID) which must be unique in the whole document. Its purpose is to identify
     * the element when linking (using a fragment identifier), scripting, or styling (with CSS).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/id)
     */
    id?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Provides a hint to the browser about the type of virtual keyboard to display for entering data into an element,
     * such as `<input>` or `<textarea>`. This attribute helps optimize the input experience on touch devices by
     * suggesting an appropriate keyboard layout. Common values include:
     *
     * > `none`
     * >
     * > No virtual keyboard is shown.
     *
     * > `text`
     * >
     * > Standard text input keyboard.
     *
     * > `decimal`
     * >
     * > Keyboard with numbers and a decimal point.
     *
     * > `numeric`
     * >
     * > Numeric keypad.
     *
     * > `tel`
     * >
     * > Telephone keypad with digits and symbols like `*` and `#`.
     *
     * > `search`
     * >
     * > Keyboard optimized for search input.
     *
     * > `email`
     * >
     * > Keyboard with email-specific characters (e.g., `@`).
     *
     * > `url`
     * >
     * > Keyboard with URL-specific characters (e.g., `/` and `.`).
     *
     * The value is a string, and browsers may interpret additional values depending on platform support.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/inputmode)
     */
    inputmode?: StringUnion<"none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url">;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Indicates that the element and its subtree are to be ignored by user interaction and assistive technologies,
     * such as screen readers. When set to `true`, the element becomes non-focusable, non-clickable, and is skipped
     * during keyboard navigation. It can take the following values:
     *
     * > `true`
     * >
     * > The element and its content are inert.
     *
     *
     * > `false`
     * >
     * > The element behaves normally (default).
     *
     * This attribute is useful for temporarily disabling sections of a page, such as modal overlays or inactive
     * widgets, without removing them from the DOM.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/inert)
     */
    inert?: boolean | "true" | "false";
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * The unique, global identifier of an item.
     */
    itemid?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Used to add properties to an item. Every HTML element may have an `itemprop` attribute specified,
     * where an `itemprop` consists of a name and value pair.
     */
    itemprop?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Properties that are not descendants of an element with the `itemscope` attribute can be associated with
     * the item using an `itemref`. It provides a list of element ids (not `itemid`s) with additional
     * properties elsewhere in the document.
     */
    itemref?: string | string[];
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * `itemscope` (usually) works along with [itemtype](https://developer.mozilla.org/docs/Web/HTML/Global_attributes#attr-itemtype)
     *  to specify that the HTML contained in a block is about a particular item. `itemscope` creates
     * the Item and defines the scope of the `itemtype` associated with it. `itemtype` is a valid URL of a
     * vocabulary (such as [schema.org](https://schema.org/)) that describes the item and its properties context.
     */
    itemscope?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Specifies the URL of the vocabulary that will be used to define `itemprop`s (item properties) in the
     * data structure. `[itemscope](https://developer.mozilla.org/docs/Web/HTML/Global_attributes#attr-itemscope)`
     * is used to set the scope of where in the data structure the vocabulary set by `itemtype` will be active.
     */
    itemtype?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Helps define the language of an element?: the language that non-editable elements are in, or the language
     * that editable elements should be written in by the user. The attribute contains one "language tag"
     * (made of hyphen-separated "language subtags") in the format defined in:
     *
     * [_Tags for Identifying Languages (BCP47)_](https://www.ietf.org/rfc/bcp/bcp47.txt).
     *
     * > **xml:lang** has priority over it.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/lang)
     */
    lang?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * A cryptographic nonce ("number used once") used with a `<script>` or `<style>` element to allow
     * it under a strict Content Security Policy (CSP). The nonce value must match the one specified in
     * the CSP’s `script-src` or `style-src` directive. It’s a single-use token generated by the server
     * to whitelist specific inline scripts or styles, enhancing security by preventing unauthorized
     * code execution.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/nonce)
     */
    nonce?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * A space-separated list of part names used to reference shadow DOM elements across shadow boundaries.
     * When an element in a shadow tree has a `part` attribute, it can be styled from the host document
     * using the `::part()` pseudo-element.
     *
     * This attribute enables targeted styling of shadow DOM components without piercing the shadow boundary.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/part)
     */
    part?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Designates an element as a popover, which is a top-layer UI element that appears on demand
     * (e.g., menus or dialogs). Valid values include:
     *
     * > `auto` (default)
     * >
     * > The popover dismisses itself when focus moves outside or another popover takes precedence.
     *
     * > `manual`
     * >
     * > The popover remains until explicitly dismissed by user action or script.
     *
     * > `''` (_empty strong_)
     * >
     * > An empty string is equivalent to `auto`.
     *
     * Use with `popovertarget` attributes or JavaScript to control its behavior.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/popover)
     */
    popover?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Defines the accessibility role of an element for assistive technologies (e.g., screen readers), as per the ARIA
     * (Accessible Rich Internet Applications) specification. The value is an ARIA role
     * (e.g., `button`, `dialog`, `navigation`), which overrides the element’s default role if specified.
     * This enhances accessibility by describing the element’s purpose or behavior when native semantics are
     * insufficient.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/role)
     */
    role?: ARIARole;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Assigns an element to a named slot within a shadow DOM tree.
     * The value corresponds to the `name` attribute of a `<slot>` element in the shadow root.
     *
     * This attribute allows content from the light DOM to be projected into specific locations
     * within a web component’s shadow DOM, enabling flexible composition.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/slot)
     */
    slot?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * An enumerated attribute defines whether the element may be checked for spelling errors. It may have the
     * following values?: `true`, which indicates that the element should be, if possible, checked for spelling
     * errors; `false`, which indicates that the element should not be checked for spelling errors.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/spellcheck)
     */
    spellcheck?: boolean | "true" | "false";
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Contains [CSS](https://developer.mozilla.org/docs/Web/CSS) styling declarations to be applied to the element.
     * Note that it is recommended for styles to be defined in a separate file or files. This attribute and the
     * [`<style>`](https://developer.mozilla.org/docs/Web/HTML/Element/style). The HTML <style> element contains
     * style information for a document, or part of a document. element have mainly the purpose of allowing for
     * quick styling, for example for testing purposes.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/style)
     */
    style?: string | Record<string, any>;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * An integer attribute indicating if the element can take input focus (is _focusable_), if it should
     * participate to sequential keyboard navigation, and if so, at what position. It can take several values:
     *
     * > a _negative value_ means that the element should be focusable, but should not be reachable via
     * sequential keyboard navigation; `0` means that the element should be focusable and reachable via
     * sequential keyboard navigation, but its relative order is defined by the platform convention;
     *
     * > a _positive value_ means that the element should be focusable and reachable via sequential keyboard
     * navigation; the order in which the elements are focused is the increasing value of the **tabindex**.
     * If several elements share the same tabindex, their relative order follows their relative positions in the document.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/tabindex)
     */
    tabindex?: string | number;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Contains a text representing advisory information related to the element it belongs to. Such information
     * can typically, but not necessarily, be presented to the user as a tooltip.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/title)
     */
    title?: string;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * An enumerated attribute that is used to specify whether an element's attribute values and the values of its
     * [`Text`](https://developer.mozilla.org/docs/Web/API/Text). The Text export interface represents the textual content
     * of Element or Attr. If an element has no markup within its content, it has a single child implementing Text
     * that contains the element's text. However, if the element contains markup, it is parsed into information
     * items and Text nodes that form its children. node children are to be translated when the page is localized,
     * or whether to leave them unchanged. It can have the following values:
     *
     * > empty string and `yes`, which indicates that the element will be translated. `no`, which indicates that
     * the element will not be translated.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/translate)
     */
    translate?: StringUnion<"yes" | "no">;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Controls the behavior of the virtual (on-screen) keyboard for elements that can trigger it, such as `<input>` or
     * elements with `contenteditable`. It determines whether the virtual keyboard is automatically shown when the
     * element is focused. Valid values are:
     *
     * > `auto`
     * >
     * > The browser decides whether to show the virtual keyboard based on heuristics (default behavior).
     *
     * > `manual`
     * >
     * > The virtual keyboard is not shown automatically; user action (e.g., tapping a keyboard icon) is required.
     *
     *
     * **This attribute is useful for customizing input experiences on touch devices.**
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/virtualkeyboardpolicy)
     */
    virtualkeyboardpolicy?: StringUnion<"auto" | "manual">;
    /**
     * {@link HTMLElement}  →  {@link Attributes}
     *
     * Indicates whether the browser should offer writing suggestions (e.g., spelling, grammar, or text completion)
     * for editable elements like `<input>`, `<textarea>`, or those with `contenteditable`. This attribute enhances
     * user input by providing or suppressing predictive text and correction features.
     *
     * It can take the following values:
     *
     * > `true`
     * >
     * > Writing suggestions are enabled (if supported by the browser).
     *
     * > `false`
     * >
     * > Writing suggestions are disabled.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/writingsuggestions)
     */
    writingsuggestions?: boolean | "true" | "false";
}
/**
 * - `<a>`
 */
interface LinkAttributes<T extends HTMLLinkElement = HTMLLinkElement> extends Attributes<T>, SecurityListener<T> {
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies the URL of the resource linked by the `<link>` element, such as a stylesheet, icon, or prefetch resource.
     * The value can be an absolute URL or a relative URL. If omitted, the link is invalid and has no effect.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-href)
     */
    href?: string;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies the relationship between the current document and the resource linked by `href`.
     * Used on `<link>` elements.
     *
     * Common values include `stylesheet`, `icon`, `preload`, `dns-prefetch`, `alternate`, and `noopener`.
     * Multiple values can be space-separated. If omitted, no relationship is assumed.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-rel)
     */
    rel?: string;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies the type of content being linked by the `<link>` element when used with
     * `rel="preload"` or `rel="modulepreload"`.
     *
     * Valid values include `audio`, `document`, `image`, `script`, `style`, and others,
     * depending on the resource type. Helps the browser prioritize resource loading. If
     * omitted, the browser infers the type from the resource.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-as)
     */
    as?: string;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies how the `<link>` element handles cross-origin requests when fetching the resource.
     *
     * Valid values are:
     *
     * > `anonymous`
     * >
     * > Sends the request without credentials (e.g., cookies or HTTP authentication).
     *
     * > `use-credentials`
     * >
     * > Sends the request with credentials, if applicable.
     *
     * If omitted, defaults to `anonymous`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-crossorigin)
     */
    crossOrigin?: StringUnion<'anonymous' | 'use-credentials'>;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies the language of the resource linked by `href`. Used on `<link>` elements,
     * typically with `rel="alternate"`.
     *
     * The value is a BCP 47 language tag (e.g., `en`, `fr`, `zh-Hans`). If omitted,
     * no language is assumed.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-hreflang)
     */
    hrefLang?: string;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies the media for which the linked resource is intended. Used on `<link>` elements,
     * such as stylesheets.
     *
     * The value is a media query (e.g., `screen`, `print`, `all`, `(max-width: 600px)`).
     * If omitted, defaults to `all`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-media)
     */
    media?: string;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies the size of the linked resource, used with `<link>` elements where
     * `rel="icon"` or `rel="apple-touch-icon"`.
     *
     * The value is a space-separated list of sizes (e.g., `16x16`, `32x32 64x64`).
     * If omitted, the browser assumes a default size.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-sizes)
     */
    sizes?: string;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies a title for the linked resource. Used on `<link>` elements with `rel="alternate"`
     * (e.g., feeds) to describe the link.
     *
     * The value is a human-readable string. If omitted, no title is provided.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-title)
     */
    title?: string;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies the MIME type of the linked resource. Used on `<link>` elements to hint at the
     * resource’s format.
     *
     * Examples include `text/css` for stylesheets or `image/png` for icons. If omitted, the
     * browser infers the type from the resource.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-type)
     */
    type?: string;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies a cryptographic hash of the linked resource to verify its integrity.
     * Used on `<link>` elements with external resources.
     *
     * The value is a hash (e.g., `sha256-abc123...`). If the resource doesn’t match,
     * it’s rejected. If omitted, no integrity check is performed.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-integrity)
     */
    integrity?: string;
    /**
     * {@link HTMLLinkElement}  →  {@link LinkAttributes}
     *
     * Specifies the referrer policy for fetching the linked resource. Used on `<link>`
     * elements to control referrer information. Common values include `no-referrer`, `origin`, `same-origin`
     * and `unsafe-url`. If omitted, the default policy applies.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/link#attr-referrerpolicy)
     */
    referrerpolicy?: string;
}
/**
 * - `<style>`
 */
interface StyleAttributes<T extends HTMLStyleElement = HTMLStyleElement> extends Attributes<T> {
    /**
     * {@link HTMLStyleElement}  →  {@link StyleAttributes}
     *
     * Specifies the media for which the `<style>` element’s styles are intended.
     * The value is a media query (e.g., `screen`, `print`, `all`, `(min-width: 768px)`).
     * If omitted, defaults to `all`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/style#attr-media)
     */
    media?: string;
    /**
     * {@link HTMLStyleElement}  →  {@link StyleAttributes}
     *
     * Specifies a cryptographic nonce ("number used once") to allow the `<style>` element under
     * a strict Content Security Policy (CSP). The value must match the nonce in the CSP’s
     * `style-src` directive. If omitted, the style may be blocked by CSP.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/style#attr-nonce)
     */
    nonce?: string;
    /**
     * {@link HTMLStyleElement}  →  {@link StyleAttributes}
     *
     * Specifies a title for the `<style>` element, used to identify it among multiple stylesheets
     * for alternate style switching. The value is a string. If omitted, the style applies by default
     * unless disabled programmatically.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/style#attr-title)
     */
    title?: string;
}
/**
 * - `<blockquote>`
 */
interface QuoteAttributes<T extends HTMLQuoteElement = HTMLQuoteElement> extends Attributes<T>, AnimationListener<T>, DragListener<T> {
    /**
     * {@link HTMLQuoteElement}  →  {@link QuoteAttributes}
     *
     * Specifies the source URL of a quotation or citation. Used on `<blockquote>`, `<q>`, and `<cite>` elements.
     * The value is an absolute or relative URL pointing to the original source. If omitted, no source is indicated.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/blockquote#attr-cite)
     */
    cite?: string;
    /**
     * {@link HTMLQuoteElement}  →  {@link QuoteAttributes}
     *
     * Defines the semantic role of a quote element, such as a blockquote or note.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"blockquote" | "note" | "presentation">;
}
/**
 * - `<ol>`
 */
interface OListAttributes<T extends HTMLOListElement = HTMLOListElement> extends Attributes<T>, ARIAStructural, AnimationListener<T>, DragListener<T> {
    /**
     * {@link HTMLOListElement}  →  {@link OListAttributes}
     *
     * Specifies that the `<ol>` (ordered list) should display its items in reverse order, from highest to lowest.
     * The presence of the attribute (e.g., `reversed` or `reversed=""`) enables this behavior. If omitted,
     * the list is in ascending order.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/ol#attr-reversed)
     */
    reversed?: string;
    /**
     * {@link HTMLOListElement}  →  {@link OListAttributes}
     *
     * Specifies the starting number for the `<ol>` (ordered list).
     * The value is an integer (e.g., `1`, `5`, `-2`). If omitted, defaults to `1`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/ol#attr-start)
     */
    start?: string;
    /**
     * {@link HTMLOListElement}  →  {@link OListAttributes}
     *
     * Specifies the type of marker to use for the `<ol>` (ordered list) items. If omitted, defaults to `1`,
     * and accepts the following valid values:
     *
     * > `1`
     * >
     * > Decimal numbers (e.g., 1, 2, 3) (default).
     *
     * > `a`
     * >
     * > Lowercase letters (e.g., a, b, c).
     *
     * > `A`
     * >
     * > Uppercase letters (e.g., A, B, C).
     *
     * > `i`
     * >
     * > Lowercase Roman numerals (e.g., i, ii, iii).
     *
     * > `I`
     * >
     * > Uppercase Roman numerals (e.g., I, II, III).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/ol#attr-type)
     */
    type?: StringUnion<'1' | 'a' | 'A' | 'i' | 'I'>;
    /**
     * {@link HTMLOListElement}  →  {@link OListAttributes}
     *
     * Specifies the role of an ordered list, such as a list or menu.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"list" | "directory" | "menu" | "tablist" | "tree">;
}
/**
 * - `<li>`
 */
interface LIAttributes<T extends HTMLLIElement = HTMLLIElement> extends Attributes<T>, ARIAStructural, AnimationListener<T>, DragListener<T> {
    /**
     * {@link HTMLLIElement}  →  {@link LIAttributes}
     *
     * Specifies the numeric value of an `<li>` (list item) within an `<ol>` (ordered list).
     * The value is an integer (e.g., `1`, `10`, `-5`). It overrides the automatic numbering
     * for this item and subsequent items unless another `value` is set. Ignored in unordered
     * lists (`<ul>`). If omitted, the list’s natural order applies.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/li#attr-value)
     */
    value?: string;
    /**
     * {@link HTMLLIElement}  →  {@link LIAttributes}
     *
     * Indicates the role of a list item, such as an option or menuitem.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"listitem" | "menuitem" | "option" | "tab" | "treeitem">;
}
/**
 * - `<link>`
 */
interface AnchorAttributes<T extends HTMLAnchorElement = HTMLAnchorElement> extends Attributes<T>, ARIAInteractive {
    /**
     * The state key is a special attribute in Sin that can be applied to anchor (`a`) elements to facilitate data
     * passing during client-side routing. It leverages the browser's History API (specifically `history.pushState`)
     * to forward an object of data to the target route without altering the URL (e.g., no query parameters or
     * fragments are added).
     *
     * This data is then automatically merged into the `attrs` argument of the receiving component on the target route.
     *
     * @example
     *
     * // Consider the following href
     * s`a`({
     *   href: '/path/to',
     *   state: {
     *     name: 'Loki',
     *     age: 666
     *   }
     * })
     */
    state?: Record<string, any>;
    /**
     * {@link HTMLAnchorElement}  →  {@link AnchorAttributes}
     *
     * Specifies the URL of the resource or page the anchor element links to, or the location
     * within the current document (e.g, a fragment identifier like `#section1`). If omitted,
     * the anchor acts as a placeholder and does not navigate. The value can be an absolute URL,
     * relative URL, or a hash (`#`) for in-page navigation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-href)
     */
    href?: string;
    /**
     * {@link HTMLAnchorElement}  →  {@link AnchorAttributes}
     *
     * Specifies where to open the linked resource defined by `href`. Valid values are:
     *
     * > `_self`
     * >
     * > Opens the link in the same frame or window (default behavior).
     *
     * > `_blank`
     * >
     * > Opens the link in a new tab or window, depending on the browser.
     *
     * > `_parent`
     * >
     * > Opens the link in the parent frame (if in a nested frame; otherwise, behaves like `_self`).
     *
     * > `_top`
     * >
     * > Opens the link in the topmost frame (replacing all frames; otherwise, behaves like `_self`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-target)
     */
    target?: StringUnion<'_self' | '_blank' | '_parent' | '_top'>;
    /**
     * {@link HTMLAnchorElement}  →  {@link AnchorAttributes}
     *
     * Indicates that the linked resource should be downloaded instead of navigated to when clicked.
     * The value specifies the suggested filename for the downloaded file. If omitted, the browser
     * navigates to the `href` URL instead of downloading. If the value is an empty string
     * (e.g., `download=""`), the original filename from the server is used.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-download)
     */
    download?: string;
    /**
     * {@link HTMLAnchorElement}  →  {@link AnchorAttributes}
     *
     * Specifies the relationship between the current document and the resource linked by `href`.
     * If omitted, no specific relationship is implied. Common combinations like
     * `rel="noopener noreferrer"` are often used with `target="_blank"`.
     *
     * The value is a space-separated list of link types, such as:
     *
     * > `nofollow`
     * >
     * > Instructs search engines not to follow the link.
     *
     * > `noopener`
     * >
     * > Prevents the new window from accessing the opener’s `window.opener` object (enhances security).
     *
     * > `noreferrer`
     * >
     * > Prevents sending the HTTP referrer header to the linked resource.
     *
     * > `alternate`
     * >
     * > Indicates the link is an alternate representation (e.g., RSS feed).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-rel)
     */
    rel?: string;
    /**
     * {@link HTMLAnchorElement}  →  {@link AnchorAttributes}
     *
     * Specifies the language of the resource linked by `href`. The value is a BCP 47 language tag (e.g., `en`, `fr-CA`).
     * This attribute is advisory and helps browsers or assistive technologies understand the linked content’s language.
     * If omitted, no language is specified.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-hreflang)
     */
    hrefLang?: string;
    /**
     * {@link HTMLAnchorElement}  →  {@link AnchorAttributes}
     *
     * Specifies the MIME type of the resource linked by `href` (e.g., `text/html`, `application/pdf`).
     * This attribute is advisory and helps the browser determine how to handle the resource before fetching it.
     * If omitted, the browser infers the type from the server response or file extension.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/a#attr-type)
     */
    type?: string;
    /**
     * {@link HTMLAnchorElement}  →  {@link AnchorAttributes}
     *
     * Specifies the role of an anchor, typically a link or interactive element like a button.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"link" | "button" | "menuitem">;
}
/**
 * - `<time>`
 */
interface TimeAttributes<T extends HTMLTimeElement = HTMLTimeElement> extends Attributes<T>, AnimationListener<T> {
    /**
     * {@link HTMLTimeElement}  →  {@link TimeAttributes}
     *
     * Specifies a machine-readable date or time for the `<time>` element’s content.
     * The value must be a valid date, time, or datetime string in a format like:
     *
     * - `YYYY-MM-DD`
     * - `HH:MM`
     * - `YYYY-MM-DDTHH:MMZ`
     *
     * (e.g, `2023-10-15`, `14:30`, `2023-10-15T14:30Z`). Used to provide semantic meaning
     * to human-readable text within the element. If omitted, the element’s text content is
     * assumed to be human-readable only, with no machine-readable interpretation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/time#attr-datetime)
     */
    datetime?: string;
    /**
     * {@link HTMLTimeElement}  →  {@link TimeAttributes}
     *
     * Defines the role of a time element, typically representing a time value.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"time">;
}
/**
 * - `<del>`
 * - `<ins>`
 */
interface ModAttributes<T extends HTMLModElement = HTMLModElement> extends Attributes<T>, AnimationListener<T> {
    /**
     * {@link HTMLModElement}  →  {@link ModAttributes}
     *
     * Specifies the source URL of the document or resource explaining the modification.
     * Used on `<ins>` (inserted) and `<del>` (deleted) elements. The value is an absolute
     * or relative URL pointing to the source of the change. If omitted, no source is indicated.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/ins#attr-cite)
     */
    cite?: string;
    /**
     * {@link HTMLModElement}  →  {@link ModAttributes}
     *
     * Specifies the date and time when the modification was made. Used on `<ins>` (inserted)
     * and `<del>` (deleted) elements. The value must be a valid datetime string (e.g., `2023-10-15T14:30Z`).
     * If omitted, no timestamp is associated with the change.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/ins#attr-datetime)
     */
    datetime?: string;
    /**
     * {@link HTMLModElement}  →  {@link ModAttributes}
     *
     * Indicates the role of a modification element (ins/del), such as insertion or deletion.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"insertion" | "deletion" | "presentation">;
}
/**
 * - `<img>`
 */
interface ImageAttributes<T extends HTMLImageElement = HTMLImageElement> extends Attributes<T> {
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies alternative text for the `<img>` element, displayed if the image fails
     * to load or for accessibility (e.g., screen readers). The value is a concise description
     * of the image's content or purpose (e.g., `A red apple`). If omitted, accessibility is
     * impaired, and no fallback text is shown.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-alt)
     */
    alt?: string;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies the URL of the image resource for the `<img>` element.
     * The value can be an absolute or relative URL (e.g., `/images/photo.jpg`).
     * If omitted or invalid, the image fails to load, and the `alt` text is displayed instead.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-src)
     */
    src?: string;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies a set of image sources for the `<img>` element, allowing the browser to choose
     * based on resolution or viewport.
     *
     * The value is a comma-separated list of URLs with optional descriptors
     * (e.g., `image-1x.jpg 1x, image-2x.jpg 2x`). Used with `sizes` to support responsive images.
     * If omitted, the `src` attribute is used as the sole source.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-srcset)
     */
    srcSet?: string;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies the intended display sizes for the `<img>` element when used with `srcset`.
     *
     * The value is a comma-separated list of sizes (e.g., `100vw`, `50vw, 600px`).
     * It helps the browser select the appropriate image from `srcset`. If omitted, the browser
     * assumes a default size (typically `100vw`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-sizes)
     */
    sizes?: string;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies how the `<img>` element handles cross-origin requests when fetching the image.
     *
     * Valid values are:
     *
     * > `anonymous`
     * >
     * > Sends the request without credentials (e.g., cookies or HTTP authentication).
     *
     * > `use-credentials`
     * >
     * > Sends the request with credentials, if applicable.
     *
     * If omitted, defaults to `anonymous`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-crossorigin)
     */
    crossOrigin?: StringUnion<'anonymous' | 'use-credentials'>;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies the name of an image map (`<map>`) to associate with the `<img>` element.
     *
     * The value is the `name` attribute of a `<map>` element (e.g., `#mapname`), prefixed with `#`.
     * If omitted, the image is not linked to a map, and `isMap` has no effect.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-usemap)
     */
    useMap?: string;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies that the `<img>` element is part of a server-side image map. Used with `useMap`.
     *
     * The presence of the attribute (e.g., `isMap` or `isMap=""`) indicates the image coordinates
     * are sent to the server when clicked. Ignored if `useMap` is not present. If omitted, the image
     * is not treated as a server-side map.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-ismap)
     */
    isMap?: string;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies the width of the `<img>` element in pixels or CSS units.
     *
     * The value is a positive number (e.g., `300`, `50%`). It sets the display width, overriding the
     * image’s intrinsic size if provided. If omitted, the intrinsic width is used, or the image scales per CSS.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-width)
     */
    width?: string;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies the height of the `<img>` element in pixels or CSS units.
     *
     * The value is a positive number (e.g., `200`, `25vh`). It sets the display height, overriding
     * the image’s intrinsic size if provided. If omitted, the intrinsic height is used, or the image
     * scales per CSS.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-height)
     */
    height?: string;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies how the `<img>` element should be decoded by the browser. If omitted, defaults to `auto`.
     *
     * Valid values are:
     *
     * > `sync`
     * >
     * > Decodes synchronously with the main thread, potentially blocking rendering.
     *
     * > `async`
     * >
     * > Decodes asynchronously, improving performance but possibly delaying display.
     *
     * > `auto`
     * >
     * > Lets the browser decide the decoding method (default).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-decoding)
     */
    decoding?: StringUnion<'sync' | 'async' | 'auto'>;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies how the `<img>` element should be loaded relative to viewport visibility.
     *
     * If omitted, defaults to `eager`. Valid values are:
     *
     * > `eager`
     * >
     * > Loads the image immediately, regardless of visibility (default).
     *
     * > `lazy`
     * >
     * > Delays loading until the image is near the viewport, improving page load performance.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-loading)
     */
    loading?: boolean | StringUnion<'eager' | 'lazy'>;
    /**
     * {@link HTMLImageElement}  →  {@link ImageAttributes}
     *
     * Specifies the role of an image, typically as an image or decorative element.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"img" | "presentation">;
}
/**
 * - `<iframe>`
 */
interface IFrameAttributes<T extends HTMLIFrameElement = HTMLIFrameElement> extends Attributes<T>, ARIABusy {
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Specifies the URL of the content to embed in the iframe. Can be a webpage, file, or data URI.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-src)
     */
    src?: string;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Inline HTML to display within the iframe, overriding `src` if both are present.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-srcdoc)
     */
    srcDoc?: string;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * A name for the iframe, used as a target for links or forms.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Restricts iframe permissions. Values include:
     *
     * - `allow-forms`
     * - `allow-modals`
     * - `allow-pointer-lock`
     * - `allow-popups`
     * - `allow-popups-to-escape-sandbox`
     * - `allow-same-origin`, `allow-scripts`
     * - `allow-top-navigation`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-sandbox)
     */
    sandbox?: StringUnion<'allow-forms' | 'allow-modals' | 'allow-pointer-lock' | 'allow-popups' | 'allow-popups-to-escape-sandbox' | 'allow-same-origin' | 'allow-scripts' | 'allow-top-navigation'>;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Defines feature policies for the iframe (e.g., `fullscreen`, `payment`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-allow)
     */
    allow?: string;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Allows the iframe content to enter fullscreen mode. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-allowfullscreen)
     */
    allowFullscreen?: string;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Sets the iframe width in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-width)
     */
    width?: string;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Sets the iframe height in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-height)
     */
    height?: string;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Controls HTTP referrer info sent with requests (e.g., `no-referrer`, `origin`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-referrerpolicy)
     */
    referrerPolicy?: string;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Controls iframe loading: `eager` (immediate) or `lazy` (deferred).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/iframe#attr-loading)
     */
    loading?: boolean | StringUnion<'eager' | 'lazy'>;
    /**
     * {@link HTMLIFrameElement}  →  {@link IFrameAttributes}
     *
     * Defines the role of an iframe, such as an application or document container.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"application" | "document" | "presentation">;
}
/**
 * - `<embed>`
 */
interface EmbedAttributes<T extends HTMLEmbedElement = HTMLEmbedElement> extends Attributes<T>, ARIABusy {
    /**
     * {@link HTMLEmbedElement}  →  {@link EmbedAttributes}
     *
     * Specifies the URL of the resource to embed (e.g., plugin content).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/embed#attr-src)
     */
    src?: string;
    /**
     * {@link HTMLEmbedElement}  →  {@link EmbedAttributes}
     *
     * MIME type of the embedded resource (e.g., `application/x-shockwave-flash`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/embed#attr-type)
     */
    type?: string;
    /**
     * {@link HTMLEmbedElement}  →  {@link EmbedAttributes}
     *
     * Sets the embed width in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/embed#attr-width)
     */
    width?: string;
    /**
     * {@link HTMLEmbedElement}  →  {@link EmbedAttributes}
     *
     * Sets the embed height in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/embed#attr-height)
     */
    height?: string;
    /**
     * {@link HTMLEmbedElement}  →  {@link EmbedAttributes}
     *
     * Indicates the role of an embed element, often an application or media container.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"application" | "presentation">;
}
/**
 * - `<object>`
 */
interface ObjectAttributes<T extends HTMLObjectElement = HTMLObjectElement> extends Attributes<T>, ARIABusy {
    /**
     * {@link HTMLObjectElement}  →  {@link ObjectAttributes}
     *
     * Specifies the URL of the resource to embed (e.g., image, PDF).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/object#attr-data)
     */
    data?: string;
    /**
     * {@link HTMLObjectElement}  →  {@link ObjectAttributes}
     *
     * MIME type of the embedded resource (e.g., `application/pdf`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/object#attr-type)
     */
    type?: string;
    /**
     * {@link HTMLObjectElement}  →  {@link ObjectAttributes}
     *
     * A name for the object, used as a target or identifier.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/object#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLObjectElement}  →  {@link ObjectAttributes}
     *
     * Links to an `<map>` element by its `name` for clickable areas.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/object#attr-usemap)
     */
    useMap?: string;
    /**
     * {@link HTMLObjectElement}  →  {@link ObjectAttributes}
     *
     * Associates the object with a form by its `id`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/object#attr-form)
     */
    form?: string;
    /**
     * {@link HTMLObjectElement}  →  {@link ObjectAttributes}
     *
     * Sets the object width in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/object#attr-width)
     */
    width?: string;
    /**
     * {@link HTMLObjectElement}  →  {@link ObjectAttributes}
     *
     * Sets the object height in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/object#attr-height)
     */
    height?: string;
    /**
     * {@link HTMLObjectElement}  →  {@link ObjectAttributes}
     *
     * Specifies the role of an object element, typically an application or media container.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"application" | "presentation">;
}
/**
 * - `<video>`
 */
interface VideoAttributes<T extends HTMLVideoElement = HTMLVideoElement> extends Attributes<T>, ARIABusy, VideoListener<T>, DragListener<T>, AnimationListener<T> {
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Specifies the URL of the video file.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-src)
     */
    src?: string;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Starts video playback automatically. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-autoplay)
     */
    autoplay?: string;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Displays video controls (e.g., play, pause). Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-controls)
     */
    controls?: string;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Controls CORS: `anonymous` (no credentials) or `use-credentials`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-crossorigin)
     */
    crossOrigin?: StringUnion<'anonymous' | 'use-credentials'>;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Loops the video. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-loop)
     */
    loop?: string;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Mutes the video. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-muted)
     */
    muted?: string;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Plays video inline instead of fullscreen on mobile. Use `true`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-playsinline)
     */
    playsInline?: boolean;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * URL of an image to display before playback starts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-poster)
     */
    poster?: string;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Hints preload behavior: `none`, `metadata`, or `auto`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-preload)
     */
    preload?: StringUnion<'none' | 'metadata' | 'auto'>;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Sets the video width in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-width)
     */
    width?: string;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Sets the video height in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-height)
     */
    height?: string;
    /**
     * {@link HTMLVideoElement}  →  {@link VideoAttributes}
     *
     * Defines the role of a video element, often an application or media presentation.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"application" | "presentation">;
}
/**
 * - `<audio>`
 */
interface AudioAttributes<T extends HTMLAudioElement = HTMLAudioElement> extends Attributes<T>, ARIABusy, MediaListener<T>, AnimationListener<T> {
    /**
     * {@link HTMLAudioElement}  →  {@link AudioAttributes}
     *
     * Specifies the URL of the audio file.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/audio#attr-src)
     */
    src?: string;
    /**
     * {@link HTMLAudioElement}  →  {@link AudioAttributes}
     *
     * Starts audio playback automatically. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/audio#attr-autoplay)
     */
    autoplay?: string;
    /**
     * {@link HTMLAudioElement}  →  {@link AudioAttributes}
     *
     * Displays audio controls (e.g., play, pause). Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/audio#attr-controls)
     */
    controls?: string;
    /**
     * {@link HTMLAudioElement}  →  {@link AudioAttributes}
     *
     * Loops the audio. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/audio#attr-loop)
     */
    loop?: string;
    /**
     * {@link HTMLAudioElement}  →  {@link AudioAttributes}
     *
     * Mutes the audio. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/audio#attr-muted)
     */
    muted?: string;
    /**
     * {@link HTMLAudioElement}  →  {@link AudioAttributes}
     *
     * Hints preload behavior: `none`, `metadata`, or `auto`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/audio#attr-preload)
     */
    preload?: StringUnion<'none' | 'metadata' | 'auto'>;
    /**
     * {@link HTMLAudioElement}  →  {@link AudioAttributes}
     *
     * Indicates the role of an audio element, typically an application or media presentation.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"application" | "presentation">;
}
interface SourceAttributes<T extends HTMLSourceElement = HTMLSourceElement> extends Attributes<T> {
    /**
     * {@link HTMLSourceElement}  →  {@link SourceAttributes}
     *
     * Specifies the URL of the media resource.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/source#attr-src)
     */
    src?: string;
    /**
     * {@link HTMLSourceElement}  →  {@link SourceAttributes}
     *
     * MIME type of the media resource (e.g., `video/mp4`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/source#attr-type)
     */
    type?: string;
    /**
     * {@link HTMLSourceElement}  →  {@link SourceAttributes}
     *
     * Comma-separated list of image URLs for responsive images.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/source#attr-srcset)
     */
    srcSet?: string;
    /**
     * {@link HTMLSourceElement}  →  {@link SourceAttributes}
     *
     * Sizes for responsive images (e.g., `100w`, `50vw`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/source#attr-sizes)
     */
    sizes?: string;
    /**
     * {@link HTMLSourceElement}  →  {@link SourceAttributes}
     *
     * Media query for when the source applies (e.g., `(min-width: 600px)`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/source#attr-media)
     */
    media?: string;
}
/**
 * - `<track>`
 */
interface TrackAttributes<T extends HTMLTrackElement = HTMLTrackElement> extends Attributes<T>, TrackListener<T> {
    /**
     * {@link HTMLTrackElement}  →  {@link TrackAttributes}
     *
     * Marks this track as default. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/track#attr-default)
     */
    default?: string;
    /**
     * {@link HTMLTrackElement}  →  {@link TrackAttributes}
     *
     * Type of track: `subtitles`, `captions`, `descriptions`, `chapters`, or `metadata`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/track#attr-kind)
     */
    kind?: StringUnion<'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata'>;
    /**
     * {@link HTMLTrackElement}  →  {@link TrackAttributes}
     *
     * User-visible label for the track.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/track#attr-label)
     */
    label?: string;
    /**
     * {@link HTMLTrackElement}  →  {@link TrackAttributes}
     *
     * URL of the track file (e.g., `.vtt`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/track#attr-src)
     */
    src?: string;
    /**
     * {@link HTMLTrackElement}  →  {@link TrackAttributes}
     *
     * Language of the track (e.g., `en`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/track#attr-srclang)
     */
    srcLang?: string;
}
/**
 * - `<map>`
 */
interface MapAttributes<T extends HTMLMapElement = HTMLMapElement> extends Attributes<T> {
    /**
     * {@link HTMLMapElement}  →  {@link MapAttributes}
     *
     * Name of the image map, referenced by `usemap`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/map#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLMapElement}  →  {@link MapAttributes}
     *
     * Specifies the role of a map element, often a region or decorative container.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"region" | "presentation">;
}
/**
 * - `<area>`
 */
interface AreaAttributes<T extends HTMLAreaElement = HTMLAreaElement> extends Attributes<T>, ARIAInteractive {
    /**
     * {@link HTMLAreaElement}  →  {@link AreaAttributes}
     *
     * Alternate text for the area if the image fails to load.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/area#attr-alt)
     */
    alt?: string;
    /**
     * {@link HTMLAreaElement}  →  {@link AreaAttributes}
     *
     * Coordinates defining the clickable area (e.g., `x,y,r` for circle).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/area#attr-coords)
     */
    coords?: string;
    /**
     * {@link HTMLAreaElement}  →  {@link AreaAttributes}
     *
     * Shape of the area: `circle`, `default`, `poly`, or `rect`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/area#attr-shape)
     */
    shape?: StringUnion<'circle' | 'default' | 'poly' | 'rect'>;
    /**
     * {@link HTMLAreaElement}  →  {@link AreaAttributes}
     *
     * URL of the linked resource.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/area#attr-href)
     */
    href?: string;
    /**
     * {@link HTMLAreaElement}  →  {@link AreaAttributes}
     *
     * Where to open the link: `_self`, `_blank`, `_parent`, or `_top`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/area#attr-target)
     */
    target?: StringUnion<'_self' | '_blank' | '_parent' | '_top'>;
    /**
     * {@link HTMLAreaElement}  →  {@link AreaAttributes}
     *
     * Suggests a filename for downloading the linked resource.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/area#attr-download)
     */
    download?: string;
    /**
     * {@link HTMLAreaElement}  →  {@link AreaAttributes}
     *
     * Relationship to the linked resource (e.g., `nofollow`, `noopener`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/area#attr-rel)
     */
    rel?: string;
    /**
     * {@link HTMLAreaElement}  →  {@link AreaAttributes}
     *
     * Defines the role of an area element, typically a link or interactive button.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"link" | "button">;
}
/**
 * - `<table>`
 */
interface TableAttributes<T extends HTMLTableElement = HTMLTableElement> extends Attributes<T>, ARIAStructural {
    /**
     * {@link HTMLTableElement}  →  {@link TableAttributes}
     *
     * Sets the border width of the table (deprecated; use CSS instead).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/table#attr-border)
     */
    border?: string;
    /**
     * {@link HTMLTableElement}  →  {@link TableAttributes}
     *
     * Indicates the role of a table, such as a table or grid structure.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"table" | "grid" | "treegrid">;
}
/**
 * - `<col>`
 */
interface TableColAttributes<T extends HTMLTableColElement = HTMLTableColElement> extends Attributes<T>, ARIAStructural {
    /**
     * {@link HTMLTableColElement}  →  {@link TableColAttributes}
     *
     * Number of columns this `<col>` spans.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/col#attr-span)
     */
    span?: string;
    /**
     * {@link HTMLTableColElement}  →  {@link TableColAttributes}
     *
     * Specifies the role of a table column, typically a column header.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"columnheader">;
}
/**
 * - `<cell>`
 */
interface TableCellAttributes<T extends HTMLTableCellElement = HTMLTableCellElement> extends Attributes<T>, ARIAStructural {
    /**
     * {@link HTMLTableCellElement}  →  {@link TableCellAttributes}
     *
     * Number of columns this cell spans.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/td#attr-colspan)
     */
    colSpan?: string;
    /**
     * {@link HTMLTableCellElement}  →  {@link TableCellAttributes}
     *
     * Space-separated list of header cell IDs this cell is associated with.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/td#attr-headers)
     */
    headers?: string;
    /**
     * {@link HTMLTableCellElement}  →  {@link TableCellAttributes}
     *
     * Number of rows this cell spans.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/td#attr-rowspan)
     */
    rowSpan?: string;
    /**
     * {@link HTMLTableCellElement}  →  {@link TableCellAttributes}
     *
     * Scope of the header cell: `row`, `col`, `rowgroup`, or `colgroup`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/th#attr-scope)
     */
    scope?: StringUnion<'row' | 'col' | 'rowgroup' | 'colgroup'>;
    /**
     * {@link HTMLTableCellElement}  →  {@link TableCellAttributes}
     *
     * Abbreviated version of the cell content for accessibility.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/th#attr-abbr)
     */
    abbr?: string;
    /**
     * {@link HTMLTableCellElement}  →  {@link TableCellAttributes}
     *
     * Defines the role of a table cell, such as a cell or row header.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"cell" | "gridcell" | "rowheader">;
}
/**
 * - `<form>`
 */
interface FormAttributes<T extends HTMLFormElement = HTMLFormElement> extends Attributes<T>, ARIAForm, FormListener<T>, AnimationListener<T> {
    /**
     * {@link HTMLFormElement}  →  {@link FormAttributes}
     *
     * URL to submit the form to.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-action)
     */
    action?: string;
    /**
     * {@link HTMLFormElement}  →  {@link FormAttributes}
     *
     * HTTP method for form submission: `get`, `post`, or `dialog`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-method)
     */
    method?: StringUnion<'get' | 'post' | 'dialog'>;
    /**
     * {@link HTMLFormElement}  →  {@link FormAttributes}
     *
     * MIME type for form data: `application/x-www-form-urlencoded`, `multipart/form-data`, or `text/plain`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-enctype)
     */
    enctype?: StringUnion<'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'>;
    /**
     * {@link HTMLFormElement}  →  {@link FormAttributes}
     *
     * Controls autocomplete: `on` or `off`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-autocomplete)
     */
    autocomplete?: StringUnion<'on' | 'off'>;
    /**
     * {@link HTMLFormElement}  →  {@link FormAttributes}
     *
     * Where to display the response: `_self`, `_blank`, `_parent`, or `_top`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-target)
     */
    target?: StringUnion<'_self' | '_blank' | '_parent' | '_top'>;
    /**
     * {@link HTMLFormElement}  →  {@link FormAttributes}
     *
     * Disables form validation. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-novalidate)
     */
    noValidate?: string;
    /**
     * {@link HTMLFormElement}  →  {@link FormAttributes}
     *
     * Name of the form for scripting or targeting.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLFormElement}  →  {@link FormAttributes}
     *
     * Relationship to the form action (e.g., `nofollow`, `noopener`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/form#attr-rel)
     */
    rel?: string;
    /**
     * {@link HTMLFormElement}  →  {@link FormAttributes}
     *
     * Indicates the role of a form, typically a form or search container.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"form" | "search">;
}
/**
 * - `<label>`
 */
interface LabelAttributes<T extends HTMLLabelElement = HTMLLabelElement> extends Attributes<T>, AnimationListener<T> {
    /**
     * {@link HTMLLabelElement}  →  {@link LabelAttributes}
     *
     * ID of the form control this label is for.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/label#attr-for)
     */
    htmlFor?: string;
}
/**
 * - `<input>`
 */
interface InputAttributes<T extends HTMLInputElement = HTMLInputElement> extends Attributes<T>, ARIAInteractive, ARIAForm, FormListener<HTMLFormElement>, AnimationListener<T>, DragListener<T> {
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * File types accepted (e.g., `image/*`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-accept)
     */
    accept?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Alternate text for image inputs.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-alt)
     */
    alt?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Autocomplete hint (e.g., `email`, `off`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-autocomplete)
     */
    autocomplete?: StringUnion<'additional-name' | 'address-level1' | 'address-level2' | 'address-level3' | 'address-level4' | 'address-line1' | 'address-line2' | 'address-line3' | 'bday' | 'bday-year' | 'bday-day' | 'bday-month' | 'billing' | 'cc-additional-name' | 'cc-csc' | 'cc-exp' | 'cc-exp-month' | 'cc-exp-year' | 'cc-family-name' | 'cc-given-name' | 'cc-name' | 'cc-number' | 'cc-type' | 'country' | 'country-name' | 'current-password' | 'email' | 'family-name' | 'fax' | 'given-name' | 'home' | 'honorific-prefix' | 'honorific-suffix' | 'impp' | 'language' | 'mobile' | 'name' | 'new-password' | 'nickname' | 'off' | 'on' | 'organization' | 'organization-title' | 'pager' | 'photo' | 'postal-code' | 'sex' | 'shipping' | 'street-address' | 'tel-area-code' | 'tel' | 'tel-country-code' | 'tel-extension' | 'tel-local' | 'tel-local-prefix' | 'tel-local-suffix' | 'tel-national' | 'transaction-amount' | 'transaction-currency' | 'url' | 'username' | 'work'>;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Focuses the input on page load. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-autofocus)
     */
    autofocus?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Marks the input as checked (for checkboxes/radios).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-checked)
     */
    checked?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Name of the directionality field to submit.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-dirname)
     */
    dirname?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Disables the input. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-disabled)
     */
    disabled?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Associates with a form by its `id`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-form)
     */
    form?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * URL to submit the form to (overrides form’s `action`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-formaction)
     */
    formAction?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * MIME type for form data (overrides form’s `enctype`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-formenctype)
     */
    formEnctype?: StringUnion<'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'>;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * HTTP method for form submission (overrides form’s `method`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-formmethod)
     */
    formMethod?: StringUnion<'get' | 'post'>;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Disables validation (overrides form’s `novalidate`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-formnovalidate)
     */
    formNoValidate?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Target for form submission (overrides form’s `target`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-formtarget)
     */
    formTarget?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Height of image inputs in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-height)
     */
    height?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * ID of a `<datalist>` for suggestions.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-list)
     */
    list?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Maximum value for numeric inputs.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-max)
     */
    max?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Maximum length of text input in characters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-maxlength)
     */
    maxLength?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Minimum value for numeric inputs.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-min)
     */
    min?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Minimum length of text input in characters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-minlength)
     */
    minLength?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Allows multiple values (e.g., for file or email inputs).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-multiple)
     */
    multiple?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Name of the input for form submission.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Regex pattern the input must match.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-pattern)
     */
    pattern?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Placeholder text for the input.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-placeholder)
     */
    placeholder?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Makes the input read-only. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-readonly)
     */
    readOnly?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Marks the input as required. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-required)
     */
    required?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Visible width of the input in characters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-size)
     */
    size?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * URL of the image for `type="image"`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-src)
     */
    src?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Increment step for numeric inputs.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-step)
     */
    step?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Type of input (e.g., `text`, `checkbox`, `file`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-type)
     */
    type?: StringUnion<'hidden' | 'text' | 'search' | 'tel' | 'url' | 'email' | 'password' | 'datetime' | 'date' | 'month' | 'week' | 'time' | 'datetime-local' | 'number' | 'range' | 'color' | 'checkbox' | 'radio' | 'file' | 'submit' | 'image' | 'reset' | 'button'>;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Initial value of the input.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-value)
     */
    value?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Width of image inputs in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/input#attr-width)
     */
    width?: string;
    /**
     * {@link HTMLInputElement}  →  {@link InputAttributes}
     *
     * Specifies the role of an input, such as a checkbox or textbox.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"checkbox" | "combobox" | "radio" | "searchbox" | "slider" | "spinbutton" | "switch" | "textbox">;
}
/**
 * - `<button>`
 */
interface ButtonAttributes<T extends HTMLButtonElement = HTMLButtonElement> extends Attributes<T>, ARIAInteractive, AnimationListener<T> {
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * Disables the button. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-disabled)
     */
    disabled?: string;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * Associates with a form by its `id`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-form)
     */
    form?: string;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * URL to submit the form to (overrides form’s `action`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formaction)
     */
    formAction?: string;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * MIME type for form data (overrides form’s `enctype`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formenctype)
     */
    formEnctype?: StringUnion<'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'>;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * HTTP method for form submission (overrides form’s `method`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formmethod)
     */
    formMethod?: StringUnion<'get' | 'post'>;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * Disables validation (overrides form’s `novalidate`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formnovalidate)
     */
    formNoValidate?: string;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * Target for form submission (overrides form’s `target`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-formtarget)
     */
    formTarget?: string;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * Name of the button for form submission.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * Button behavior: `button`, `submit`, `reset`, or `menu`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-type)
     */
    type?: StringUnion<'button' | 'submit' | 'reset' | 'menu'>;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * Value submitted with the form.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/button#attr-value)
     */
    value?: string;
    /**
     * {@link HTMLButtonElement}  →  {@link ButtonAttributes}
     *
     * Defines the role of a button, typically a button or menu item.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"button" | "menuitem" | "menuitemcheckbox" | "menuitemradio">;
}
/**
 * - `<select>`
 */
interface SelectAttributes<T extends HTMLSelectElement = HTMLSelectElement> extends Attributes<T>, ARIAInteractive, ARIAForm, FormListener<HTMLFormElement>, AnimationListener<T> {
    /**
     * {@link HTMLSelectElement}  →  {@link SelectAttributes}
     *
     * Autocomplete hint (e.g., `off`, `country`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/select#attr-autocomplete)
     */
    autocomplete?: AutoCompleteUnion;
    /**
     * {@link HTMLSelectElement}  →  {@link SelectAttributes}
     *
     * Disables the select. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/select#attr-disabled)
     */
    disabled?: string;
    /**
     * {@link HTMLSelectElement}  →  {@link SelectAttributes}
     *
     * Associates with a form by its `id`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/select#attr-form)
     */
    form?: string;
    /**
     * {@link HTMLSelectElement}  →  {@link SelectAttributes}
     *
     * Allows multiple selections. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/select#attr-multiple)
     */
    multiple?: string;
    /**
     * {@link HTMLSelectElement}  →  {@link SelectAttributes}
     *
     * Name of the select for form submission.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/select#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLSelectElement}  →  {@link SelectAttributes}
     *
     * Marks the select as required. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/select#attr-required)
     */
    required?: string;
    /**
     * {@link HTMLSelectElement}  →  {@link SelectAttributes}
     *
     * Number of visible options.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/select#attr-size)
     */
    size?: string;
    /**
     * {@link HTMLSelectElement}  →  {@link SelectAttributes}
     *
     * Indicates the role of a select element, such as a listbox or combobox.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"listbox" | "combobox">;
}
/**
 * - `<optgroup>`
 */
interface OptGroupAttributes<T extends HTMLOptGroupElement = HTMLOptGroupElement> extends Attributes<T>, ARIAStructural {
    /**
     * {@link HTMLOptGroupElement}  →  {@link OptGroupAttributes}
     *
     * Disables the option group. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/optgroup#attr-disabled)
     */
    disabled?: string;
    /**
     * {@link HTMLOptGroupElement}  →  {@link OptGroupAttributes}
     *
     * Label for the option group.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/optgroup#attr-label)
     */
    label?: string;
    /**
     * {@link HTMLOptGroupElement}  →  {@link OptGroupAttributes}
     *
     * Specifies the role of an option group, typically a grouping container.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"group">;
}
/**
 * - `<option>`
 */
interface OptionAttributes<T extends HTMLOptionElement = HTMLOptionElement> extends Attributes<T>, ARIAInteractive {
    /**
     * {@link HTMLOptionElement}  →  {@link OptionAttributes}
     *
     * Disables the option. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/option#attr-disabled)
     */
    disabled?: string;
    /**
     * {@link HTMLOptionElement}  →  {@link OptionAttributes}
     *
     * User-visible label for the option.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/option#attr-label)
     */
    label?: string;
    /**
     * {@link HTMLOptionElement}  →  {@link OptionAttributes}
     *
     * Marks the option as selected. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/option#attr-selected)
     */
    selected?: string;
    /**
     * {@link HTMLOptionElement}  →  {@link OptionAttributes}
     *
     * Value submitted with the form.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/option#attr-value)
     */
    value?: string;
    /**
     * {@link HTMLOptionElement}  →  {@link OptionAttributes}
     *
     * Defines the role of an option, typically a selectable option.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"option">;
}
/**
 * - `<textarea>`
 */
interface TextAreaAttributes<T extends HTMLTextAreaElement = HTMLTextAreaElement> extends Attributes<T>, ARIAInteractive, ARIAForm, FormListener<HTMLFormElement>, AnimationListener<T> {
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Autocomplete hint (e.g., `off`, `sentence`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-autocomplete)
     */
    autocomplete?: AutoCompleteUnion;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Number of visible columns.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-cols)
     */
    cols?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Name of the directionality field to submit.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-dirname)
     */
    dirname?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Disables the textarea. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-disabled)
     */
    disabled?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Associates with a form by its `id`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-form)
     */
    form?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Maximum length in characters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-maxlength)
     */
    maxLength?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Minimum length in characters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-minlength)
     */
    minLength?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Name of the textarea for form submission.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Placeholder text for the textarea.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-placeholder)
     */
    placeholder?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Makes the textarea read-only. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-readonly)
     */
    readOnly?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Marks the textarea as required. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-required)
     */
    required?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Number of visible rows.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-rows)
     */
    rows?: string;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Line wrapping: `soft` (default) or `hard`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/textarea#attr-wrap)
     */
    wrap?: StringUnion<'soft' | 'hard'>;
    /**
     * {@link HTMLTextAreaElement}  →  {@link TextAreaAttributes}
     *
     * Indicates the role of a textarea, typically a textbox.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"textbox">;
}
/**
 * - `<output>`
 */
interface OutputAttributes<T extends HTMLOutputElement = HTMLOutputElement> extends Attributes<T>, AnimationListener<T> {
    /**
     * {@link HTMLOutputElement}  →  {@link OutputAttributes}
     *
     * Space-separated IDs of inputs this output relates to.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/output#attr-for)
     */
    htmlFor?: string;
    /**
     * {@link HTMLOutputElement}  →  {@link OutputAttributes}
     *
     * Associates with a form by its `id`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/output#attr-form)
     */
    form?: string;
    /**
     * {@link HTMLOutputElement}  →  {@link OutputAttributes}
     *
     * Name of the output for scripting.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/output#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLOutputElement}  →  {@link OutputAttributes}
     *
     * Specifies the role of an output, typically a status indicator.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"status">;
}
/**
 * - `<progress>`
 */
interface ProgressAttributes<T extends HTMLProgressElement = HTMLProgressElement> extends Attributes<T>, ARIAProgress, AnimationListener<T> {
    /**
     * {@link HTMLProgressElement}  →  {@link ProgressAttributes}
     *
     * Current progress value.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/progress#attr-value)
     */
    value?: string;
    /**
     * {@link HTMLProgressElement}  →  {@link ProgressAttributes}
     *
     * Maximum progress value.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/progress#attr-max)
     */
    max?: string;
    /**
     * {@link HTMLProgressElement}  →  {@link ProgressAttributes}
     *
     * Defines the role of a progress element, typically a progressbar.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"progressbar">;
}
/**
 * - `<meter>`
 */
interface MeterAttributes<T extends HTMLMeterElement = HTMLMeterElement> extends Attributes<T>, ARIAProgress, AnimationListener<T> {
    /**
     * {@link HTMLMeterElement}  →  {@link MeterAttributes}
     *
     * Current meter value.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/meter#attr-value)
     */
    value?: string;
    /**
     * {@link HTMLMeterElement}  →  {@link MeterAttributes}
     *
     * Minimum meter value.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/meter#attr-min)
     */
    min?: string;
    /**
     * {@link HTMLMeterElement}  →  {@link MeterAttributes}
     *
     * Maximum meter value.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/meter#attr-max)
     */
    max?: string;
    /**
     * {@link HTMLMeterElement}  →  {@link MeterAttributes}
     *
     * Boundary for low values.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/meter#attr-low)
     */
    low?: string;
    /**
     * {@link HTMLMeterElement}  →  {@link MeterAttributes}
     *
     * Boundary for high values.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/meter#attr-high)
     */
    high?: string;
    /**
     * {@link HTMLMeterElement}  →  {@link MeterAttributes}
     *
     * Optimal value for the meter.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/meter#attr-optimum)
     */
    optimum?: string;
    /**
     * {@link HTMLMeterElement}  →  {@link MeterAttributes}
     *
     * Indicates the role of a meter, such as a progressbar or status indicator.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"progressbar" | "status">;
}
/**
 * - `<fieldset>`
 */
interface FieldSetAttributes<T extends HTMLFieldSetElement = HTMLFieldSetElement> extends Attributes<T>, AnimationListener<T> {
    /**
     * {@link HTMLFieldSetElement}  →  {@link FieldSetAttributes}
     *
     * Disables the fieldset and its controls. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/fieldset#attr-disabled)
     */
    disabled?: string;
    /**
     * {@link HTMLFieldSetElement}  →  {@link FieldSetAttributes}
     *
     * Associates with a form by its `id`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/fieldset#attr-form)
     */
    form?: string;
    /**
     * {@link HTMLFieldSetElement}  →  {@link FieldSetAttributes}
     *
     * Name of the fieldset for scripting.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/fieldset#attr-name)
     */
    name?: string;
    /**
     * {@link HTMLFieldSetElement}  →  {@link FieldSetAttributes}
     *
     * Specifies the role of a fieldset, typically a grouping or presentation container.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"group" | "presentation">;
}
/**
 * - `<details>`
 */
interface DetailsAttributes<T extends HTMLDetailsElement = HTMLDetailsElement> extends Attributes<T>, ARIAInteractive, ARIAModal, DetailsListener<T>, AnimationListener<T> {
    /**
     * {@link HTMLDetailsElement}  →  {@link DetailsAttributes}
     *
     * Shows the details open by default. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/details#attr-open)
     */
    open?: string;
    /**
     * {@link HTMLDetailsElement}  →  {@link DetailsAttributes}
     *
     * Defines the role of a details element, such as a group or dialog.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"group" | "dialog">;
}
/**
 * - `<dialog>`
 */
interface DialogAttributes<T extends HTMLDialogElement = HTMLDialogElement> extends Attributes<T>, ARIAInteractive, ARIAModal, DialogListener<T>, AnimationListener<T> {
    /**
     * {@link HTMLDialogElement}  →  {@link DialogAttributes}
     *
     * Indicates the role of a dialog, typically a dialog or alertdialog.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"dialog" | "alertdialog">;
}
/**
 * - `<script>`
 */
interface ScriptAttributes<T extends HTMLScriptElement = HTMLScriptElement> extends Attributes<T> {
    /**
     * {@link HTMLScriptElement}  →  {@link ScriptAttributes}
     *
     * URL of the external script file.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-src)
     */
    src?: string;
    /**
     * {@link HTMLScriptElement}  →  {@link ScriptAttributes}
     *
     * MIME type of the script (e.g., `text/javascript`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-type)
     */
    type?: string;
    /**
     * {@link HTMLScriptElement}  →  {@link ScriptAttributes}
     *
     * Executes script asynchronously. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-async)
     */
    async?: string;
    /**
     * {@link HTMLScriptElement}  →  {@link ScriptAttributes}
     *
     * Defers script execution until HTML is parsed. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-defer)
     */
    defer?: string;
    /**
     * {@link HTMLScriptElement}  →  {@link ScriptAttributes}
     *
     * Controls CORS: `anonymous` (no credentials) or `use-credentials`.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-crossorigin)
     */
    crossOrigin?: StringUnion<'anonymous' | 'use-credentials'>;
    /**
     * {@link HTMLScriptElement}  →  {@link ScriptAttributes}
     *
     * Integrity hash for script validation (e.g., `sha256-...`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-integrity)
     */
    integrity?: string;
    /**
     * {@link HTMLScriptElement}  →  {@link ScriptAttributes}
     *
     * Controls HTTP referrer info (e.g., `no-referrer`).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-referrerpolicy)
     */
    referrerPolicy?: string;
    /**
     * {@link HTMLScriptElement}  →  {@link ScriptAttributes}
     *
     * Excludes script for module-supporting browsers. Use `true` or empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/script#attr-nomodule)
     */
    nomodule?: string;
}
/**
 * - `<canvas>`
 */
interface CanvasAttributes<T extends HTMLCanvasElement = HTMLCanvasElement> extends Attributes<T>, ARIABusy, CanvasListener<T> {
    /**
     * {@link HTMLCanvasElement}  →  {@link CanvasAttributes}
     *
     * Width of the canvas in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/canvas#attr-width)
     */
    width?: string;
    /**
     * {@link HTMLCanvasElement}  →  {@link CanvasAttributes}
     *
     * Height of the canvas in pixels or CSS units.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/canvas#attr-height)
     */
    height?: string;
    /**
     * {@link HTMLCanvasElement}  →  {@link CanvasAttributes}
     *
     * Specifies the role of a canvas, such as an application or presentation area.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"application" | "presentation">;
}
/**
 * - `<data>`
 */
interface DataAttributes<T extends HTMLDataElement = HTMLDataElement> extends Attributes<T>, AnimationListener<T> {
    /**
     * {@link HTMLDataElement}  →  {@link DataAttributes}
     *
     * Machine-readable value of the element.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/HTML/Element/data#attr-value)
     */
    value?: string;
    /**
     * {@link HTMLDataElement}  →  {@link DataAttributes}
     *
     * Defines the role of a data element, typically a term or presentation item.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
     */
    role?: StringUnion<"term" | "presentation">;
}

declare namespace S {
    /**
     * Custom event handler with observer pattern support.
     */
    type Event<T> = {
        /**
         * Triggers the event, calling all subscribed observers with the provided arguments.
         * Returns an array of return values from all observer functions
         *
         * @example
         *
         * const listen = s.event();
         *
         * listen.observe((x) => x * 2);
         * listen(5); // returns [10]
         */
        (value?: T): T[];
        /**
         * Adds an observer function to be called when the event is triggered.
         */
        observe: {
            /**
             * Subscribes a persistent observer that remains until explicitly removed.
             * The function will return a function which can be used to unsubscribe the observer.
             *
             * @example
             *
             * const event = s.event();
             * const unsubscribe = event.observe(x => console.log(x));
             *
             * event(1); // logs: 1
             * unsubscribe(); // removes observer
             */
            (observer: (value: T) => void): () => void;
            /**
             * Subscribes a one-time observer that automatically unsubscribes after first trigger.
             * Returns a function which will unsubscribe the observer before it fires if called.
             *
             * @example
             *
             * const event = s.event();
             * event.observe(x => console.log(x), true);
             *
             * event(1); // logs: 1
             * event(2); // no log (observer already removed)
             */
            (observer: (value: T) => void, once: true): () => void;
        };
        /**
         * Gets an AbortSignal that can be used to monitor the events lifecycle.
         * The signal aborts when an observer is added with `once: true`.
         *
         * @example
         *
         * const event = s.event();
         * const signal = ev.signal;
         *
         * signal.addEventListener('abort', () => console.log('aborted'));
         */
        readonly signal: AbortSignal;
        /** @deprecated Omitted in Sin */ arguments?: never;
        /** @deprecated Omitted in Sin */ prototype?: never;
        /** @deprecated Omitted in Sin */ apply?: never;
        /** @deprecated Omitted in Sin */ call?: never;
        /** @deprecated Omitted in Sin */ caller?: never;
        /** @deprecated Omitted in Sin */ bind?: never;
        /** @deprecated Omitted in Sin */ length: never;
        /** @deprecated Omitted in Sin */ name?: never;
        /** @deprecated Omitted in Sin */ toString?: never;
        /** @deprecated Omitted in Sin */ valueOf?: never;
        /** @deprecated Omitted in Sin */ Symbol?: never;
    };
    type Merged<T, U = any> = T extends HTMLElement ? Merge<U, CosAttrs<T>> : T & HTMLAttributes<DOM>;
    type Argument<T, U> = T extends HTMLElement ? S.Merged<T, U> : isArray<U> extends true ? T : IsMergable<U> extends true ? Merge<T, U> : T;
    type Children<T, U, V> = T extends HTMLElement ? V : isArray<U> extends true ? U : U extends (...args: infer P) => infer R ? R extends S.Component<infer A, infer B, infer C> ? (...args: P) => View<A> : U : V;
    type Context<T, U, V, Q> = T extends HTMLElement ? Q : isArray<U> extends true ? V : U extends (...args: any[]) => any ? V : Q;
    type Empty<U, V, Q> = [keyof U] extends [never] ? (V extends [] ? ([keyof Q] extends [never] ? true : false) : false) : false;
    type Component<A, C, X> = {
        (tag: TagLiteral, ...i: Interpolate[]): S.Component<A, C, X>;
        (attrs?: A & Record<string, unknown>): View<A>;
        (attrs: A & Record<string, unknown>, ...children: C extends [] ? Views[] : C extends any[] ? C : [C]): View<A>;
        (attrs: A & Record<string, unknown>, children: C extends [] ? Views[] : C, context?: X): View<A>;
        (...children: C extends [] ? Views[] : C extends any[] ? C : [C]): View<A>;
    };
}
/**
 * Sin Event
 */
type CosEvent<T> = S.Event<T>;

type Components = typeof cofound;
type CosAttrs<T> = T extends HTMLLinkElement ? LinkAttributes<HTMLLinkElement> : T extends HTMLStyleElement ? StyleAttributes<HTMLStyleElement> : T extends HTMLQuoteElement ? QuoteAttributes<HTMLQuoteElement> : T extends HTMLOListElement ? OListAttributes<HTMLOListElement> : T extends HTMLLIElement ? LIAttributes<HTMLLIElement> : T extends HTMLAnchorElement ? AnchorAttributes<HTMLAnchorElement> : T extends HTMLTimeElement ? TimeAttributes<HTMLTimeElement> : T extends HTMLModElement ? ModAttributes<HTMLModElement> : T extends HTMLImageElement ? ImageAttributes<HTMLImageElement> : T extends HTMLIFrameElement ? IFrameAttributes<HTMLIFrameElement> : T extends HTMLEmbedElement ? EmbedAttributes<HTMLEmbedElement> : T extends HTMLObjectElement ? ObjectAttributes<HTMLObjectElement> : T extends HTMLVideoElement ? VideoAttributes<HTMLVideoElement> : T extends HTMLAudioElement ? AudioAttributes<HTMLAudioElement> : T extends HTMLSourceElement ? SourceAttributes<HTMLSourceElement> : T extends HTMLTrackElement ? TrackAttributes<HTMLTrackElement> : T extends HTMLMapElement ? MapAttributes<HTMLMapElement> : T extends HTMLAreaElement ? AreaAttributes<HTMLAreaElement> : T extends HTMLTableElement ? TableAttributes<HTMLTableElement> : T extends HTMLTableColElement ? TableColAttributes<HTMLTableColElement> : T extends HTMLTableCellElement ? TableCellAttributes<HTMLTableCellElement> : T extends HTMLFormElement ? FormAttributes<HTMLFormElement> : T extends HTMLLabelElement ? LabelAttributes<HTMLLabelElement> : T extends HTMLInputElement ? InputAttributes<HTMLInputElement> : T extends HTMLButtonElement ? ButtonAttributes<HTMLButtonElement> : T extends HTMLSelectElement ? SelectAttributes<HTMLSelectElement> : T extends HTMLOptGroupElement ? OptGroupAttributes<HTMLOptGroupElement> : T extends HTMLOptionElement ? OptionAttributes<HTMLOptionElement> : T extends HTMLTextAreaElement ? TextAreaAttributes<HTMLTextAreaElement> : T extends HTMLOutputElement ? OutputAttributes<HTMLOutputElement> : T extends HTMLProgressElement ? ProgressAttributes<HTMLProgressElement> : T extends HTMLMeterElement ? MeterAttributes<HTMLMeterElement> : T extends HTMLFieldSetElement ? FieldSetAttributes<HTMLFieldSetElement> : T extends HTMLDetailsElement ? DetailsAttributes<HTMLDetailsElement> : T extends HTMLDialogElement ? DialogAttributes<HTMLDialogElement> : T extends HTMLScriptElement ? ScriptAttributes<HTMLScriptElement> : T extends HTMLCanvasElement ? CanvasAttributes<HTMLCanvasElement> : T extends HTMLDataElement ? DataAttributes<HTMLDataElement> : T extends DOM ? HTMLAttributes<DOM> : HTMLAttributes<HTMLElement>;
type Varidiac = Children | Children[] | StyledComponent | Array<Children | StyledComponent> | Views | Views[] | [];
type Arguments<T, U, V> = [
    attrs: ifInferred<T, Attrs, T>,
    children: U extends any[] ? [...U, Children] : U[],
    context: keyof V extends never ? Context<{}> : Context<V>
];
type Signatures<T, U, V> = {
    (tag: TagLiteral, ...interpolate: Interpolate[]): Signatures<T, U, V>;
    (attrs: ifInferred<T, HTMLAttributes, T>): View<T>;
    (attrs: ifInferred<T, HTMLAttributes, T>, ...xs: U extends [] ? Children[] : U extends any[] ? U : [U]): View<T>;
    (attrs: ifInferred<T, HTMLAttributes, T>, children: U extends [] ? Children[] : [U], context?: V): View<T>;
    (...children: U extends [] ? Children[] : U extends any[] ? U : [U]): View<T>;
};
type StatelessSignature<T, U, V> = (...x: Arguments<T, U, V>) => Varidiac;
type StatelessComponent<T, U, V> = Signatures<T, U, V>;
type StatefulSignature<T, U, V> = (...x: Arguments<T, U, V>) => P<(...x: Arguments<T, U, V>) => P<Varidiac>>;
type StatefulComponent<T, U, V> = Signatures<T, U, V>;
type StateSignatures<T, U, V> = StatelessSignature<T, U, V> | StatefulSignature<T, U, V>;
type StyledSignature<T extends DOM> = Partial<[
    attributes?: CosAttrs<T>,
    ...children: Array<Children | StyledComponent<T>>
] | [
    ...children: Array<Children | StyledComponent<T>>
]>;
type StyledComponent<T extends DOM = DOM> = {
    <U extends StateSignatures<any, any, any>>(component: U): InferComponent<U>;
    <A = {}>(attributes: CosAttrs<T>, ...children: Array<Children | StyledComponent<T>>): View<A>;
    <A = {}>(...children: Array<Children | StyledComponent<T>>): View<A>;
    (tag: TagLiteral, ...interpolate: Interpolate[]): StyledComponent<T>;
};
type AsyncSignature<T, U, V> = [
    /** Async Stateful Options */
    options: {
        /**
         * Render a loading dom element
         *
         * @example
         * s(
         *  {
         *    loading: s`div`('patience...')
         *  },
         *  async () => {
         *    // Perform some task...
         *    await s.sleep(3000);
         *
         *    return () => s`h1`('Hello Sinner!')
         *  }
         * )
         */
        loading?: StyledComponent | Components | (() => Components);
        /**
         * Intercept throws or errors
         *
         * @example
         * s(
         *  {
         *    loading: s`div`('patience...'),
         *    error: e => s`h1 fc red`('There was an error ' + e)
         *  },
         *  async () => {
         *    // Perform some task...
         *    await s.sleep(3000);
         *
         *    return () => s`h1`('Hello Sinner!')
         *  }
         * )
         */
        error?: <Exception extends DOMException = any>(e?: Exception) => Components | void;
    },
    /** Component Rendering */
    component: P<StatefulSignature<T, U, V>>
];
type InferComponent<S> = S extends StatelessSignature<infer T, infer U, infer V> ? StatelessComponent<T, U, V> : S extends StatefulSignature<infer T, infer U, infer V> ? StatefulComponent<T, U, V> : never;
/**
 * Component Utility
 *
 * @example
 * // Styled Component
 * s.Component<HTMLElement>
 * // Attrs
 * s.Component<{}>
 * // Attrs + Children
 * s.Component<{}, []>
 * // Attrs + Children + Context
 * s.Component<{}, [], {}>
 * // Element Attributes + Attrs
 * s.Component<HTMLElement, {}>
 * // Element Attributes + Attrs + Children
 * s.Component<HTMLElement, {}, []>
 * // Element Attributes + Attrs + Children + Context
 * s.Component<HTMLElement, {}, [], {}>
 */
type Component<T = {}, U = {}, V = [], Q = {}> = T extends HTMLElement ? S.Empty<U, V, Q> extends true ? StyledComponent<T> : S.Component<S.Argument<T, U>, S.Children<T, U, V>, S.Context<T, U, V, Q>> : S.Component<S.Argument<T, U>, S.Children<T, U, V>, S.Context<T, U, V, Q>>;

/**
 * DOM Event handler
 */
type On = <T extends HTMLElement, K extends keyof WindowEventMap = keyof WindowEventMap>(
/**
 * The DOM Element listener will be attached
 */
target: T, 
/**
 * The event name
 */
event: K, 
/**
 * The listener callback function
 */
listener: (this: T, event?: WindowEventMap[K], dom?: T) => Void, 
/**
 * Event Options
 */
options?: boolean | AddEventListenerOptions) => () => Void;

/**
 * Extended type reference of {@link HTMLElementTagNameMap} to support unknown keys
 */
interface HTMLTagElementMap extends HTMLElementTagNameMap {
    [tag: string]: HTMLElement;
}
/**
 * Literal union of {@link HTMLElementTagNameMap} keys
 */
type Selector = StringUnion<keyof HTMLElementTagNameMap>;
/**
 * Suffixed tag name extraction
 */
type Suffixed<T> = T extends `${infer Tag}${'.' | '#' | '['}${string}` ? Tag : T;
/**
 * Returns a HTML Element from {@link HTMLElementTagNameMap}
 *
 * > This will perform string operations and attempt to extract element names from
 * > selector Hyperscript expressions
 */
type HTMLTagElement<HTMLElementName extends string> = Has<HTMLElementTagNameMap, HTMLElementName, HTMLTagElementMap[HTMLElementName], Has<HTMLElementTagNameMap, Suffixed<HTMLElementName>, HTMLTagElementMap[Suffixed<HTMLElementName>], HTMLElement>>;

/**
 * DOM Target/s for mounting
 */
type DOMTarget = Element | HTMLElement | DocumentFragment | ShadowRoot;
/**
 * Mount Arguments spreads
 */
type MountArguments<T, V> = [
    attrs?: ifInferred<T, {}, T>,
    context?: ifInferred<V, {}, V>
];
/**
 * When `s.is.server === true`, `s.mount` does not patch the DOM. Instead it returns this
 * object so that the caller can use the mounted view, its resolved attributes, and the
 * constructed context to drive server-side rendering or serialization.
 */
type MountSSR<T, V> = {
    /** The attributes passed to the mounted root component, inferred from the component signature.*/
    attrs: T;
    /** The runtime context in which the component was mounted. */
    context: Context<V>;
    /** The mounted root view. On the server this is returned instead of being applied to a DOM node. */
    view: Component<T, [], V> | View<T>;
};
/**
 * Mounted Return
 */
type Mounted<T, V> = void | MountSSR<T, V>;
type Mount = {
    <T = {}, U = [], V = {}>(view: StateSignatures<T, U, V>, ...x: MountArguments<T, V>): Mounted<T, V>;
    <T = {}, U = [], V = {}>(dom: DOMTarget, view: StateSignatures<T, U, V>, ...x: MountArguments<T, V>): Mounted<T, V>;
    <T = {}, U = [], V = {}>(view: Component<HTMLBodyElement, T, U, V>, ...x: MountArguments<T, V>): Mounted<T, V>;
    <T = {}, U = [], V = {}>(dom: DOMTarget, view: Component<T, U, V>, ...x: MountArguments<T, V>): Mounted<T, V>;
    <T = {}>(view: View<T>, ...x: MountArguments<T, {}>): Mounted<T, {}>;
    <T = {}>(dom: DOMTarget, view: View<T>, ...x: MountArguments<T, {}>): Mounted<T, {}>;
};

/**
 * HTTP Parameter Options
 */
interface Params<T = {}> {
    /**
     * Request URL
     *
     * @default undefined
     */
    url: string | URL;
    /**
     * The request method
     *
     * @default 'GET'
     */
    method?: StringUnion<'HEAD' | 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH'>;
    /**
     * Whether or not to apply redraw upon request resolution.
     *
     * @default true
     */
    redraw?: boolean;
    /**
     * The XMLHttpRequest property responseType is an enumerated string value
     * specifying the type of data contained in the response.
     *
     * @default ""
     */
    responseType?: StringUnion<"" | 'arraybuffer' | 'blob' | 'document' | 'json' | 'text'>;
    /**
     * JSON Content
     *
     * @deprecated
     * @default 'application/json'
     */
    json?: string;
    /**
     * Query Parameters
     *
     * @default {}
     */
    query?: Record<string, string | number | boolean> | URLSearchParams;
    /**
     * The data to be serialized into the body (for other types of requests).
     *
     * @default undefined
     */
    body?: T & {
        [key: string]: any;
    };
    /**
     * A username for HTTP authorization.
     *
     * @default undefined
     */
    user?: string;
    /**
     * A password for HTTP authorization. This option is provided for XMLHttpRequest compatibility,
     * but you should avoid using it because it sends the password in plain text over the network.
     *
     * @default undefined
     */
    pass?: string;
    /**
     * Request headers
     *
     * @default {}
     */
    headers?: Record<string, string>;
    /**
     * Exposes the underlying XMLHttpRequest object for low-level configuration and optional
     * replacement (by returning a new XHR).
     */
    config?: (xhr: XMLHttpRequest) => void | XMLHttpRequest;
    /**
     * The amount of milliseconds a request can take before automatically being terminated.
     *
     * @default 0
     */
    timeout?: number;
}
/**
 * HTTP request method functions
 *
 * @example
 *
 * s.http.get()
 * s.http.post()
 * s.http.put()
 *
 * // etc etc
 */
interface Methods {
    /**
     * HTTP GET Request
     *
     * @example
     *
     * s.http.get('/api/path', {});
     */
    get: {
        <T>(url: string, params?: Omit<Params<T>, 'method' | 'url'>): Promise<T>;
        <T>(params?: Omit<Params<T>, 'method'>): Promise<T>;
    };
    /**
     * HTTP POST Request
     *
     * @example
     *
     * s.http.post('/api/path', {});
     */
    post: {
        <T>(url: string, params?: Omit<Params<T>, 'method' | 'url'>): Promise<T>;
        <T>(params?: Omit<Params<T>, 'method'>): Promise<T>;
    };
    /**
     * HTTP PUT Request
     *
     * @example
     *
     * s.http.put('/api/path', {});
     */
    put: {
        <T>(url: string, params?: Omit<Params<T>, 'method' | 'url'>): Promise<T>;
        <T>(params?: Omit<Params<T>, 'method'>): Promise<T>;
    };
    /**
     * HTTP PATCH Request
     *
     * @example
     *
     * s.http.put('/api/path', {});
     */
    patch: {
        <T>(url: string, params?: Omit<Params<T>, 'method' | 'url'>): Promise<T>;
        <T>(params?: Omit<Params<T>, 'method'>): Promise<T>;
    };
    /**
     * HTTP DELETE Request
     *
     * @example
     *
     * s.http.delete('/api/path', {});
     */
    delete: {
        <T>(url: string, params?: Omit<Params<T>, 'method' | 'url'>): Promise<T>;
        <T>(params?: Omit<Params<T>, 'method'>): Promise<T>;
    };
    /**
     * HTTP HEAD Request
     *
     * @example
     *
     * s.http.head('/api/path', {});
     */
    head: {
        <T>(url: string, params?: Omit<Params<T>, 'method' | 'url'>): Promise<T>;
        <T>(params?: Omit<Params<T>, 'method'>): Promise<T>;
    };
}
/**
 * Function type/s for the `s.http` method, including `s.http.get`, `s.http.post` etc.
 */
interface Http extends Methods {
    /**
    * HTTP Request
    *
    * @example
    *
    * s.http('/api/path', {
    *  method: 'GET',
    *  redraw: true,
    *  responseType: 'json',
    *  json: 'application/json',
    *  query: {},
    *  body: {},
    *  user: '',
    *  pass: '',
    *  headers: {},
    *  timeout: 0,
    *  config: (xhr) => {},
    * })
    */
    <T = any>(url: string, params?: Omit<Params<T>, 'url'>): Promise<T>;
    <T = any>(params?: Params<T>): Promise<T>;
    /** @deprecated Omitted in Sin */ arguments?: never;
    /** @deprecated Omitted in Sin */ prototype?: never;
    /** @deprecated Omitted in Sin */ apply?: never;
    /** @deprecated Omitted in Sin */ call?: never;
    /** @deprecated Omitted in Sin */ caller?: never;
    /** @deprecated Omitted in Sin */ bind?: never;
    /** @deprecated Omitted in Sin */ length: never;
    /** @deprecated Omitted in Sin */ name?: never;
    /** @deprecated Omitted in Sin */ toString?: never;
    /** @deprecated Omitted in Sin */ valueOf?: never;
    /** @deprecated Omitted in Sin */ Symbol?: never;
}

declare global {
    /**
     * Sin Statefull Component
     *
     * @example
     *
     * s(({}, [], {}) => () => s``)
     */
    export function s<T, U = [], V = {}>(statefull: StatefulSignature<T, U, V>): StatefulComponent<T, U, V>;
    /**
     * Sin Stateless Component
     *
     * @example
     *
     * s(({}, [], {}) => s``)
     */
    export function s<T, U = [], V = {}>(stateless: StatelessSignature<T, U, V>): StatelessComponent<T, U, V>;
    /**
     * Sin Async Component
     *
     * @example
     *
     * s({}, async({}, [], {}) =>  () => s``)
     */
    export function s<T, U = [], V = {}>(...async: AsyncSignature<T, U, V>): View;
    /**
     * Sin HyperScript Element
     *
     * @example
     *
     * s('div', ...)
     */
    export function s<T extends Selector>(selector: T, ...attributes: StyledSignature<HTMLTagElement<T>>): View;
    /**
     * Sin Styled Component
     *
     * @example
     *
     * s``
     */
    export function s<T extends HTMLElement>(tag: TagLiteral, ...interpolate: Interpolate[]): StyledComponent<T>;
    /**
     * Sin Omitted Native Methods
     */
    export class s {
        /** @deprecated Omitted in Sin */ static arguments?: never;
        /** @deprecated Omitted in Sin */ static prototype?: never;
        /** @deprecated Omitted in Sin */ static apply?: never;
        /** @deprecated Omitted in Sin */ static call?: never;
        /** @deprecated Omitted in Sin */ static caller?: never;
        /** @deprecated Omitted in Sin */ static bind?: never;
        /** @deprecated Omitted in Sin */ static length: never;
        /** @deprecated Omitted in Sin */ static name?: never;
        /** @deprecated Omitted in Sin */ static toString?: never;
        /** @deprecated Omitted in Sin */ static valueOf?: never;
        /** @deprecated Omitted in Sin */ static Symbol?: never;
    }
    /**
     * Sin
     */
    export namespace s {
        /**
        * Global Window Object
        */
        export const window: Window & typeof globalThis;
        /**
         * Scroll Restoration
         */
        export const scroll: boolean;
        /**
         * Type guard to distinguish whether a given value should be interpreted
         * as a component `attrs` object.
         *
         * @example
         *
         * s.isAttrs({ id: 'foo' })   // -> true
         * s.isAttrs(s`div`())        // -> false
         * s.isAttrs([1,2,3])         // -> false
         */
        export const isAttrs: (x: any) => boolean;
        /**
         * Runtime references
         */
        export const is: is & {
            /**
             * Whether or not code is executing on server.
             */
            readonly server: boolean;
        };
        /**
         * Holds `true` when sin is currently redrawing, otherwise `false`
         */
        export const redrawing: boolean;
        /**
         * JSX Component Creation Reference
         *
         * > **𓃵 Sacrificial Decision**
         */
        export const jsx: any;
        /**
         * Delay redraw or operation.
         *
         * @example
         *
         * // 💤 For in that sleep of death...
         * await sleep(2000)
         * // What dreams my come?
         */
        export const sleep: (x: number) => Promise<number>;
        /**
         * **⮂** Sin Redraw
         *
         * @example
         *
         * s.redraw() // Asynchronous Redraws
         */
        export const redraw: {
            /**
             * Asynchronous Redraws
             */
            (): void;
            /**
             * Force Redraw
             */
            force(): void;
            /** @deprecated Omitted in Sin */ arguments?: never;
            /** @deprecated Omitted in Sin */ prototype?: never;
            /** @deprecated Omitted in Sin */ apply?: never;
            /** @deprecated Omitted in Sin */ call?: never;
            /** @deprecated Omitted in Sin */ caller?: never;
            /** @deprecated Omitted in Sin */ bind?: never;
            /** @deprecated Omitted in Sin */ length: never;
            /** @deprecated Omitted in Sin */ name?: never;
            /** @deprecated Omitted in Sin */ toString?: never;
            /** @deprecated Omitted in Sin */ valueOf?: never;
            /** @deprecated Omitted in Sin */ Symbol?: never;
        };
        /**
         * Set the base `<style>` element which sin uses for CSS cascades.
         *
         * @example
         *
         * const style = document.createElement('style');
         *
         * s.style(style) // => HTMLStyleElement
         *
         * // Omitting parameter returns current <style> sin is using
         * s.style() // => HTMLStyleElement
         */
        export const style: (element?: HTMLStyleElement) => HTMLStyleElement;
        /**
         * Creates a custom event handler with observer pattern support.
         *
         * @example
         * // 𓋹 Call forth events and partake in blasphemy!
         *
         * const sinned = s.event(x => console.log(x))
         *
         * sinned.observe('repent')
         */
        export const event: <T = any>(callback?: (value: T) => void) => S.Event<T>;
        /**
         * CSS Methods for controlling the cascades
         */
        export const css: CSS;
        /**
         * CSS Animate utility
         *
         * @example
         *
         * s`
         *  [animate="entry"] {}
         *  [animate="exit"]  {}
         * `({
         *    dom: s.animate
         * })
         */
        export const animate: (dom: HTMLElement) => (defferable?: boolean) => void;
        /**
         * Sin Mount
         *
         * @example
         * // 𓋹 The wicked etch their dreams!
         *
         * s.mount(document.body, () => s`div`('In the den of sin!'))
         */
        export const mount: Mount;
        /**
         * HTTP utility for requests
         *
         * @example
         *
         * s.http('/api/path', {
         *  method: 'GET',
         *  redraw: true,
         *  responseType: 'json',
         *  json: 'application/json',
         *  query: {},
         *  body: {},
         *  user: '',
         *  pass: '',
         *  headers: {},
         *  timeout: 0,
         *  config: (xhr) => {},
         * })
         */
        export const http: Http;
        /**
         * Create live stream with value. Optionally pass a list of observers.
         *
         * @example
         *
         * const a = s.live(10);
         * const b = s.live(20, x => {}, x => {});
         */
        export const live: SinLive;
        /**
         * Sin Routing
         *
         * @example
         *
         * // Path
         * s.route('/sin-path')
         *
         * s.route({
         *  // View
         *  '/sin-view': s`main`([
         *    s`h1`('Unrepentant Rapture!')
         *  ]),
         *  // Component
         *  '/sin-component': s(() => [
         *    `main`(
         *      s`h1`('Hail the wicked!')
         *    )
         *  ]),
         *  // Function
         *  '/sin-function': () => [
         *    s`section`('Joyous Blasphemy')
         *  ],
         * })
         */
        export const route: Route;
        /**
         * DOM Event listener - forwarded to `addEventListener`
         *
         * @example
         *
         * s`pre`({
         *  dom: s.on(window, 'keydown', (event, dom) => {
         *    console.log(event, dom)
         *  })
         * });
         */
        export const on: On;
        /**
         * Forgiving HTML or SVG strings into unescaped HTML or SVG.
         *
         * > Unsanitized user input is **Forbidden!**
         *
         * @example
         *
         * s.trust`<small>In the den of Sin</small>`
         * s.trust(`<h1>Woe to the wicked!</h1>`)
         */
        export const trust: {
            (markup: TagLiteral, ...interpolate: unknown[]): View;
            (markup: string): View;
        };
        /**
         * The Error Component, used to display errors or throws.
         *
         * > You can use this to customise the default Æesthetic of Errors thrown by sin.
         */
        export const error: Component;
        /**
         * The internal sin View class. Can be used to with `instanceof` to determine Sin Components
         *
         * @example
         * const component = s(() => s`h1`('Sinner!'))
         *
         * if(component instanceof s.View) {
         *    // component is a sin view
         * }
         */
        export const View: View;
        /**
         * Exposed Types
         */
        export type { DOM, Daft, Primitive, Children, Component, Child, Nodes, Node, Context, Live, Http, CosEvent as Event };
    }
    /**
     * Sin `context`
     *
     * Interface for extending the global component context.
     * Use the `s.Context<T>` Type Utility for component level
     * context extends.
     *
     * @example
     * declare global {
     *   interface context {
     *      foo: string
     *   }
     * }
     *
     * s(({}, [], { foo }) => [])
     */
    export interface context {
    }
    /**
     * Sin `s.is`
     *
     * Extend the global `s.is.*` references of sin.
     *
     * @example
     * declare global {
     *   interface is {
     *      foo: boolean
     *   }
     * }
     *
     * s.is.foo // -> true or false
     */
    export interface is {
    }
    /**
     * Sin `p(...)`
     *
     * Intercept, print to console and return the value.
     * Pass any primitive and get it back the same way.
     *
     * @example
     * const x = p(333)   // Logs 333
     * const v = x + 333  // Value of v is 666
     */
    export function p<T = any>(...input: T[]): T;
    /**
     * Sin DOM
     *
     * An extended HTMLElement representing a DOM in Sin.
     */
    export const DOM: DOM;
}
declare const cofound: typeof s;

export { cofound as default };
