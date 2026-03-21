import type { EntityType, FieldType, Visibility } from "./constants.js";

export type ValidationRules = {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  min?: number;
  max?: number;
  precision?: number;
  min_date?: string;
  max_date?: string;
  not_in_past?: boolean;
};

export type SelectOption = {
  value: string;
  label: string;
  color?: string | null;
  is_deprecated?: boolean;
};

export type CustomFieldDefinitionResponse = {
  id: string;
  entity_type: EntityType;
  field_key: string;
  label: string;
  description: string | null;
  field_type: FieldType;
  validation_rules: ValidationRules | null;
  default_value: unknown;
  options: SelectOption[] | null;
  is_required: boolean;
  is_searchable: boolean;
  display_order: number;
  visibility: Visibility;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CustomFieldValidationError = {
  field_key: string;
  code: string;
  message: string;
};

export type ValidateCustomFieldsResult = {
  valid: boolean;
  cleaned_values: Record<string, unknown>;
  errors: CustomFieldValidationError[];
};

export type FieldDefinitionCreatedPayload = {
  definition_id: string;
  tenant_id: string;
  entity_type: EntityType;
  field_key: string;
  field_type: FieldType;
  label: string;
  is_required: boolean;
  is_searchable: boolean;
  created_by: string;
  created_at: string;
};

export type FieldDefinitionUpdatedPayload = {
  definition_id: string;
  tenant_id: string;
  entity_type: EntityType;
  field_key: string;
  changed_fields: string[];
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  previous_version: number;
  new_version: number;
  updated_by: string;
  updated_at: string;
};

export type FieldDefinitionDeletedPayload = {
  definition_id: string;
  tenant_id: string;
  entity_type: EntityType;
  field_key: string;
  label: string;
  deleted_by: string;
  deleted_at: string;
};
