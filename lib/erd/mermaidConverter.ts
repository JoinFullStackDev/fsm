import type { ERDData, ERDEntity, ERDAttribute, ERDRelationship } from '@/types/phases';

/**
 * Converts ERD JSON structure to Mermaid erDiagram syntax
 */
export function convertERDToMermaid(erd: ERDData): string {
  if (!erd || !erd.entities || erd.entities.length === 0) {
    return 'erDiagram\n    EMPTY "No entities defined"';
  }

  let mermaid = 'erDiagram\n';

  // Add entities with attributes
  erd.entities.forEach((entity) => {
    mermaid += `    ${entity.name} {\n`;
    entity.attributes.forEach((attr) => {
      let attrLine = `        ${attr.type} ${attr.name}`;
      if (attr.primary) {
        attrLine += ' PK';
      }
      if (attr.foreign) {
        attrLine += ' FK';
      }
      if (attr.nullable) {
        attrLine += ' "nullable"';
      }
      mermaid += attrLine + '\n';
    });
    mermaid += '    }\n';
  });

  // Add relationships
  if (erd.relationships && erd.relationships.length > 0) {
    mermaid += '\n';
    erd.relationships.forEach((rel) => {
      let relLine = `    ${rel.from}`;
      
      // Map relationship types to Mermaid syntax
      switch (rel.type) {
        case 'one-to-one':
          relLine += ' ||--|| ';
          break;
        case 'one-to-many':
          relLine += ' ||--o{ ';
          break;
        case 'many-to-many':
          relLine += ' }o--o{ ';
          break;
        default:
          relLine += ' ||--o{ '; // default to one-to-many
      }
      
      relLine += rel.to;
      
      if (rel.label) {
        relLine += ` : "${rel.label}"`;
      }
      
      mermaid += relLine + '\n';
    });
  }

  return mermaid;
}

/**
 * Validates ERD data structure
 */
export function validateERD(erd: ERDData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!erd) {
    errors.push('ERD data is required');
    return { valid: false, errors };
  }

  if (!Array.isArray(erd.entities)) {
    errors.push('Entities must be an array');
  } else {
    erd.entities.forEach((entity, index) => {
      if (!entity.name || typeof entity.name !== 'string') {
        errors.push(`Entity at index ${index} must have a valid name`);
      }
      if (!Array.isArray(entity.attributes)) {
        errors.push(`Entity "${entity.name}" must have an attributes array`);
      } else {
        entity.attributes.forEach((attr, attrIndex) => {
          if (!attr.name || typeof attr.name !== 'string') {
            errors.push(`Entity "${entity.name}" attribute at index ${attrIndex} must have a valid name`);
          }
          if (!attr.type || typeof attr.type !== 'string') {
            errors.push(`Entity "${entity.name}" attribute "${attr.name}" must have a valid type`);
          }
        });
      }
    });
  }

  if (!Array.isArray(erd.relationships)) {
    errors.push('Relationships must be an array');
  } else {
    const entityNames = new Set(erd.entities?.map((e) => e.name) || []);
    erd.relationships.forEach((rel, index) => {
      if (!rel.from || typeof rel.from !== 'string') {
        errors.push(`Relationship at index ${index} must have a valid "from" entity name`);
      } else if (!entityNames.has(rel.from)) {
        errors.push(`Relationship at index ${index} references unknown entity "${rel.from}"`);
      }
      if (!rel.to || typeof rel.to !== 'string') {
        errors.push(`Relationship at index ${index} must have a valid "to" entity name`);
      } else if (!entityNames.has(rel.to)) {
        errors.push(`Relationship at index ${index} references unknown entity "${rel.to}"`);
      }
      if (rel.type && !['one-to-one', 'one-to-many', 'many-to-many'].includes(rel.type)) {
        errors.push(`Relationship at index ${index} has invalid type "${rel.type}"`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a default empty ERD structure
 */
export function createEmptyERD(): ERDData {
  return {
    entities: [],
    relationships: [],
  };
}

