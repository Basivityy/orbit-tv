import 'package:flutter/foundation.dart';

import 'models.dart';
import 'xtream_client.dart';

/// Special category ids (not from the server).
class Cat {
  static const all = '__all';
  static const favorites = '__fav';
  static const recent = '__recent';
}

enum LoadState { idle, loading, ready, error }

/// Channels, movies and series of the signed-in account, kept in memory.
class Catalog extends ChangeNotifier {
  Catalog(this.api);
  final XtreamClient api;

  List<Category> liveCategories = const [];
  List<Channel> channels = const [];
  final Map<int, Channel> _byId = {};
  final Map<String, List<Channel>> _byCat = {};

  List<Category> vodCategories = const [];
  List<VodItem> vod = const [];
  LoadState vodState = LoadState.idle;
  String? vodError;

  List<Category> seriesCategories = const [];
  List<Series> series = const [];
  LoadState seriesState = LoadState.idle;
  String? seriesError;

  /// Loads live categories and channels (needed before the app opens).
  Future<void> loadLive() async {
    final results = await Future.wait([api.liveCategories(), api.liveStreams()]);
    liveCategories = results[0] as List<Category>;
    channels = results[1] as List<Channel>;
    channels.sort((a, b) => a.number.compareTo(b.number));
    _byId
      ..clear()
      ..addEntries(channels.map((c) => MapEntry(c.id, c)));
    _byCat.clear();
    for (final c in channels) {
      _byCat.putIfAbsent(c.categoryId, () => []).add(c);
    }
    // Hide empty categories, keep server order.
    liveCategories = liveCategories.where((c) => (_byCat[c.id]?.isNotEmpty ?? false)).toList();
    notifyListeners();
  }

  Channel? channel(int id) => _byId[id];

  List<Channel> channelsIn(String categoryId, {Set<int> favorites = const {}, List<int> recent = const []}) {
    switch (categoryId) {
      case Cat.all:
        return channels;
      case Cat.favorites:
        return channels.where((c) => favorites.contains(c.id)).toList();
      case Cat.recent:
        return recent.map((id) => _byId[id]).whereType<Channel>().toList();
      default:
        return _byCat[categoryId] ?? const [];
    }
  }

  String categoryName(String id) {
    switch (id) {
      case Cat.all:
        return 'Svi kanali';
      case Cat.favorites:
        return 'Omiljeni';
      case Cat.recent:
        return 'Nedavno gledano';
    }
    for (final c in liveCategories) {
      if (c.id == id) return c.name;
    }
    return '';
  }

  /// Next/previous channel within [list] (wraps around).
  Channel? neighbour(List<Channel> list, Channel current, int step) {
    if (list.isEmpty) return null;
    var i = list.indexWhere((c) => c.id == current.id);
    if (i < 0) return list.first;
    i = (i + step) % list.length;
    if (i < 0) i += list.length;
    return list[i];
  }

  Channel? byNumber(int number) {
    for (final c in channels) {
      if (c.number == number) return c;
    }
    return null;
  }

  Future<void> loadVod({bool force = false}) async {
    if (vodState == LoadState.loading || (vodState == LoadState.ready && !force)) return;
    vodState = LoadState.loading;
    vodError = null;
    notifyListeners();
    try {
      final r = await Future.wait([api.vodCategories(), api.vodStreams()]);
      vodCategories = r[0] as List<Category>;
      vod = r[1] as List<VodItem>;
      final used = vod.map((v) => v.categoryId).toSet();
      vodCategories = vodCategories.where((c) => used.contains(c.id)).toList();
      vodState = LoadState.ready;
    } catch (e) {
      vodState = LoadState.error;
      vodError = e.toString();
    }
    notifyListeners();
  }

  Future<void> loadSeries({bool force = false}) async {
    if (seriesState == LoadState.loading || (seriesState == LoadState.ready && !force)) return;
    seriesState = LoadState.loading;
    seriesError = null;
    notifyListeners();
    try {
      final r = await Future.wait([api.seriesCategories(), api.series()]);
      seriesCategories = r[0] as List<Category>;
      series = r[1] as List<Series>;
      final used = series.map((v) => v.categoryId).toSet();
      seriesCategories = seriesCategories.where((c) => used.contains(c.id)).toList();
      seriesState = LoadState.ready;
    } catch (e) {
      seriesState = LoadState.error;
      seriesError = e.toString();
    }
    notifyListeners();
  }

  List<VodItem> latestVod([int n = 30]) {
    final list = [...vod]..sort((a, b) => (b.added ?? DateTime(1970)).compareTo(a.added ?? DateTime(1970)));
    return list.take(n).toList();
  }

  List<Series> latestSeries([int n = 30]) {
    final list = [...series]..sort((a, b) => (b.updated ?? DateTime(1970)).compareTo(a.updated ?? DateTime(1970)));
    return list.take(n).toList();
  }

  static String fold(String s) => s
      .toLowerCase()
      .replaceAll('č', 'c')
      .replaceAll('ć', 'c')
      .replaceAll('š', 's')
      .replaceAll('ž', 'z')
      .replaceAll('đ', 'dj');

  List<Channel> searchChannels(String q, {int limit = 40}) {
    final f = fold(q.trim());
    if (f.isEmpty) return const [];
    final n = int.tryParse(f);
    return channels.where((c) => (n != null && c.number == n) || fold(c.name).contains(f)).take(limit).toList();
  }

  List<VodItem> searchVod(String q, {int limit = 40}) {
    final f = fold(q.trim());
    if (f.isEmpty) return const [];
    return vod.where((v) => fold(v.name).contains(f)).take(limit).toList();
  }

  List<Series> searchSeries(String q, {int limit = 40}) {
    final f = fold(q.trim());
    if (f.isEmpty) return const [];
    return series.where((v) => fold(v.name).contains(f)).take(limit).toList();
  }
}
