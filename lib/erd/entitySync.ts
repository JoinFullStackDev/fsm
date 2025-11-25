import type { Entity, ERDData, ERDEntity, ERDAttribute, ERDRelationship } from '@/types/phases';

/**
 * Converts Phase 4 entities to ERD format
 * Merges intelligently with existing ERD data
 */
export function syncEntitiesToERD(
  entities: Entity[],
  existingERD?: ERDData
): ERDData {
  const erd: ERDData = existingERD
    ? {
        entities: [...existingERD.entities],
        relationships: [...existingERD.relationships],
      }
    : {
        entities: [],
        relationships: [],
      };

  // Create a map of existing entity names for quick lookup
  const existingEntityMap = new Map<string, ERDEntity>();
  erd.entities.forEach((e) => existingEntityMap.set(e.name, e));

  // Process each entity
  entities.forEach((entity) => {
    if (!entity.name) return;

    // Check if entity already exists in ERD
    if (existingEntityMap.has(entity.name)) {
      // Merge attributes if entity exists
      const existingEntity = existingEntityMap.get(entity.name)!;
      const existingAttrMap = new Map<string, ERDAttribute>();
      existingEntity.attributes.forEach((attr) => existingAttrMap.set(attr.name, attr));

      // Add new attributes from key_fields
      entity.key_fields?.forEach((fieldName) => {
        if (!existingAttrMap.has(fieldName)) {
          existingEntity.attributes.push({
            name: fieldName,
            type: 'string', // Default type, user can update
            nullable: false,
          });
        }
      });
    } else {
      // Create new ERD entity
      const erdEntity: ERDEntity = {
        name: entity.name,
        attributes: entity.key_fields?.map((fieldName) => ({
          name: fieldName,
          type: 'string', // Default type
          nullable: false,
        })) || [],
      };

      erd.entities.push(erdEntity);
      existingEntityMap.set(entity.name, erdEntity);
    }
  });

  // Process relationships from entity.relationships
  const existingRelSet = new Set<string>();
  erd.relationships.forEach((rel) => {
    existingRelSet.add(`${rel.from}->${rel.to}`);
  });

  entities.forEach((entity) => {
    if (!entity.name || !entity.relationships) return;

    entity.relationships.forEach((relStr) => {
      // Try to parse relationship string
      // Format could be: "EntityName", "EntityName (one-to-many)", etc.
      const relMatch = relStr.match(/^([^(]+)(?:\s*\(([^)]+)\))?$/);
      if (relMatch) {
        const targetEntity = relMatch[1].trim();
        const relType = relMatch[2]?.trim() || 'one-to-many';

        // Check if target entity exists
        const targetExists = entities.some((e) => e.name === targetEntity) ||
          existingEntityMap.has(targetEntity);

        if (targetExists) {
          const relKey = `${entity.name}->${targetEntity}`;
          const reverseKey = `${targetEntity}->${entity.name}`;

          // Only add if relationship doesn't exist (in either direction)
          if (!existingRelSet.has(relKey) && !existingRelSet.has(reverseKey)) {
            let relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many' = 'one-to-many';

            if (relType.includes('one-to-one') || relType === '1:1') {
              relationshipType = 'one-to-one';
            } else if (relType.includes('many-to-many') || relType === 'm:n' || relType === 'n:m') {
              relationshipType = 'many-to-many';
            }

            const relationship: ERDRelationship = {
              from: entity.name,
              to: targetEntity,
              type: relationshipType,
            };

            erd.relationships.push(relationship);
            existingRelSet.add(relKey);
          }
        }
      }
    });
  });

  return erd;
}

/**
 * Merges new ERD data with existing ERD data
 * Prefers existing data when there are conflicts
 */
export function mergeERDData(existing: ERDData, newData: ERDData): ERDData {
  const merged: ERDData = {
    entities: [...existing.entities],
    relationships: [...existing.relationships],
  };

  const entityMap = new Map<string, ERDEntity>();
  merged.entities.forEach((e) => entityMap.set(e.name, e));

  // Add new entities that don't exist
  newData.entities.forEach((newEntity) => {
    if (!entityMap.has(newEntity.name)) {
      merged.entities.push(newEntity);
      entityMap.set(newEntity.name, newEntity);
    }
  });

  // Add new relationships that don't exist
  const relSet = new Set<string>();
  merged.relationships.forEach((rel) => {
    relSet.add(`${rel.from}->${rel.to}`);
  });

  newData.relationships.forEach((newRel) => {
    const relKey = `${newRel.from}->${newRel.to}`;
    if (!relSet.has(relKey)) {
      merged.relationships.push(newRel);
      relSet.add(relKey);
    }
  });

  return merged;
}

