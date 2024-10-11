import s, { Child, ComponentContext, Component as SinComponent } from 'sin'

type Component<Attrs> = (this: CCX<Attrs>, attrs: Attrs) => ReturnType<SinComponent<Attrs>>
export function cc<Attrs>(Component: Component<Attrs>) {
  return s((initialAttrs: Attrs, initalChildren, ctx) => {
    const ccx = new CCX<any>(initialAttrs, initalChildren, ctx)
    const component = Component.bind(ccx, ccx.attrsProxy)
    return (attrs, children) => {
      ccx.attrs = attrs
      ccx.children = children
      // Pass proxy so component's initial attrs will always be up-to-date
      return s(component, attrs as any, children)
    }
  })
}

class CCX<Attrs> {
  attrsProxy: Attrs
  attrs: Attrs
  children: Child[]
  constructor(
    initialAttrs: Attrs,
    initialChildren: Child[],
    public ctx: ComponentContext,
  ) {
    this.attrs = initialAttrs
    this.children = initialChildren
    this.attrsProxy = new Proxy({} as any, {
      get: (target, prop) => {
        return this.attrs[prop as keyof Attrs]
      },
    })
  }

  /**
   * Example usage:
   *
   *     this.addEventListener(document, 'click', (e) => {
   *       if (!e.target.closest('.DeploymentContextMenu')) {
   *         open = false
   *       }
   *     })
   */
  addEventListener(el: EventTarget, event: string, handler: (e: any) => void) {
    const handlerWithRedraw = (e: any) => {
      handler(e)
      s.redraw()
    }
    el.addEventListener(event, handlerWithRedraw)
    this.ctx.onremove(() => {
      el.removeEventListener(event, handlerWithRedraw)
    })
  }

  setTimeout(handler: () => void, ms: number) {
    const timeoutId = setTimeout(() => {
      handler()
      s.redraw()
    }, ms)
    this.ctx.onremove(() => {
      clearTimeout(timeoutId)
    })
  }

  setInterval(handler: () => void, ms: number) {
    const intervalId = setInterval(() => {
      handler()
      s.redraw()
    }, ms)
    this.ctx.onremove(() => {
      clearInterval(intervalId)
    })
  }
}

export type { CCX }
