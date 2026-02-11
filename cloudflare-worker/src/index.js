import puppeteer from '@cloudflare/puppeteer';

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.searchParams;

    // 参数控制
    const type = p.get('type') || 'web'; // 默认网页解析
    const targetTemplate = p.get('target'); // 目标URL模板
    const wd = p.get('wd') || ''; // 搜索词
    const ids = p.get('ids') || ''; // ID
    const render = p.get('render') === '1'; // 是否开启Puppeteer自动化

    if (!targetTemplate) {
      return json({ 
        code: 1, 
        msg: "LibreTV Puppeteer Adapter is ready.",
        usage: "?type=web&target=https://site.com/search/{wd}&wd=keyword&render=1"
      });
    }

    try {
      // 1. 构造实际请求 URL
      const fetchUrl = targetTemplate
        .replace('{wd}', encodeURIComponent(wd))
        .replace('{id}', ids)
        .replace('{ids}', ids);

      let content = "";

      // 2. 获取源码
      if (render && type === 'web' && !!env.GET_HTML_BROWSER) {
        // --- 自动化渲染模式 ---
        const browser = await puppeteer.launch(env.GET_HTML_BROWSER);
        const page = await browser.newPage();
        await page.setUserAgent(DEFAULT_UA);
        
        // 访问并等待网络空闲 (确保动态资源加载)
        await page.goto(fetchUrl, {
          waitUntil: "networkidle2",
          timeout: 25000
        });

        content = await page.content();
        await browser.close();
      } else {
        // --- 普通请求模式 ---
        const response = await fetch(fetchUrl, {
          headers: { 
            "User-Agent": DEFAULT_UA,
            "Referer": new URL(fetchUrl).origin
          }
        });
        content = type === 'api' ? await response.json() : await response.text();
      }

      // 3. 通用解析逻辑
      const result = { code: 1, list: [] };

      if (type === 'api') {
        result.list = parseApiData(content);
      } else {
        // 智能：如果HTML里有现成的数据包，直接解析数据包（如 iyf）
        const embeddedList = extractEmbeddedJson(content);
        if (embeddedList && embeddedList.length > 0) {
          result.list = embeddedList;
          result.source = "embedded_json";
        } else {
          result.list = wd ? parseSearchHtml(content) : [parseDetailHtml(content, ids)];
          result.source = "html_parser";
        }
      }

      return json(result);

    } catch (e) {
      return json({ code: 0, msg: `Adapter Error: ${e.message}` });
    }
  }
};

/**
 * 通用 API 转换
 */
function parseApiData(data) {
  const rawList = data.list || data.data || data.results || [];
  return rawList.map(item => ({
    vod_id: item.vod_id || item.id || item.vid,
    vod_name: item.vod_name || item.title || item.name,
    vod_pic: item.vod_pic || item.thumb || item.cover,
    vod_remarks: item.vod_remarks || item.tag || "",
    vod_play_url: item.vod_play_url || ""
  }));
}

/**
 * 网页详情解析 (自动化多线路提取)
 */
function parseDetailHtml(html, id) {
  const titleMatch = html.match(/<title>([^<]+)</);
  let title = titleMatch ? titleMatch[1].replace(/-.*$/, '').trim() : "未知视频";

  // 扫描所有 m3u8 高级模式
  const m3u8Regex = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi;
  const matches = [...new Set(html.match(m3u8Regex) || [])];
  
  const playUrl = matches.map((u, i) => `线路${i + 1}$${u}`).join('#');

  return {
    vod_id: id,
    vod_name: title,
    vod_play_url: playUrl
  };
}

/**
 * 网页搜索解析 (通用正则)
 */
function parseSearchHtml(html) {
  const list = [];
  // 匹配常见的播放链接结构
  const regex = /<a[^>]+href="[^"]*?\/(?:play|detail|video|vod|watch)\/([^"\/]+)"[^>]*>(?:<[^>]+>)*\s*([^<]+)\s*(?:<[^>]+>)*<\/a>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (m[2].trim()) {
      list.push({
        vod_id: m[1],
        vod_name: m[2].trim(),
        vod_remarks: "渲染采集"
      });
    }
  }
  return list;
}

/**
 * 针对 IYF 等站点：抓取源码中未渲染的数据包
 */
function extractEmbeddedJson(html) {
  const stateMatch = html.match(/window\.__(?:INITIAL_STATE__|NUXT__|DATA__)__?\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
  if (stateMatch) {
    try {
      const data = JSON.parse(stateMatch[1]);
      // 此处逻辑需根据具体站点结构微调，目前对大部分 Nuxt/Next 架构站点有效
      return null; 
    } catch (e) {}
  }
  return null;
}

function json(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
