# Nodemw MCP Server

A Model Context Protocol (MCP) server implementation for [nodemw](https://github.com/macbre/nodemw), a Node.js MediaWiki API client.

## Features

- **Complete API Coverage**: Exposes all nodemw `Bot` class methods as MCP tools
- **Resource Management**: Bot configurations are exposed as MCP resources
- **Automatic Authentication**: Login state is managed internally, no credentials exposed to AI
- **Type Safety**: Written in TypeScript with full type definitions

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `config.json` file in the project root (or set `CONFIG` environment variable to point to your config file):

```json
{
  "defaultBot": "en.wikipedia.org",
  "bots": {
    "en.wikipedia.org": {
      "server": "https://en.wikipedia.org",
      "path": "/w",
      "debug": false,
      "username": null,
      "password": null
    },
    "mywiki": {
      "server": "https://mywiki.example.com",
      "path": "/w",
      "debug": false,
      "username": "myuser",
      "password": "${MY_PASSWORD}"  // Environment variable substitution
    }
  }
}
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nodemw": {
      "command": "node",
      "args": ["/path/to/nodemw-mcp/dist/index.js"],
      "env": {
        "CONFIG": "/path/to/your/config.json"
      }
    }
  }
}
```

## Available Tools

### Resource Management

- `add-bot`: Add a new bot configuration
- `remove-bot`: Remove a bot configuration
- `set-bot`: Switch to a different bot configuration

### Read Operations

- `get-article`: Get the content of a wiki page
- `search`: Search for pages by keyword
- `get-pages-in-category`: List all pages in a category

### Write Operations (Requires Authentication)

- `edit`: Edit a wiki page
- `append`: Append content to a wiki page

## Testing with MCP Inspector

```bash
# List all tools
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/list

# Get a page
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name get-article \
  --tool-arg 'title=Main Page'

# Search
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call \
  --tool-name search \
  --tool-arg 'keyword=MediaWiki'

# Read a resource
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method resources/read \
  --uri 'mcp://bots/en.wikipedia.org'
```

## Copyright
© 2025 Xie Youtian. All rights reserved.

Warning: This computer program is protected by copyright law and international treaties. Unauthorized reproduction or distribution of this program, or any portion of it, may result in severe civil and criminal penalties, and will be prosecuted to the maximum extent possible under the law.
