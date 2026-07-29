import { useState, useRef, useEffect } from 'react';
import { chatWithAI } from '../../api/ai';

export default function AIChatbot({ open, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your BizManager AI assistant. Ask me anything about your business — stock, sales, purchases, or insights! 🚀' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build history (exclude welcome message)
      const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const res = await chatWithAI(text, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I couldn't reach the AI service. ${e.message?.includes('internet') ? 'Please check your internet connection.' : 'Please try again.'}`,
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const suggestions = [
    'Which items are low on stock?',
    'What are my total sales this month?',
    'Which supplier did I buy the most from?',
  ];

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="ai-chat-backdrop" onClick={onClose} />

      {/* Chat Panel */}
      <div className="ai-chat-panel">
        {/* Header */}
        <div className="ai-chat-header">
          <div className="ai-chat-header-info">
            <div className="ai-chat-avatar">✦</div>
            <div>
              <div className="ai-chat-title">BizManager AI</div>
              <div className="ai-chat-subtitle">Powered by Groq · Llama 3</div>
            </div>
          </div>
          <button className="ai-chat-close" onClick={onClose} aria-label="Close AI chat">✕</button>
        </div>

        {/* Messages */}
        <div className="ai-chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`ai-message ${msg.role === 'user' ? 'ai-message-user' : 'ai-message-bot'} ${msg.error ? 'ai-message-error' : ''}`}>
              {msg.role === 'assistant' && <div className="ai-message-avatar">✦</div>}
              <div className="ai-message-bubble">{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div className="ai-message ai-message-bot">
              <div className="ai-message-avatar">✦</div>
              <div className="ai-message-bubble ai-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick Suggestions (only when no conversation yet) */}
        {messages.length === 1 && (
          <div className="ai-suggestions">
            {suggestions.map((s, i) => (
              <button key={i} className="ai-suggestion-chip" onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="ai-chat-input-row">
          <textarea
            ref={inputRef}
            className="ai-chat-input"
            placeholder="Ask about your business..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={loading}
          />
          <button
            className="ai-chat-send"
            onClick={send}
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
