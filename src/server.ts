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

  server.tool(
    "get_weather",
    "Get real-time weather info for a given city.", // 更新描述
    {
      city: z.string().describe("The name of the city"), // 英文描述可能更通用
    },
    async ({ city }) => {
      // 檢查 API 金鑰是否存在
      if (!OPENWEATHERMAP_API_KEY) {
        console.error("OpenWeatherMap API key is missing. Please set OPENWEATHERMAP_API_KEY environment variable.");
        // 可以回傳一個錯誤訊息給使用者，或者拋出錯誤
        // 這裡選擇回傳錯誤訊息
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Server configuration error: Missing API key." }, null, 2),
            },
          ],
        };
        // 或者拋出錯誤: throw new Error("Server configuration error: Missing API key.");
      }

      if (!city) {
        // Zod 應該已經處理了這個，但多一層防護
        throw new Error("city name is required.");
      }

      const units = "metric"; // 使用攝氏溫度
      const lang = "zh_tw"; // 可以嘗試指定語言 (繁體中文)
      const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHERMAP_API_KEY}&units=${units}&lang=${lang}`;

      try {
        const response = await axios.get(apiUrl);

        // 檢查 OpenWeatherMap 是否成功找到城市
        if (response.status !== 200 || response.data.cod !== 200) {
          // API 可能回傳 200 但內容是錯誤碼 (例如找不到城市 cod: "404")
          const errorMessage = response.data.message || `Could not find weather data for ${city}. Status: ${response.status}`;
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
        console.error("Error fetching weather data:", error.message);
        // 處理網路錯誤或其他 axios 錯誤
        // 可以檢查 error.response 來獲取更詳細的 API 錯誤資訊
        let errorMessage = `Failed to fetch weather data for ${city}.`;
        if (axios.isAxiosError(error) && error.response) {
          // 如果是 API 回傳的錯誤 (例如 404 Not Found, 401 Unauthorized)
          console.error("API Response Error:", error.response.status, error.response.data);
          errorMessage = `Error from weather service: ${error.response.data?.message || error.response.statusText || 'Unknown API error'}`;
          if (error.response.status === 404) {
            errorMessage = `Could not find the city: ${city}`;
          } else if (error.response.status === 401) {
            errorMessage = `Invalid API key or unauthorized request.`;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message; // 其他一般錯誤
        }

        // 回傳一個錯誤訊息給使用者
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
        };
        // 或者拋出錯誤: throw new Error(errorMessage);
      }
    },
  );

  return server;
}
