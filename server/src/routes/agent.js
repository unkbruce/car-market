import { Router } from 'express';

const router = Router();
const AGENT_TIMEOUT_MS = 15000;

function getAgentApiBase() {
  return (process.env.AGENT_API_BASE || 'http://localhost:8000').replace(/\/$/, '');
}

function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

router.post('/chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';

  if (!message) {
    return res.status(400).json({
      success: false,
      message: '질문 내용을 확인해주세요.',
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

  try {
    const response = await fetch(`${getAgentApiBase()}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        session_id: sessionId || undefined,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      return res.status(response.status || 502).json({
        success: false,
        message: payload?.message || 'AI 상담 중 오류가 발생했습니다.',
      });
    }

    const cars = Array.isArray(payload.cars) ? payload.cars : [];

    if (isDevelopment()) {
      console.log('Node proxy cars count:', cars.length);
    }

    return res.json({
      success: true,
      answer: payload.answer || '',
      sessionId: payload.sessionId || sessionId,
      selected_car_ids: Array.isArray(payload.selected_car_ids) ? payload.selected_car_ids : [],
      cars,
    });
  } catch (error) {
    const isTimeout = error.name === 'AbortError';

    return res.status(isTimeout ? 504 : 502).json({
      success: false,
      message: isTimeout
        ? 'AI 상담 서버 응답 시간이 초과되었습니다.'
        : 'AI 상담 서버에 연결할 수 없습니다.',
    });
  } finally {
    clearTimeout(timeoutId);
  }
});

export default router;
