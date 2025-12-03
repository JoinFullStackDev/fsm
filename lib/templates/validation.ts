import { z } from 'zod';
import type { TemplateFieldConfig } from '@/types/templates';

/**
 * Generates a Zod schema from template field configurations
 */
export function generateZodSchema(fields: TemplateFieldConfig[]): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    const config = field.field_config;
    let fieldSchema: z.ZodTypeAny = z.any();

    switch (field.field_type) {
      case 'text':
      case 'textarea': {
        let textSchema: z.ZodTypeAny = z.string();
        if (config.validation?.minLength) {
          textSchema = (textSchema as z.ZodString).min(config.validation.minLength);
        }
        if (config.validation?.maxLength) {
          textSchema = (textSchema as z.ZodString).max(config.validation.maxLength);
        }
        if (config.validation?.pattern) {
          textSchema = (textSchema as z.ZodString).regex(new RegExp(config.validation.pattern));
        }
        if (!config.required) {
          textSchema = (textSchema as z.ZodString).optional();
        }
        fieldSchema = textSchema;
        break;
      }

      case 'array':
        fieldSchema = z.array(z.string());
        if (!config.required) {
          fieldSchema = fieldSchema.optional();
        }
        break;

      case 'select':
        const options = config.options || [];
        if (options.length > 0) {
          fieldSchema = z.enum(options.map(opt => opt.value) as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        if (!config.required) {
          fieldSchema = fieldSchema.optional();
        }
        break;

      case 'checkbox':
        fieldSchema = z.boolean();
        if (!config.required) {
          fieldSchema = fieldSchema.optional();
        }
        break;

      case 'erd':
        // ERD has structured data (entities and relationships)
        // Use z.any() to allow flexible ERD data structure
        fieldSchema = z.any();
        if (!config.required) {
          fieldSchema = fieldSchema.optional();
        }
        break;

      case 'custom':
      case 'object':
        // For custom types, use z.any() or z.unknown() as a fallback
        // Specific custom types should have their own validation
        fieldSchema = z.any();
        if (!config.required) {
          fieldSchema = fieldSchema.optional();
        }
        break;

      default:
        fieldSchema = z.any().optional();
    }

    // Apply default value
    if (config.defaultValue !== undefined) {
      fieldSchema = fieldSchema.default(config.defaultValue);
    }

    shape[field.field_key] = fieldSchema;
  });

  return z.object(shape);
}

/**
 * Validates phase data against template field configurations
 */
export function validatePhaseData(
  data: Record<string, any>,
  fields: TemplateFieldConfig[]
): { valid: boolean; errors: Record<string, string> } {
  try {
    const schema = generateZodSchema(fields);
    schema.parse(data);
    return { valid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { valid: false, errors };
    }
    return { valid: false, errors: { _general: 'Validation failed' } };
  }
}

