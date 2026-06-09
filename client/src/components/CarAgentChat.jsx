import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Loader2, Send, Sparkles, XCircle } from 'lucide-react';
import api from '../api/api.js';
import { PLACEHOLDER_IMAGE } from './CarImagePlaceholder.jsx';
import { formatDistance, formatPrice } from '../utils/formatters.js';

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

function getFriendlyError(error) {
  const status = error.response?.status;

  if (status === 400) {
    return '질문 내용을 확인해주세요.';
  }

  if (status === 502) {
    return 'AI 상담 서버에 연결할 수 없습니다.';
  }

  if (status === 504) {
    return 'AI 상담 서버 응답 시간이 초과되었습니다.\n잠시 후 다시 시도해주세요.';
  }

  return 'AI 상담 중 오류가 발생했습니다.';
}

function getCarId(car) {
  const carId = car?.id || car?._id;
  return carId ? String(carId) : '';
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) {
    return PLACEHOLDER_IMAGE;
  }

  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  if (imageUrl.startsWith('/images/')) {
    return imageUrl;
  }

  if (imageUrl.startsWith('/')) {
    return `${api.defaults.baseURL}${imageUrl}`;
  }

  return imageUrl;
}

function normalizeCars(cars) {
  if (!Array.isArray(cars)) {
    return [];
  }

  return cars
    .map((car) => ({
      ...car,
      id: getCarId(car),
    }))
    .filter((car) => car.id);
}

function getResponseCars(data) {
  if (Array.isArray(data?.cars)) {
    return data.cars;
  }

  return [];
}

function AgentCarImage({ car }) {
  const [hasImageError, setHasImageError] = useState(false);
  const imageUrl = hasImageError ? PLACEHOLDER_IMAGE : resolveImageUrl(car.imageUrl);

  return (
    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-50">
      <img
        src={imageUrl}
        alt={car.name || '차량 이미지'}
        className="h-full w-full object-contain object-center"
        onError={() => setHasImageError(true)}
      />
    </div>
  );
}

function AgentCarCard({ car }) {
  const navigate = useNavigate();
  const detailPath = `/cars/${car.id}`;

  return (
    <article className="mt-2 flex min-w-0 gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <AgentCarImage car={car} />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-950">
          {car.name || '이름 없는 차량'}
        </h3>
        <p className="mt-1 text-[11px] font-medium text-slate-500">
          {car.year ? `${car.year}년식` : '연식 미정'} · {formatDistance(car.mileage)}
        </p>
        <p className="mt-0.5 text-[13px] font-extrabold text-slate-950">
          {formatPrice(car.price)}
        </p>
        <button
          type="button"
          className="mt-2 inline-flex h-7 items-center justify-center rounded-lg bg-blue-600 px-2.5 text-[11px] font-bold text-white transition hover:bg-blue-700"
          onClick={() => navigate(detailPath)}
        >
          상세보기
        </button>
      </div>
    </article>
  );
}

function CarAgentChat({ onClose }) {
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem(SESSION_ID_KEY) || '');
  const [messages, setMessages] = useState(readStoredMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isLoading]);

  function handleScroll() {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 90;
  }

  async function sendMessage(nextMessage = input) {
    const trimmedMessage = nextMessage.trim();

    if (!trimmedMessage || isLoading) {
      return;
    }

    shouldStickToBottomRef.current = true;

    const userMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmedMessage,
      cars: [],
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
      const data = response.data || {};
      const nextSessionId = data.sessionId || sessionId;
      const cars = normalizeCars(getResponseCars(data));

      if (import.meta.env.DEV) {
        console.log('React received cars count:', cars.length);
        console.log('React card car ids:', cars.map((car) => car.id));
      }

      setSessionId(nextSessionId);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: data.answer || '답변을 받지 못했습니다.',
          cars,
        },
      ]);
    } catch (chatError) {
      console.error('AI 상담 요청 실패', chatError);

      const message = getFriendlyError(chatError);
      setError(message);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          content: message,
          cars: [],
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    sendMessage();
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-white text-slate-950"
      aria-label="AI 차량 상담 대화"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Bot size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-950">AI 차량 상담</h2>
          <p className="text-[11px] font-medium text-slate-500">실제 등록 차량 기준으로 답변합니다</p>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        onScroll={handleScroll}
      >
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

                {Array.isArray(message.cars) && message.cars.length > 0 ? (
                  <div className="mt-2">
                    {message.cars.map((car) => (
                      <AgentCarCard key={car.id} car={car} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            <Loader2 className="animate-spin text-blue-600" size={14} />
            <span className="animate-pulse">등록 차량을 검색하고 있습니다...</span>
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
          <div className="mb-2 inline-flex items-center gap-1.5 whitespace-pre-wrap text-xs font-semibold text-red-600">
            <XCircle size={13} />
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
          <textarea
            ref={inputRef}
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
