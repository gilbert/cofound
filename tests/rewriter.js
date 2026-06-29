import t from 'cofound/test'
import rewrite from '../bin/develop/rewriter.js'

t`Module Path Rewriter`(

  t`MDN import samples`(() => {
    let count = 0
    rewrite(
      `import defaultExport from "module-name";
      import * as name from "module-name";
import { export1 } from "module-name";
import { export1 as alias1 } from "module-name";
import { default as alias } from "module-name";
import { export1, export2 } from "module-name";
import { export1, export2 as alias2, /* ... */ } from "module-name";
import { "string name" as alias } from "module-name";
import defaultExport, { export1, /* ... */ } from "module-name";
import defaultExport, * as name from "module-name";
import "module-name";`,
      () => count++
    )
    return [11, count]
  }),

  t`MDN import samples no semis`(() => {
    let count = 0
    rewrite(
      `import defaultExport from "module-name"
      import * as name from "module-name"
import { export1 } from "module-name"
import { export1 as alias1 } from "module-name"
import { default as alias } from "module-name"
import { export1, export2 } from "module-name"
import { export1, export2 as alias2, /* ... */ } from "module-name"
import { "string name" as alias } from "module-name"
import defaultExport, { export1, /* ... */ } from "module-name"
import defaultExport, * as name from "module-name"
import "module-name"`,
      () => count++
    )
    return [11, count]
  }),

  t`MDN import samples weird indentation`(() => {
    let count = 0
    rewrite(
      `import defaultExport from "module-name";
      import * as name from "module-name";
        import { export1 } from "module-name";
  import { export1 as alias1 } from "module-name";
    import { default as alias } from "module-name";
import { export1, export2 } from "module-name";
  import { export1, export2 as alias2, /* ... */ } from "module-name";
    import { "string name" as alias } from "module-name";
    import defaultExport, { export1, /* ... */ } from "module-name";
import defaultExport, * as name from "module-name";
  import "module-name";`,
      () => count++
    )
    return [11, count]
  }),

  t`MDN import samples single line`(() => {
    let count = 0
    rewrite(
      'import defaultExport from "module-name";import * as name from "module-name";import { export1 } from "module-name";import { export1 as alias1 } from "module-name";import { default as alias } from "module-name";import { export1, export2 } from "module-name";import { export1, export2 as alias2, /* ... */ } from "module-name";import { "string name" as alias } from "module-name";import defaultExport, { export1, /* ... */ } from "module-name";import defaultExport, * as name from "module-name";import "module-name";',
      () => count++
    )
    return [11, count]
  }),

  t`MDN export samples`(() => {
    let count = 0
    rewrite(
      `export * from "module-name";
export * as name1 from "module-name";
export { name1, /* ..., */ nameN } from "module-name";
export { import1 as name1, import2 as name2, /* ..., */ nameN } from "module-name";
export { default, /* ..., */ } from "module-name";
export { default as name1 } from "module-name";`,
      () => count++
    )
    return [6, count]
  }),

  t`MDN export samples no semis`(() => {
      let count = 0
      rewrite(
        `export * from "module-name"
export * as name1 from "module-name"
export { name1, /* ..., */ nameN } from "module-name"
export { import1 as name1, import2 as name2, /* ..., */ nameN } from "module-name"
export { default, /* ..., */ } from "module-name"
export { default as name1 } from "module-name"`,
        () => count++
      )
      return [6, count]
    }),

  t`MDN export samples weird indentation`(() => {
    let count = 0
    rewrite(
      `export * from "module-name";
      export * as name1 from "module-name";
        export { name1, /* ..., */ nameN } from "module-name";
  export { import1 as name1, import2 as name2, /* ..., */ nameN } from "module-name";
export { default, /* ..., */ } from "module-name";
    export { default as name1 } from "module-name";`,
      () => count++
    )
    return [6, count]
  }),

  t`import after single line comment`(() => {
    let count = 0
    rewrite(`// hi
import s1 from 'sin'`,
      () => count++
    )
    return [1, count]
  }),

  t`import after multi line comment`(() => {
    let count = 0
    rewrite(`/* hi
*/import s1 from 'sin'`,
      () => count++
    )
    return [1, count]
  }),

  t`import after block`(() => {
    let count = 0
    rewrite(`if(1){}
function(){ }import s1 from 'sin'`,
      () => count++
    )
    return [1, count]
  }),

  t`import wat`(() => {
    let count = 0
    rewrite(`
      function(){}import {} from 'yo'
      `,
      () => count++
    )
    return [1, count]
  }),

  t`gilbert`(() => {
    let count = 0
    rewrite(`"use strict";
// To modify this file, you must update ./misc/admin/lib/cmds/update-exports.js
import * as ethers from "./ethers";
try {
    const anyGlobal = window;
    if (anyGlobal._ethers == null) {
        anyGlobal._ethers = ethers;
    }
}
catch (error) { }
export { ethers };
export { Signer, Wallet, VoidSigner, getDefaultProvider, providers, BaseContract, Contract, ContractFactory, BigNumber, FixedNumber, constants, errors, logger, utils, wordlists,
////////////////////////
// Compile-Time Constants
version, Wordlist } from "./ethers";`,
      () => count++
    )
    return [2, count]
  }),

  t`dynamic`(() => {
    let count = 0
    rewrite('import(\'/login\')',
      () => count++
    )
    return [1, count]
  })

)
