import { describe, it, expect, beforeEach } from 'vitest';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ShortTermMemory } from '../../src/memory/shortTerm';

describe('ShortTermMemory', () => {
  let mem: ShortTermMemory;

  beforeEach(() => {
    mem = new ShortTermMemory(4);
  });

  it('returns empty array for unknown key', () => {
    expect(mem.get('user1:chan1')).toEqual([]);
  });

  it('stores and retrieves messages', () => {
    const msgs = [new HumanMessage('hi'), new AIMessage('hello')];
    mem.set('user1:chan1', msgs);
    expect(mem.get('user1:chan1')).toHaveLength(2);
    expect(mem.get('user1:chan1')[0].content).toBe('hi');
  });

  it('trims to window size on set', () => {
    const msgs = [
      new HumanMessage('1'),
      new AIMessage('2'),
      new HumanMessage('3'),
      new AIMessage('4'),
      new HumanMessage('5'),
    ];
    mem.set('u:c', msgs);
    expect(mem.get('u:c')).toHaveLength(4);
    expect(mem.get('u:c')[0].content).toBe('2');
  });

  it('clears a specific key', () => {
    mem.set('u:c', [new HumanMessage('hi')]);
    mem.clear('u:c');
    expect(mem.get('u:c')).toEqual([]);
  });

  it('clearAll removes all keys', () => {
    mem.set('u1:c1', [new HumanMessage('hi')]);
    mem.set('u2:c2', [new HumanMessage('hey')]);
    mem.clearAll();
    expect(mem.get('u1:c1')).toEqual([]);
    expect(mem.get('u2:c2')).toEqual([]);
  });
});
