export {
  getCurrentTenant,
  getTenantConfig,
  getDepartments,
} from "./tenancy.service.js";

export { findDepartmentById } from "./department.repository.js";

export { tenantRouter, departmentsRouter } from "./tenancy.routes.js";

export type { DepartmentResponse, TenantResponse, TenantSettingsResolved } from "./types.js";
