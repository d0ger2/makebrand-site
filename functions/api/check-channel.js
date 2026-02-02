// functions/api/check-channel.js

export async function onRequest(context) {
  // 1. Получаем ссылку или никнейм из запроса
  const url = new URL(context.request.url);
  const handle = url.searchParams.get('handle');

  if (!handle) {
    return new Response(JSON.stringify({ error: 'Handle is required' }), { status: 400 });
  }

  // 2. Чистим ввод пользователя
  let cleanHandle = handle.replace('https://www.youtube.com/', '')
                          .replace('youtube.com/', '')
                          .replace('@', '')
                          .trim();

  // 3. Берем секретный ключ из настроек Cloudflare
  const API_KEY = context.env.YOUTUBE_API_KEY;

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'Server config error: No API Key' }), { status: 500 });
  }

  try {
    // 4. Ищем канал через YouTube API
    // Сначала пробуем поиск как @handle
    let apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=@${cleanHandle}&key=${API_KEY}`;
    
    let response = await fetch(apiUrl);
    let data = await response.json();

    // Если не нашли по handle, пробуем общий поиск
    if (!data.items || data.items.length === 0) {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${cleanHandle}&key=${API_KEY}`;
      const searchResp = await fetch(searchUrl);
      const searchData = await searchResp.json();

      if (!searchData.items || searchData.items.length === 0) {
        return new Response(JSON.stringify({ error: 'Channel not found' }), { status: 404 });
      }

      // Берем ID найденного канала и получаем статистику
      const channelId = searchData.items[0].id.channelId;
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;
      response = await fetch(apiUrl);
      data = await response.json();
    }

    // 5. Формируем красивый ответ
    const item = data.items[0];
    const result = formatData(item);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Вспомогательная функция (считаем деньги и подписчиков)
function formatData(item) {
    let subs = parseInt(item.statistics.subscriberCount);
    let subsDisplay = subs;

    if (subs > 1000000) subsDisplay = (subs / 1000000).toFixed(1) + 'M';
    else if (subs > 1000) subsDisplay = (subs / 1000).toFixed(1) + 'K';

    // Примерный расчет дохода
    let revenue = "$2,000+";
    if(subs > 1000000) revenue = "$30,000+";
    else if(subs > 500000) revenue = "$15,000+";
    else if(subs > 100000) revenue = "$5,000+";

    return {
        title: item.snippet.title,
        avatar: item.snippet.thumbnails.default.url, // или .high.url для качества получше
        subs: subsDisplay,
        handle: item.snippet.customUrl || item.snippet.title,
        revenue: revenue
    };
}