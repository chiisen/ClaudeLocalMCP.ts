#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server.js";

async function main() {
  const server: McpServer = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  //console.debug("Weather MCP Server running on stdio");
  // 👆Claude 報錯 "MCP weather: Unexpected token 'W', "Weather MC"... is not valid JSON"
  // 👍所以這行 console.debug() 註解掉了就不會報錯了😁
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
