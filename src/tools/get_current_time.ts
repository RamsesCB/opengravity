import { registry } from './registry.js';

registry.register({
  name: 'get_current_time',
  description: 'Returns the current local time in ISO format',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: () => {
    return new Date().toISOString();
  }
});
