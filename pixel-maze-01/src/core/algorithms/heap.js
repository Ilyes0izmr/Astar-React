/**
 * A binary min-heap priority queue.
 *
 * The original implementation sorted its candidate list on every expansion,
 * which is O(n log n) per node. This is the standard fix: O(log n) push and pop.
 *
 * There is no decrease-key. Dijkstra, A* and greedy all push duplicates when
 * they find a better route to a node and simply ignore any entry popped after
 * the node was already settled. That "lazy deletion" costs a little memory and
 * saves the index bookkeeping a decrease-key would need.
 *
 * @see {@link https://www.redblobgames.com/pathfinding/a-star/implementation.html}
 */
export class MinHeap {
  constructor() {
    /** @type {number[]} parallel arrays: value, priority, insertion sequence */
    this.values = [];
    this.priorities = [];
    this.seqs = [];
    this.counter = 0;
  }

  get size() {
    return this.values.length;
  }

  /**
   * Ranks entry `a` before entry `b`.
   *
   * Ties are broken by insertion order, which makes every run reproducible for
   * a given seed. Without it, equal-priority nodes would come out in whatever
   * order the heap happened to leave them and the animation would differ
   * between runs of the same city.
   */
  #lower(a, b) {
    if (this.priorities[a] !== this.priorities[b]) {
      return this.priorities[a] < this.priorities[b];
    }
    return this.seqs[a] < this.seqs[b];
  }

  #swap(a, b) {
    [this.values[a], this.values[b]] = [this.values[b], this.values[a]];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
    [this.seqs[a], this.seqs[b]] = [this.seqs[b], this.seqs[a]];
  }

  /**
   * @param {number} value - a flat cell index
   * @param {number} priority - lower comes out first
   */
  push(value, priority) {
    this.values.push(value);
    this.priorities.push(priority);
    this.seqs.push(this.counter++);

    let i = this.values.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.#lower(i, parent)) break;
      this.#swap(i, parent);
      i = parent;
    }
  }

  /** @returns {number|undefined} the lowest-priority value, or undefined if empty */
  pop() {
    const n = this.values.length;
    if (n === 0) return undefined;

    const top = this.values[0];
    const lastValue = this.values.pop();
    const lastPriority = this.priorities.pop();
    const lastSeq = this.seqs.pop();

    if (n > 1) {
      this.values[0] = lastValue;
      this.priorities[0] = lastPriority;
      this.seqs[0] = lastSeq;

      let i = 0;
      const size = this.values.length;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < size && this.#lower(left, smallest)) smallest = left;
        if (right < size && this.#lower(right, smallest)) smallest = right;
        if (smallest === i) break;
        this.#swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  /**
   * A snapshot of everything currently queued.
   *
   * Only used by the visualizer, to draw the pulsing frontier. Heap order is
   * meaningless here and the caller must not rely on it.
   *
   * @returns {number[]} the queued cell indices
   */
  snapshot() {
    return this.values.slice();
  }
}
