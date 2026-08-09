import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Create MCP Server instance
const server = new Server(
  {
    name: "dojo-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ping",
        description: "Returns a pong response to test MCP server connectivity",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Optional custom message",
            },
          },
        },
      },
    ],
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "ping") {
    const message = (request.params.arguments?.message as string) || "pong";
    return {
      content: [
        {
          type: "text",
          text: `MCP Server Response: ${message}`,
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

// Start the server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dojo Node MCP Server is running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting MCP Server:", error);
  process.exit(1);
});
