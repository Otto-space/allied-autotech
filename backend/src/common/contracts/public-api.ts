export const publicApiPaths = Object.freeze({
  branches: "/public/branches",
  branch: "/public/branches/{branchId}",
  services: "/public/services",
  service: "/public/services/{serviceId}",
});

export const publicRouterPaths = Object.freeze({
  collection: "/",
  branch: "/:branchId",
  service: "/:serviceId",
});
