const JAMENDO_API_URL = 'https://api.jamendo.com/v3.0/tracks/';
const MUSIC_CATEGORIES = {
  popular: { vocalinstrumental: 'instrumental' },
  cinematic: { tag: 'cinematic', featured: true, vocalinstrumental: 'instrumental' },
  hiphop: { tag: 'hiphop', featured: true, vocalinstrumental: 'instrumental' },
  electronic: { tag: 'electronic', featured: true, vocalinstrumental: 'instrumental' },
  pop: { tag: 'pop', featured: true, vocalinstrumental: 'instrumental' },
  relaxation: { tag: 'relaxation', featured: true, vocalinstrumental: 'instrumental' },
  hindi: { tag: 'hindi' },
  'hindi-instrumental': { tag: 'hindi', vocalinstrumental: 'instrumental' },
};

export class JamendoMusicError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'JamendoMusicError';
    this.code = code;
  }
}

export async function searchJamendoTracks({ clientId, genre = 'popular', search = '', trackId = '', fetchImpl = fetch }) {
  if (!clientId) {
    throw new JamendoMusicError(
      'Jamendo music is not configured. Add JAMENDO_CLIENT_ID to the server .env file.',
      'MUSIC_NOT_CONFIGURED',
    );
  }
  const musicCategory = MUSIC_CATEGORIES[genre];
  if (!musicCategory) {
    throw new JamendoMusicError('Choose a supported music category.', 'INVALID_MUSIC_CATEGORY');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '30',
    order: 'popularity_week',
    audioformat: 'mp32',
    audiodlformat: 'mp32',
    include: 'licenses stats',
  });
  if (musicCategory.vocalinstrumental) {
    params.set('vocalinstrumental', musicCategory.vocalinstrumental);
  }

  if (trackId) {
    if (!/^\d+$/.test(trackId)) {
      throw new JamendoMusicError('Choose a valid Jamendo track.', 'INVALID_MUSIC_TRACK');
    }
    params.set('id', trackId);
    params.set('limit', '1');
  } else if (musicCategory.tag) {
    params.set('tags', musicCategory.tag);
    if (musicCategory.featured && !search.trim()) params.set('featured', '1');
  }
  if (!trackId && search.trim()) params.set('namesearch', search.trim().slice(0, 80));

  const response = await fetchImpl(`${JAMENDO_API_URL}?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new JamendoMusicError(`Jamendo music search failed (HTTP ${response.status}).`, 'MUSIC_PROVIDER_FAILED');
  }

  const payload = await response.json();
  if (payload?.headers?.status !== 'success' || !Array.isArray(payload.results)) {
    const providerMessage = String(payload?.headers?.error_message || '');
    if (/invalid client id|credential is not authorized/i.test(providerMessage)) {
      throw new JamendoMusicError(
        'Jamendo rejected the client ID. Verify that JAMENDO_CLIENT_ID is the active Client ID from your Jamendo developer app, not an account password.',
        'INVALID_JAMENDO_CLIENT_ID',
      );
    }
    throw new JamendoMusicError(
      providerMessage || 'Jamendo returned an invalid music response.',
      'MUSIC_PROVIDER_FAILED',
    );
  }

  const tracks = payload.results
    .filter((track) => track?.audio && (track.audiodownload_allowed === true || track.audiodownload_allowed === 'true') && track.audiodownload)
    .map((track) => ({
      id: String(track.id),
      name: track.name,
      artist: track.artist_name,
      album: track.album_name || '',
      duration: Number(track.duration) || 0,
      previewUrl: track.audio,
      downloadUrl: track.audiodownload,
      licenseUrl: track.license_ccurl || '',
      pageUrl: track.shareurl || '',
      imageUrl: track.image || '',
      popularity: Number(track.stats?.popularity_total) || 0,
    }));

  const playableTracks = [];
  for (let index = 0; index < tracks.length; index += 5) {
    const batch = tracks.slice(index, index + 5);
    const availability = await Promise.all(batch.map(async (track) => {
      try {
        const preview = await fetchImpl(track.previewUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000),
        });
        return preview.ok;
      } catch {
        return false;
      }
    }));
    playableTracks.push(...batch.filter((_, trackIndex) => availability[trackIndex]));
  }

  if (tracks.length && !playableTracks.length) {
    throw new JamendoMusicError(
      'Jamendo returned tracks, but their preview audio is unavailable right now. Please refresh the music list later.',
      'MUSIC_PREVIEWS_UNAVAILABLE',
    );
  }

  return playableTracks;
}

export async function fetchJamendoTrackPreview({ clientId, trackId, previewUrl = '', range = '', fetchImpl = fetch }) {
  if (!/^\d+$/.test(trackId)) {
    throw new JamendoMusicError('Choose a valid Jamendo track.', 'INVALID_MUSIC_TRACK');
  }

  let audioUrl;
  if (previewUrl) {
    if (previewUrl.length > 2048) {
      throw new JamendoMusicError('The Jamendo preview URL is invalid.', 'INVALID_MUSIC_PREVIEW_URL');
    }
    try {
      audioUrl = new URL(previewUrl);
    } catch {
      throw new JamendoMusicError('The Jamendo preview URL is invalid.', 'INVALID_MUSIC_PREVIEW_URL');
    }
    if (
      audioUrl.protocol !== 'https:'
      || !audioUrl.hostname.endsWith('.storage.jamendo.com')
      || audioUrl.searchParams.get('trackid') !== trackId
    ) {
      throw new JamendoMusicError('The Jamendo preview URL does not match the selected track.', 'INVALID_MUSIC_PREVIEW_URL');
    }
  } else {
    const [track] = await searchJamendoTracks({ clientId, trackId, fetchImpl });
    if (!track?.previewUrl) {
      throw new JamendoMusicError('Jamendo could not find a preview for this track.', 'MUSIC_TRACK_NOT_FOUND');
    }
    audioUrl = new URL(track.previewUrl);
  }

  const response = await fetchImpl(audioUrl, {
    headers: range ? { Range: range } : {},
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok && response.status !== 206) {
    throw new JamendoMusicError(`Jamendo audio preview failed (HTTP ${response.status}).`, 'MUSIC_PREVIEW_FAILED');
  }
  return response;
}

export async function fetchJamendoTrackDownload({ clientId, trackId, fetchImpl = fetch }) {
  if (!/^\d+$/.test(trackId)) {
    throw new JamendoMusicError('Choose a valid Jamendo track.', 'INVALID_MUSIC_TRACK');
  }

  const [track] = await searchJamendoTracks({ clientId, trackId, fetchImpl });
  if (!track?.downloadUrl) {
    throw new JamendoMusicError(
      'This Jamendo track is not available for download.',
      'MUSIC_DOWNLOAD_UNAVAILABLE',
    );
  }

  let downloadUrl;
  try {
    downloadUrl = new URL(track.downloadUrl);
  } catch {
    throw new JamendoMusicError('The Jamendo download URL is invalid.', 'INVALID_MUSIC_DOWNLOAD_URL');
  }
  if (
    downloadUrl.protocol !== 'https:'
    || (downloadUrl.hostname !== 'jamendo.com' && !downloadUrl.hostname.endsWith('.jamendo.com'))
  ) {
    throw new JamendoMusicError('The Jamendo download URL is invalid.', 'INVALID_MUSIC_DOWNLOAD_URL');
  }

  const response = await fetchImpl(downloadUrl, { signal: AbortSignal.timeout(60000) });
  if (!response.ok || !response.body) {
    throw new JamendoMusicError(
      `Jamendo track download failed (HTTP ${response.status}).`,
      'MUSIC_DOWNLOAD_FAILED',
    );
  }
  return response;
}
