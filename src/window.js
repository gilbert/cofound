typeof globalThis === 'undefined' && (window.globalThis = window)
export default typeof window === 'undefined' ? {} : window
