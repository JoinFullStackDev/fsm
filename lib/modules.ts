/**
 * Module/Plugin Configuration
 * 
 * Defines all available modules/plugins in the system.
 * Each module can be enabled/disabled per organization and per package.
 */

export interface ModuleDefinition {
  /** Unique key for the module (must match feature key in PackageFeatures) */
  key: string;
  /** Display name */
  name: string;
  /** Description of what the module provides */
  description: string;
  /** Icon name (from @mui/icons-material) */
  icon?: string;
  /** Category for grouping modules */
  category?: string;
}

/**
 * Available modules/plugins in the system
 * Add new modules here as they are developed
 */
export const AVAILABLE_MODULES: ModuleDefinition[] = [
  {
    key: 'ops_tool_enabled',
    name: 'Ops Tool',
    description: 'Access to Companies, Opportunities, and Contacts management',
    icon: 'Business',
    category: 'Operations',
  },
  {
    key: 'ai_features_enabled',
    name: 'AI Features',
    description: 'AI-powered template generation and content assistance',
    icon: 'AutoAwesome',
    category: 'AI',
  },
  {
    key: 'export_features_enabled',
    name: 'Export Features',
    description: 'Export projects as Blueprint bundles and Cursor bundles',
    icon: 'Download',
    category: 'Export',
  },
  {
    key: 'analytics_enabled',
    name: 'Analytics',
    description: 'Advanced analytics and reporting features',
    icon: 'Analytics',
    category: 'Analytics',
  },
  {
    key: 'api_access_enabled',
    name: 'API Access',
    description: 'REST API access with API keys',
    icon: 'Api',
    category: 'Integration',
  },
];

/**
 * Get module definition by key
 */
export function getModuleDefinition(key: string): ModuleDefinition | undefined {
  return AVAILABLE_MODULES.find((m) => m.key === key);
}

/**
 * Get all modules grouped by category
 */
export function getModulesByCategory(): Record<string, ModuleDefinition[]> {
  const grouped: Record<string, ModuleDefinition[]> = {};
  
  AVAILABLE_MODULES.forEach((module) => {
    const category = module.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(module);
  });
  
  return grouped;
}

/**
 * Get module keys that correspond to feature flags
 */
export function getModuleKeys(): string[] {
  return AVAILABLE_MODULES.map((m) => m.key);
}

