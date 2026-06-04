// co-sync client — WebSocket-based real-time data sync

const BACKOFF_MIN = 200
const BACKOFF_MAX = 5000

export function createSyncClient(url) {
  let ws = null
  let msgId = 0
  let backoff = BACKOFF_MIN
  let closed = false
  let connected = false

  const subscriptions = new Map()  // id -> { sql, params, callback }
  const pending = new Map()        // id -> { resolve, reject }

  function connect() {
    if (closed) return

    ws = new WebSocket(url)

    ws.onopen = () => {
      connected = true
      backoff = BACKOFF_MIN
      // Re-subscribe active queries
      for (const [id, sub] of subscriptions) {
        send({ type: 'subscribe', id, sql: sub.sql, params: sub.params })
      }
    }

    ws.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }

      if (data.type === 'rows') {
        const sub = subscriptions.get(data.id)
        if (sub) sub.callback(data.rows)
        return
      }

      if (data.type === 'ack') {
        const p = pending.get(data.id)
        if (p) {
          pending.delete(data.id)
          p.resolve(data.rowId != null ? data.rowId : undefined)
        }
        return
      }

      if (data.type === 'error') {
        // Check if it's a pending mutation
        const p = pending.get(data.id)
        if (p) {
          pending.delete(data.id)
          p.reject(new Error(data.error))
          return
        }
        // Otherwise it's a subscription error
        const sub = subscriptions.get(data.id)
        if (sub && sub.onError) sub.onError(new Error(data.error))
      }
    }

    ws.onclose = () => {
      connected = false
      if (closed) return
      // Reject pending mutations
      for (const [id, p] of pending) {
        p.reject(new Error('Connection lost'))
      }
      pending.clear()
      // Reconnect with exponential backoff
      setTimeout(connect, backoff)
      backoff = Math.min(backoff * 2, BACKOFF_MAX)
    }

    ws.onerror = () => {
      // onclose will fire after this
    }
  }

  function send(msg) {
    if (ws && connected) {
      ws.send(JSON.stringify(msg))
    }
  }

  function nextId() {
    return String(++msgId)
  }

  connect()

  return {
    query(sql, params = {}, callback, onError) {
      const id = nextId()
      subscriptions.set(id, { sql, params, callback, onError })
      if (connected) {
        send({ type: 'subscribe', id, sql, params })
      }
      return function unsubscribe() {
        subscriptions.delete(id)
        send({ type: 'unsubscribe', id })
      }
    },

    table(tableName, callback, onError) {
      return this.query('SELECT * FROM ' + tableName, {}, callback, onError)
    },

    insert(table, attrs) {
      const id = nextId()
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        send({ type: 'insert', id, table, attrs })
      })
    },

    update(table, rowId, attrs) {
      const id = nextId()
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        send({ type: 'update', id, table, rowId, attrs })
      })
    },

    delete(table, rowId) {
      const id = nextId()
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        send({ type: 'delete', id, table, rowId })
      })
    },

    close() {
      closed = true
      if (ws) ws.close()
    },
  }
}
