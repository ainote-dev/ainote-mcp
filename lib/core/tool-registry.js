export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    if (!tool?.definition?.name) {
      throw new Error('Invalid tool registration: missing tool name');
    }

    this.tools.set(tool.definition.name, tool);
  }

  registerMany(tools = []) {
    tools.forEach((tool) => this.register(tool));
  }

  listDefinitions() {
    return Array.from(this.tools.values()).map((tool) => tool.definition);
  }

  async execute(name, args, context) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return tool.handler(args ?? {}, context ?? {});
  }
}
