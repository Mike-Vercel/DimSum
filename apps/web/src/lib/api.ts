import { createApiClient } from "@dimsum/api-client";

/** Browser API client: same-origin cookies, relative base URL. */
export const api = createApiClient({
  baseUrl: "/api/v1",
  headers: () => ({ "X-Client": "web" }),
});

export { ApiError } from "@dimsum/api-client";
