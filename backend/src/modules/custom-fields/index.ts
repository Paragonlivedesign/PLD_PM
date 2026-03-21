export {
  getFieldDefinitions,
  validateCustomFields,
  getFieldsForSearch,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  reorderDefinitions,
} from "./service.js";
export { customFieldsRouter } from "./routes.js";
export { registerCustomFieldIndexListeners } from "./index-sync.js";
export { FIELD_DEFINITION_CREATED, FIELD_DEFINITION_UPDATED, FIELD_DEFINITION_DELETED } from "./events.js";
export type { CustomFieldDefinitionResponse, ValidateCustomFieldsResult } from "./types.js";
export type { EntityType, FieldType } from "./constants.js";
