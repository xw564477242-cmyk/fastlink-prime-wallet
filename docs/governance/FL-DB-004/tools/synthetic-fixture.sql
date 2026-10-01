-- Synthetic-only local fixture; not migration or remediation.
INSERT INTO "Tenant" (id,"legalName","brandName",slug,environment,"updatedAt") VALUES ('synthetic_db4_a','Synthetic','Synthetic','synthetic-db4-a','SANDBOX','2026-01-01');
INSERT INTO "TenantUser" (id,"tenantId",email,"updatedAt") VALUES ('synthetic_db4_user_a','synthetic_db4_a','synthetic-a@example.invalid','2026-01-01');
INSERT INTO "Customer" (id,"tenantId",environment,"externalUserId","providerCustomerRef","updatedAt") VALUES ('synthetic_db4_customer_a','synthetic_db4_a','SANDBOX','synthetic-user-a','synthetic-provider-a','2026-01-01');
INSERT INTO "Tenant" (id,"legalName","brandName",slug,environment,"updatedAt") VALUES ('synthetic_db4_b','Synthetic','Synthetic','synthetic-db4-b','SANDBOX','2026-01-01');
INSERT INTO "TenantUser" (id,"tenantId",email,"updatedAt") VALUES ('synthetic_db4_user_b','synthetic_db4_b','synthetic-b@example.invalid','2026-01-01');
INSERT INTO "Customer" (id,"tenantId",environment,"externalUserId","providerCustomerRef","updatedAt") VALUES ('synthetic_db4_customer_b','synthetic_db4_b','SANDBOX','synthetic-user-b','synthetic-provider-b','2026-01-01');
