import s from 'cofound'

s.mount(({}, [], { route }) => [
  s`h1`('hi'),
  s(() => () =>
    s({
      loading: s`h1`('loading')
    }, async({}, [], { ignore, reload, refresh, redraw, onremove }) => {
      const init = Date.now()
      onremove(() => p('removed'))
      await s.sleep(1000)

      return () => s`
        border 2px solid black
      `(
        s`h3`('Ignore stuff'),
        s`button`({ onclick: redraw }, 'redraw'),
        s`button`({ onclick: refresh }, 'refresh'),
        s`button`({ onclick: reload }, 'reload'),
        s`li`(init, ' init'),
        s`li`(Date.now(), ' draw')
      )
    })
  )
])
