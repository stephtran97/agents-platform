import { z } from 'zod';
import { tenantIdSchema } from '@agents-platform/contracts';

export const tenantContextSchema = z.object({ tenantId: tenantIdSchema });
export type TenantContext = z.infer<typeof tenantContextSchema>;
