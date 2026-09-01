import { mock } from 'bun:test';

mock.module('react-native-mmkv', () => ({
  createMMKV: () => {
    const values = new Map<string, string>();
    return {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
      remove: (key: string) => values.delete(key),
    };
  },
}));
