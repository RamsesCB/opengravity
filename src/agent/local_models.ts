export type ModelType = 'architect' | 'agent' | 'fast_logic' | 'auditor';

export interface LocalModel {
  id: string;
  name: string;
  type: ModelType;
  description: string;
  skills: string[];
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'minimax_m2.5',
    name: 'MiniMax M2.5',
    type: 'architect',
    description: 'System Design, lógica compleja, documentos y presentaciones',
    skills: ['api-rest-design', 'architecture-guardrails', 'documentation-standards'],
  },
  {
    id: 'nemotron_3_super',
    name: 'Nemotron-3 Super',
    type: 'agent',
    description: 'Tool Calling de alta precisión, APIs y flujos empresariales',
    skills: ['api-rest-design', 'ci-cd-pipeline', 'security-checklist'],
  },
  {
    id: 'mimo_v2_flash',
    name: 'MiMo v2 Flash',
    type: 'fast_logic',
    description: 'Programación rápida, Flutter/Dart/JS, autocompletado, razonamiento matemático',
    skills: ['performance-rules', 'testing-coverage', 'code-review-checklist'],
  },
  {
    id: 'big_pickle',
    name: 'Big Pickle',
    type: 'auditor',
    description: 'Code Review de archivos extensos, debugging profundo, documentación técnica',
    skills: ['code-review-checklist', 'security-checklist', 'testing-coverage'],
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
