# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2] - 2025-08-01

### Fixed
- Fixed MCP authentication issues by adding `skip_before_action :authenticate_api_user!` to McpStreamController
- Fixed McpUsageLog model association error by specifying `class_name: 'UserMcpKey'`
- Added 'mcp_proxy' to allowed client_type values in McpUsageLog validation

### Changed
- Improved API URL configuration to use Render default domain (https://ainote-5muq.onrender.com)
- Updated MCP authentication to consistently use MCP key authentication across all controllers

## [1.0.1] - 2025-07-01

### Added
- Initial release with basic task management features
- Support for creating, updating, deleting, and listing tasks
- Category management integration
- API key authentication

## [1.0.0] - 2025-06-15

### Added
- First version of AI Note MCP Server
- Basic integration with Claude Desktop
- Task management tools