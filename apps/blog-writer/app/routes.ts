import { flatRoutes } from "@react-router/fs-routes"

// A test sitting beside the route it covers is not itself a route. Without this the router publishes an address for
// every test file in the folder and the type generator writes route types for them.
export default flatRoutes({ ignoredRouteFiles: ["**/*.test.{ts,tsx}"] })
