import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios"; // 引入 axios
import dotenv from 'dotenv'; // 引入 dotenv 來讀取 .env 檔案

const args = process.argv.slice(2); // 跳過 node 路徑與程式檔案路徑
const config: Record<string, string> = {};

args.forEach(arg => {
  const [key, value] = arg.split('=');
  config[key] = value;
});

if (!config.envPath) {
  console.error("envPath is missing. Please set envPath in command line.");
  throw new Error("Server configuration error: Missing envPath.");
  // 或者拋出錯誤: throw new Error("Server configuration error: Missing API key.");
}


// 在程式碼開頭載入環境變數並指定 .env 檔案的路徑
const dotenvResult = dotenv.config({ path: config.envPath });

// 檢查 dotenv 是否載入 .env 檔案失敗
if (dotenvResult.error) {
  // 取得 dotenv 開始搜尋的目前工作目錄
  const currentWorkingDirectory = process.cwd();
  // 印出警告訊息，指出它在哪裡尋找 .env 檔案
  console.warn(`[dotenv] 警告：找不到或無法載入 .env 檔案。搜尋起始目錄：${currentWorkingDirectory}`);
  // 可選：您也可以記錄 dotenv 的具體錯誤以獲取更多詳細資訊：
  // console.warn(`[dotenv] 錯誤詳細資訊：${dotenvResult.error.message}`);
} else {
  // 可選：如果找到檔案但可能是空的，則記錄日誌
  if (!dotenvResult.parsed || Object.keys(dotenvResult.parsed).length === 0) {
    console.warn(`[dotenv] 注意：找到 .env 檔案，但它是空的或不包含任何變數。`);
  } else {
    // 可選：如果需要除錯，則記錄成功訊息
    // console.log(`[dotenv] 成功載入 .env 檔案。`);
  }
}

// 從環境變數讀取 API 金鑰
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Real Weather MCP Server", // 可以改個名字
    version: "0.1.2",
  });

  async function translateToEnglish(text: string): Promise<string> {
    // console.warn(`Translation function called for "${text}". Placeholder returns original text. Implement actual translation.`);

    const langPair = "zh-TW|en"; // 從繁體中文翻譯成英文
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

    try {
      // 將 console.log 改為 console.error 或 console.debug，或者直接註解掉
      // console.log(`嘗試使用 MyMemory 將 "${text}" 翻譯成英文...`);
      console.error(`[DEBUG] 嘗試使用 MyMemory 將 "${text}" 翻譯成英文...`); // 使用 console.error 輸出到 stderr
      const response = await axios.get(apiUrl);

      if (response.data && response.data.responseData && response.data.responseData.translatedText) {
        const translatedText = response.data.responseData.translatedText;
        // 將 console.log 改為 console.error 或 console.debug，或者直接註解掉
        // console.log(`翻譯成功: "${text}" -> "${translatedText}"`);
        console.error(`[DEBUG] 翻譯成功: "${text}" -> "${translatedText}"`); // 使用 console.error 輸出到 stderr
        if (translatedText && translatedText.toLowerCase() !== text.toLowerCase()) {
          return translatedText;
        } else {
          console.warn(`翻譯 API 為 "${text}" 返回了原文或空值。使用原文。`);
          return text;
        }
      } else {
        console.error("翻譯失敗：MyMemory API 返回了非預期的回應格式。", response.data);
        throw new Error("無法解析翻譯回應。");
      }
    } catch (error: any) {
      console.error(`翻譯 API 呼叫失敗，針對 "${text}":`, error.message);
      if (axios.isAxiosError(error) && error.response) {
        console.error("翻譯 API 回應狀態:", error.response.status);
        console.error("翻譯 API 回應資料:", error.response.data);
      }
      throw new Error(`無法翻譯城市名稱 "${text}"。`);
    }
  }

  server.tool(
    "get_weather",
    {
      city: z.string().describe("The name of the city. This will be translated to English before querying the weather service."),
    },
    async ({ city }) => {
      // ... (檢查 API 金鑰和 city 的程式碼) ...

      let cityInEnglish: string;
      try {
        cityInEnglish = await translateToEnglish(city);
        // 確保這裡也沒有 console.log
        // console.log(`Original city: "${city}", Translated (or placeholder) city: "${cityInEnglish}"`);
        console.error(`[DEBUG] Original city: "${city}", Translated city: "${cityInEnglish}"`); // 使用 console.error
      } catch (translationError: any) {
        // 這裡的 console.error 是安全的，因為它輸出到 stderr
        console.error("Translation error:", translationError.message);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Failed to translate city name "${city}": ${translationError.message}` }, null, 2),
            },
          ],
        };
      }


      const units = "metric"; // 使用攝氏溫度
      // OpenWeatherMap API might support language codes for response data,
      // but the query parameter 'q' generally works best with English city names.
      // const lang = "zh_tw"; // Keep for response language if desired, but query uses English name.
      const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityInEnglish)}&appid=${OPENWEATHERMAP_API_KEY}&units=${units}`; // Removed lang=zh_tw from query for potentially better matching with English city name

      try {
        const response = await axios.get(apiUrl);

        // 檢查 OpenWeatherMap 是否成功找到城市
        if (response.status !== 200 || response.data.cod !== 200) {
          const errorMessage = response.data.message || `Could not find weather data for ${cityInEnglish} (Original: ${city}). Status: ${response.status}`;
          console.error("OpenWeatherMap API Error:", errorMessage, response.data);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: errorMessage }, null, 2),
              },
            ],
          };
        }

        const data = response.data;

        // 從 API 回應中提取需要的資訊
        const weather = {
          city: data.name, // 使用 API 回傳的標準化城市名稱
          temperature: data.main.temp,
          condition: data.weather[0]?.description || "N/A", // 天氣描述
          humidity: data.main.humidity, // 濕度
          wind_speed: data.wind.speed, // 風速 (m/s)
          country: data.sys.country, // 國家代碼
        };

        return {
          content: [
            {
              type: "text",
              // 將實際天氣資訊轉換成 JSON 字串回傳
              text: JSON.stringify(weather, null, 2),
            },
          ],
        };
      } catch (error: any) {
        console.error(`Error fetching weather data for ${cityInEnglish} (Original: ${city}):`, error.message);
        let errorMessage = `Failed to fetch weather data for ${cityInEnglish} (Original: ${city}).`;
        if (axios.isAxiosError(error) && error.response) {
          console.error("API Response Error:", error.response.status, error.response.data);
          errorMessage = `Error from weather service for ${cityInEnglish}: ${error.response.data?.message || error.response.statusText || 'Unknown API error'}`;
          if (error.response.status === 404) {
            errorMessage = `Could not find the city: ${cityInEnglish} (Original: ${city})`;
          } else if (error.response.status === 401) {
            errorMessage = `Invalid API key or unauthorized request.`;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
        };
      }
    },
  );

  return server;
}
