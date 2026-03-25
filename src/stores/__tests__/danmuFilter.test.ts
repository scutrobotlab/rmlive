import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDanmuFilterStore } from '../danmuFilter';

describe('danmuFilter store batch setters', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('setSchools normalizes and deduplicates values', () => {
    const store = useDanmuFilterStore();

    store.setSchools([' SCUT ', 'scut', '', 'HIT']);

    expect(store.rules.schools).toEqual(['SCUT', 'HIT']);
  });

  it('setUsers normalizes and deduplicates values', () => {
    const store = useDanmuFilterStore();

    store.setUsers([' Alice ', 'alice', 'Bob']);

    expect(store.rules.users).toEqual(['Alice', 'Bob']);
  });

  it('keeps existing rule groups when updating schools/users', () => {
    const store = useDanmuFilterStore();

    store.addKeyword('ad');
    store.setSchools(['SCUT']);
    store.setUsers(['Alice']);

    expect(store.rules.keywords).toEqual(['ad']);
    expect(store.rules.schools).toEqual(['SCUT']);
    expect(store.rules.users).toEqual(['Alice']);
  });
});
