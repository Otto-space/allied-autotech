jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: (listener: (state: { isConnected: boolean }) => void) => {
      listener({ isConnected: true });
      return () => {};
    },
  },
}));
jest.mock("react-native-safe-area-context", () => ({
  __esModule: true,
  ...jest.requireActual("react-native-safe-area-context/jest/mock").default,
}));
jest.mock("expo-secure-store", () => {
  const values = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
});
// All tests use controlled mocks; accidental network use must fail closed.
beforeEach(() => {
  global.fetch = jest.fn(async () => {
    throw new Error("Network disabled in mobile tests");
  });
});
