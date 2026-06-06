const DEV_CLIENT_URLS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function getAllowedOrigins() {
  const envOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

  return [...new Set([...envOrigins, ...DEV_CLIENT_URLS])];
}

function getCorsOptions() {
  return {
    origin: getAllowedOrigins(),
    credentials: true,
  };
}

export { getAllowedOrigins, getCorsOptions };
