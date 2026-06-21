import { useState, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  const ToastEl = toast ? (
    <div className="toast-wrap">
      <div className="toast">{toast}</div>
    </div>
  ) : null

  return { showToast, ToastEl }
}
