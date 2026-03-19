export type ModelType = 'architect' | 'agent' | 'fast_logic' | 'auditor';

export interface LocalModel {
  id: string;
  name: string;
  type: ModelType;
  description: string;
  opencodeModel: string;
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'minimax_m2.5',
    name: 'MiniMax M2.5',
    type: 'architect',
    description: 'System Design, lógica compleja, documentos y presentaciones',
    opencodeModel: 'ollama/qwen3.5:9b',
  },
  {
    id: 'nemotron_3_super',
    name: 'Nemotron-3 Super',
    type: 'agent',
    description: 'Tool Calling de alta precisión, APIs y flujos empresariales',
    opencodeModel: 'ollama/qwen3.5:9b',
  },
  {
    id: 'mimo_v2_flash',
    name: 'MiMo v2 Flash',
    type: 'fast_logic',
    description: 'Programación rápida, Flutter/Dart/JS, autocompletado, razonamiento matemático',
    opencodeModel: 'ollama/qwen3.5:9b',
  },
  {
    id: 'big_pickle',
    name: 'Big Pickle',
    type: 'auditor',
    description: 'Code Review de archivos extensos, debugging profundo, documentación técnica',
    opencodeModel: 'ollama/qwen3.5:9b',
  },
];

export function getModelByType(type: ModelType): LocalModel | undefined {
  return LOCAL_MODELS.find(m => m.type === type);
}

export function getModelById(id: string): LocalModel | undefined {
  return LOCAL_MODELS.find(m => m.id === id);
}

export function getAllModels(): LocalModel[] {
  return [...LOCAL_MODELS];
}
