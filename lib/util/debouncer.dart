import 'dart:async';

/// Runs the last scheduled action after [delay] of quiet.
class Debouncer {
  Debouncer(this.delay);
  final Duration delay;
  Timer? _t;

  void call(void Function() action) {
    _t?.cancel();
    _t = Timer(delay, action);
  }

  void cancel() => _t?.cancel();
  bool get pending => _t?.isActive ?? false;
}

/// Small LRU map.
class Lru<K, V> {
  Lru(this.capacity);
  final int capacity;
  final _map = <K, V>{};

  V? get(K key) {
    final v = _map.remove(key);
    if (v != null) _map[key] = v;
    return v;
  }

  void put(K key, V value) {
    _map.remove(key);
    _map[key] = value;
    while (_map.length > capacity) {
      _map.remove(_map.keys.first);
    }
  }

  bool containsKey(K key) => _map.containsKey(key);
  Iterable<K> get keys => _map.keys;
  int get length => _map.length;
  void clear() => _map.clear();
}
