import ServiceDetail from "../../../src/features/services/ServiceDetail";

// A read-only handoff: only the ID is carried forward. The service is fetched
// again; a future booking flow must revalidate it and server capabilities.
export default function SelectedService() {
  return <ServiceDetail selected />;
}
