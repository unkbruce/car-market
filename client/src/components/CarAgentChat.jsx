import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, XCircle } from 'lucide-react';
import api from '../api/api.js';

const SESSION_ID_KEY = 'carmarketAgentSessionId';
const MESSAGES_KEY = 'carmarketAgentMessages';
const SUGGESTED_QUESTIONS = [
  '예산 2500만원 이하 SUV 추천',
  '2020년식 이후 현대차 검색',
  '출퇴근용 차량 추천',
];

function readStoredMessages() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(MESSAGES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function CarAgentChat() {
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem(SESSION_ID_KEY) || '');
  const [messages, setMessages] = useState(readStoredMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
  }, [sessionId]);

  async function sendMessage(nextMessage = input) {
    const trimmedMessage = nextMessage.trim();

    if (!trimmedMessage || isLoading) {
      return;
    }

    const userMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmedMessage,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const response = await api.post('/api/agent/chat', {
        message: trimmedMessage,
        sessionId,
      });
      const nextSessionId = response.data.sessionId || sessionId;

      setSessionId(nextSessionId);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: response.data.answer || '답변을 받지 못했습니다.',
        },
      ]);
    } catch (chatError) {
      const message = chatError.response?.data?.message || 'AI 상담 요청에 실패했습니다.';
      setError(message);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          content: message,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    sendMessage();
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-white text-slate-950">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Bot size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-950">AI 차량 상담</h2>
          <p className="text-[11px] font-medium text-slate-500">실제 등록 차량 기준으로 답변합니다</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-slate-700">
            예산, 차종, 연식, 용도를 알려주시면 등록 차량 중에서 찾아드릴게요.
          </div>
        ) : null}

        <div className="space-y-2.5">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[86%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.isError
                      ? 'border border-red-100 bg-red-50 text-red-700'
                      : 'border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm">
            <Loader2 className="animate-spin" size={14} />
            답변 작성 중
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => sendMessage(question)}
              disabled={isLoading}
            >
              <Sparkles size={12} />
              {question}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <XCircle size={13} />
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
          <textarea
            className="min-h-10 max-h-28 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            value={input}
            rows={1}
            placeholder="원하는 차량 조건을 입력하세요"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            aria-label="AI 상담 메시지 전송"
          >
            {isLoading ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
          </button>
        </div>
      </div>
    </section>
  );
}

export default CarAgentChat;
