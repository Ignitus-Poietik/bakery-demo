import { useState } from 'react'
import './HelpWidget.css'
import Icon from './Icon'

export default function HelpWidget({ apiBase, onOpenBag }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendMessage(event) {
    event.preventDefault()
    const message = input.trim()
    if (!message || loading) return

    setMessages((current) => [...current, { role: 'customer', text: message }])
    setInput('')
    setLoading(true)
    try {
      const response = await fetch(`${apiBase}/api/chatbot/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'The assistant is unavailable.')
      setMessages((current) => [...current, { role: 'assistant', text: data.reply }])
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'assistant',
        text: `${error.message} You can contact the bakery by phone or WhatsApp for help.`,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open ? (
        <section className="help-widget" aria-label="Bakery help assistant">
          <div className="help-widget-header">
            <div>
              <span className="help-avatar"><Icon name="chat" size={18} /></span>
              <span className="help-title"><strong>Here to help</strong><small>Bakery questions & order support</small></span>
            </div>
            <button className="help-close" type="button" aria-label="Close help" onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="help-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="help-welcome">
                <p>Hi there. I can answer questions about the bakery and help you use checkout.</p>
                <button type="button" onClick={() => {
                  setOpen(false)
                  onOpenBag()
                }}>How do I place an order?</button>
              </div>
            )}
            {messages.map((message, index) => (
              <p className={`help-message ${message.role}`} key={`${message.role}-${index}`}>{message.text}</p>
            ))}
            {loading && <p className="help-message assistant">One moment…</p>}
          </div>
          <form className="help-form" onSubmit={sendMessage}>
            <input aria-label="Ask the bakery assistant" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask us anything…" />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Send message"><Icon name="arrow" size={18} /></button>
          </form>
          <p className="help-disclaimer">The assistant can guide you, but orders are placed through website checkout.</p>
        </section>
      ) : (
        <button className="help-launcher" type="button" onClick={() => setOpen(true)}>
          <Icon name="chat" size={19} /><span>Need a hand?</span>
        </button>
      )}
    </>
  )
}
